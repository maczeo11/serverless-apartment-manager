"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/getRequests.ts
var getRequests_exports = {};
__export(getRequests_exports, {
  handler: () => getRequestsHandler
});
module.exports = __toCommonJS(getRequests_exports);

// lambda/handlers.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_cloudwatch = require("@aws-sdk/client-cloudwatch");
var import_client_sns = require("@aws-sdk/client-sns");
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var SLA_HOURS = JSON.parse(
  process.env.SLA_HOURS_JSON ?? '{"EMERGENCY":4,"HIGH":24,"MEDIUM":48,"LOW":168}'
);
function getCallerGroups(event) {
  const claims = event.requestContext?.authorizer?.claims ?? {};
  const groups = claims["cognito:groups"] ?? "";
  return groups ? groups.split(",") : [];
}
function isAdmin(event) {
  return getCallerGroups(event).includes("admins");
}
function getCallerId(event) {
  const claims = event.requestContext?.authorizer?.claims ?? {};
  return claims["sub"] ?? claims["username"] ?? "unknown";
}
function isSlaBreached(slaDeadline, status) {
  if (["RESOLVED", "CLOSED", "CANCELLED"].includes(status)) return false;
  return new Date(slaDeadline) < /* @__PURE__ */ new Date();
}
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
      // FIX: Removed Access-Control-Allow-Credentials to comply with wildcard origin
    },
    body: JSON.stringify(body)
  };
}
var ddbClient = new import_client_dynamodb.DynamoDBClient({});
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });
var cwClient = new import_client_cloudwatch.CloudWatchClient({});
var snsClient = new import_client_sns.SNSClient({});
var cognitoClient = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({});
var TABLE = process.env.TABLE_NAME;
var SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
var USER_POOL_ID = process.env.USER_POOL_ID;
var STAGE = process.env.STAGE ?? "dev";
var getRequestsHandler = async (event) => {
  try {
    const callerId = getCallerId(event);
    const admin = isAdmin(event);
    const requestId = event.pathParameters?.id;
    if (requestId) {
      const result2 = await ddb.send(new import_lib_dynamodb.GetCommand({ TableName: TABLE, Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" } }));
      if (!result2.Item) return response(404, { error: "Request not found" });
      if (!admin && result2.Item.residentId !== callerId) return response(403, { error: "Access denied" });
      return response(200, { ...result2.Item, slaBreached: isSlaBreached(result2.Item.slaDeadline, result2.Item.status) });
    }
    const qs = event.queryStringParameters ?? {};
    const limit = Math.min(parseInt(qs.limit ?? "20"), 100);
    let startKey = void 0;
    if (qs.nextToken) {
      try {
        startKey = JSON.parse(Buffer.from(qs.nextToken, "base64").toString());
      } catch (e) {
        return response(400, { error: "Invalid pagination token" });
      }
    }
    const indexName = admin ? "StatusIndex" : "ResidentIndex";
    const keyExpr = admin ? "#s = :val" : "residentId = :val";
    const exprVals = admin ? { ":val": qs.status ?? "OPEN" } : { ":val": callerId };
    const exprNames = admin ? { "#s": "status" } : void 0;
    const result = await ddb.send(
      new import_lib_dynamodb.QueryCommand({
        TableName: TABLE,
        IndexName: indexName,
        KeyConditionExpression: keyExpr,
        ExpressionAttributeValues: exprVals,
        ...exprNames && { ExpressionAttributeNames: exprNames },
        Limit: limit,
        ScanIndexForward: admin,
        ExclusiveStartKey: startKey
      })
    );
    return response(200, {
      items: result.Items?.map((i) => ({ ...i, slaBreached: isSlaBreached(i.slaDeadline, i.status) })),
      nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") : null
    });
  } catch (err) {
    return response(500, { error: "Internal server error" });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
