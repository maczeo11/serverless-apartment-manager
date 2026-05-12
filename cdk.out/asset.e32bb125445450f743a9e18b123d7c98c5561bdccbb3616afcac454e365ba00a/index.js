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

// lambda/createRequest.ts
var createRequest_exports = {};
__export(createRequest_exports, {
  handler: () => createRequestHandler
});
module.exports = __toCommonJS(createRequest_exports);

// lambda/handlers.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var import_crypto = require("crypto");
var SLA_HOURS = JSON.parse(
  process.env.SLA_HOURS_JSON ?? '{"EMERGENCY":4,"HIGH":24,"MEDIUM":48,"LOW":168}'
);
var ddbClient = new import_client_dynamodb.DynamoDBClient({});
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });
var cognitoClient = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({});
var TABLE = process.env.TABLE_NAME;
function getCallerId(event) {
  const claims = event.requestContext?.authorizer?.claims ?? {};
  return claims["sub"] ?? claims["username"] ?? "unknown";
}
function slaDeadlineISO(priority) {
  const hours = SLA_HOURS[priority] ?? 48;
  return new Date(Date.now() + hours * 36e5).toISOString();
}
function ttlEpoch(slaDeadlineISO2) {
  return Math.floor(new Date(slaDeadlineISO2).getTime() / 1e3) + 30 * 86400;
}
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
var createRequestHandler = async (event) => {
  try {
    const callerId = getCallerId(event);
    const body = JSON.parse(event.body ?? "{}");
    const { title, description, category, priority = "MEDIUM", unitNumber, building, attachmentUrls = [] } = body;
    if (!title || !description || !category || !unitNumber) return response(400, { error: "Missing required fields" });
    const validPriorities = ["EMERGENCY", "HIGH", "MEDIUM", "LOW"];
    if (!validPriorities.includes(priority)) return response(400, { error: "Invalid priority" });
    const requestId = (0, import_crypto.randomUUID)();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const slaDeadline = slaDeadlineISO(priority);
    const item = {
      PK: `REQUEST#${requestId}`,
      SK: "METADATA",
      requestId,
      title,
      description,
      category,
      priority,
      status: "OPEN",
      residentId: callerId,
      unitNumber,
      building: building ?? "",
      attachmentUrls,
      slaDeadline,
      slaHours: SLA_HOURS[priority],
      createdAt,
      updatedAt: createdAt,
      ttl: ttlEpoch(slaDeadline),
      comments: [],
      assignedTo: null,
      resolvedAt: null
    };
    await ddb.send(new import_lib_dynamodb.PutCommand({ TableName: TABLE, Item: item }));
    return response(201, { requestId, slaDeadline, message: "Request created" });
  } catch (err) {
    return response(500, { error: "Internal server error" });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
