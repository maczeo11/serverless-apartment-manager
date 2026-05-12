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

// lambda/updateRequest.ts
var updateRequest_exports = {};
__export(updateRequest_exports, {
  handler: () => updateRequestHandler
});
module.exports = __toCommonJS(updateRequest_exports);

// lambda/handlers.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_cloudwatch = require("@aws-sdk/client-cloudwatch");
var import_client_sns = require("@aws-sdk/client-sns");
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var import_crypto = require("crypto");
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
var updateRequestHandler = async (event) => {
  try {
    const callerId = getCallerId(event);
    const admin = isAdmin(event);
    const requestId = event.pathParameters?.id;
    const isCommentPath = event.resource?.includes("comments");
    if (!requestId) return response(400, { error: "Missing request ID" });
    const body = JSON.parse(event.body ?? "{}");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await ddb.send(new import_lib_dynamodb.GetCommand({ TableName: TABLE, Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" } }));
    if (!existing.Item) return response(404, { error: "Request not found" });
    if (!admin && existing.Item.residentId !== callerId) return response(403, { error: "Access denied" });
    let expr = "SET updatedAt = :now";
    const vals = { ":now": now };
    const names = {};
    if (body.comment) {
      const commentObj = { id: (0, import_crypto.randomUUID)(), author: callerId, role: admin ? "admin" : "resident", text: body.comment, createdAt: now };
      expr += ", comments = list_append(if_not_exists(comments, :empty), :c)";
      vals[":c"] = [commentObj];
      vals[":empty"] = [];
    }
    if (isCommentPath) {
      if (!body.comment) return response(400, { error: "comment is required" });
      await ddb.send(new import_lib_dynamodb.UpdateCommand({ TableName: TABLE, Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" }, UpdateExpression: expr, ExpressionAttributeValues: vals }));
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
    if (body.assignedTo !== void 0) {
      expr += ", assignedTo = :assignedTo";
      vals[":assignedTo"] = body.assignedTo;
    }
    await ddb.send(new import_lib_dynamodb.UpdateCommand({
      TableName: TABLE,
      Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" },
      UpdateExpression: expr,
      ExpressionAttributeValues: vals,
      ...Object.keys(names).length > 0 && { ExpressionAttributeNames: names }
    }));
    return response(200, { message: "Request updated", requestId });
  } catch (err) {
    return response(500, { error: "Internal server error" });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
