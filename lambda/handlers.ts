// ─── lambda/handlers.ts ────────────────────────────────────────────────────────

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";

const SLA_HOURS: Record<string, number> = JSON.parse(
  process.env.SLA_HOURS_JSON ?? '{"EMERGENCY":4,"HIGH":24,"MEDIUM":48,"LOW":168}'
);

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });
const cognitoClient = new CognitoIdentityProviderClient({});
const snsClient = new SNSClient({});

const TABLE = process.env.TABLE_NAME!;

function getCallerGroups(event: any): string[] {
    const claims = event.requestContext?.authorizer?.claims ?? {};
    const groups: string = claims["cognito:groups"] ?? "";
    return groups ? groups.split(",") : [];
}

function isAdmin(event: any): boolean {
    return getCallerGroups(event).includes("admins");
}

function getCallerId(event: any): string {
    const claims = event.requestContext?.authorizer?.claims ?? {};
    return claims["sub"] ?? claims["username"] ?? "unknown";
}

function slaDeadlineISO(priority: string): string {
    const hours = SLA_HOURS[priority] ?? 48;
    return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function ttlEpoch(slaDeadlineISO: string): number {
    return Math.floor(new Date(slaDeadlineISO).getTime() / 1000) + 30 * 86_400;
}

function isSlaBreached(slaDeadline: string, status: string): boolean {
    if (["RESOLVED", "CLOSED", "CANCELLED"].includes(status)) return false;
    return new Date(slaDeadline) < new Date();
}

function response(statusCode: number, body: unknown) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(body),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
export const createRequestHandler = async (event: any) => {
    try {
        const callerId = getCallerId(event);
        const body = JSON.parse(event.body ?? "{}");
        const { title, description, category, priority = "MEDIUM", unitNumber, building, attachmentUrls = [] } = body;

        if (!title || !description || !category || !unitNumber) return response(400, { error: "Missing required fields" });

        const validPriorities = ["EMERGENCY", "HIGH", "MEDIUM", "LOW"];
        if (!validPriorities.includes(priority)) return response(400, { error: "Invalid priority" });

        const requestId = randomUUID();
        const createdAt = new Date().toISOString();
        const slaDeadline = slaDeadlineISO(priority);

        const item = {
            PK: `REQUEST#${requestId}`, SK: "METADATA", requestId, title, description, category, priority,
            status: "OPEN", residentId: callerId, unitNumber, building: building ?? "", attachmentUrls,
            slaDeadline, slaHours: SLA_HOURS[priority], createdAt, updatedAt: createdAt, ttl: ttlEpoch(slaDeadline),
            comments: [], assignedTo: null, resolvedAt: null,
        };

        await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
        return response(201, { requestId, slaDeadline, message: "Request created" });
    } catch (err) {
        return response(500, { error: "Internal server error" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
export const getRequestsHandler = async (event: any) => {
    try {
        const callerId = getCallerId(event);
        const admin = isAdmin(event);
        const requestId = event.pathParameters?.id;

        if (requestId) {
            const result = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" } }));
            if (!result.Item) return response(404, { error: "Request not found" });
            if (!admin && result.Item.residentId !== callerId) return response(403, { error: "Access denied" });
            return response(200, { ...result.Item, slaBreached: isSlaBreached(result.Item.slaDeadline, result.Item.status) });
        }

        const qs = event.queryStringParameters ?? {};
        const limit = Math.min(parseInt(qs.limit ?? "20"), 100);

        let startKey = undefined;
        if (qs.nextToken) {
            try { startKey = JSON.parse(Buffer.from(qs.nextToken, "base64").toString()); }
            catch (e) { return response(400, { error: "Invalid pagination token" }); }
        }

        const indexName = admin ? "StatusIndex" : "ResidentIndex";
        const keyExpr = admin ? "#s = :val" : "residentId = :val";
        const exprVals = admin ? { ":val": qs.status ?? "OPEN" } : { ":val": callerId };
        const exprNames = admin ? { "#s": "status" } : undefined;

        const result = await ddb.send(
          new QueryCommand({
              TableName: TABLE,
              IndexName: indexName,
              KeyConditionExpression: keyExpr,
              ExpressionAttributeValues: exprVals,
              ...(exprNames && { ExpressionAttributeNames: exprNames }),
              Limit: limit,
              ScanIndexForward: admin,
              ExclusiveStartKey: startKey,
          })
        );

        return response(200, {
            items: result.Items?.map((i) => ({ ...i, slaBreached: isSlaBreached(i.slaDeadline, i.status) })),
            nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") : null,
        });
    } catch (err) {
        return response(500, { error: "Internal server error" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
export const updateRequestHandler = async (event: any) => {
    try {
        const callerId = getCallerId(event);
        const admin = isAdmin(event);
        const requestId = event.pathParameters?.id;
        const isCommentPath = event.resource?.includes("comments");

        if (!requestId) return response(400, { error: "Missing request ID" });
        const body = JSON.parse(event.body ?? "{}");
        const now = new Date().toISOString();

        const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" } }));
        if (!existing.Item) return response(404, { error: "Request not found" });
        if (!admin && existing.Item.residentId !== callerId) return response(403, { error: "Access denied" });

        let expr = "SET updatedAt = :now";
        const vals: any = { ":now": now };
        const names: any = {};

        if (body.comment) {
            const commentObj = { id: randomUUID(), author: callerId, role: admin ? "admin" : "resident", text: body.comment, createdAt: now };
            expr += ", comments = list_append(if_not_exists(comments, :empty), :c)";
            vals[":c"] = [commentObj];
            vals[":empty"] = [];
        }

        if (isCommentPath) {
            if (!body.comment) return response(400, { error: "comment is required" });
            await ddb.send(new UpdateCommand({ TableName: TABLE, Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" }, UpdateExpression: expr, ExpressionAttributeValues: vals }));
            return response(200, { message: "Comment added" });
        }

        if (!admin) return response(403, { error: "Only admins can update status" });

        if (body.status) {
            expr += ", #status = :status";
            vals[":status"] = body.status;
            names["#status"] = "status";
            if (["RESOLVED", "CLOSED"].includes(body.status)) {
                expr += ", resolvedAt = :now";
            }
        }
        if (body.assignedTo !== undefined) {
            expr += ", assignedTo = :assignedTo";
            vals[":assignedTo"] = body.assignedTo;
        }

        await ddb.send(new UpdateCommand({
            TableName: TABLE, Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" },
            UpdateExpression: expr, ExpressionAttributeValues: vals,
            ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names })
        }));

        return response(200, { message: "Request updated", requestId });
    } catch (err) {
        return response(500, { error: "Internal server error" });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
export const slaCheckerHandler = async () => {
    const now = new Date().toISOString();
    let totalBreaches = 0;
    const breachesByPriority: Record<string, number> = { EMERGENCY: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const status of ["OPEN", "IN_PROGRESS", "ON_HOLD"]) {
        let lastKey: Record<string, unknown> | undefined;
        do {
            const result = await ddb.send(new QueryCommand({
                TableName: TABLE, IndexName: "StatusIndex",
                KeyConditionExpression: "#s = :s AND slaDeadline <= :now",
                ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":s": status, ":now": now },
                ExclusiveStartKey: lastKey,
            }));
            for (const item of result.Items ?? []) {
                totalBreaches++;
                breachesByPriority[item.priority] = (breachesByPriority[item.priority] ?? 0) + 1;
            }
            lastKey = result.LastEvaluatedKey as typeof lastKey;
        } while (lastKey);
    }

    if (totalBreaches > 0 && process.env.SNS_TOPIC_ARN) {
        const summary = Object.entries(breachesByPriority)
            .filter(([, count]) => count > 0)
            .map(([priority, count]) => `  ${priority}: ${count}`)
            .join("\n");

        await snsClient.send(new PublishCommand({
            TopicArn: process.env.SNS_TOPIC_ARN,
            Subject: `⚠️ SLA Breach Alert: ${totalBreaches} overdue request(s)`,
            Message: `SLA Breach Report — ${now}\n\nTotal breached requests: ${totalBreaches}\n\nBy priority:\n${summary}`,
        }));
    }

    return { breachCount: totalBreaches, breachesByPriority };
};

// ═════════════════════════════════════════════════════════════════════════════
export const postConfirmHandler = async (event: any) => {
    try {
        await cognitoClient.send(new AdminAddUserToGroupCommand({
            UserPoolId: event.userPoolId, Username: event.userName, GroupName: "residents",
        }));
    } catch (err) {} // Do NOT rethrow — Cognito must receive the event back
    return event;
};