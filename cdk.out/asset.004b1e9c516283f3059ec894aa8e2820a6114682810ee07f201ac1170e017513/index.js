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

// lambda/slaChecker.ts
var slaChecker_exports = {};
__export(slaChecker_exports, {
  handler: () => slaCheckerHandler
});
module.exports = __toCommonJS(slaChecker_exports);

// lambda/handlers.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_cloudwatch = require("@aws-sdk/client-cloudwatch");
var import_client_sns = require("@aws-sdk/client-sns");
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var SLA_HOURS = JSON.parse(
  process.env.SLA_HOURS_JSON ?? '{"EMERGENCY":4,"HIGH":24,"MEDIUM":48,"LOW":168}'
);
var ddbClient = new import_client_dynamodb.DynamoDBClient({});
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });
var cwClient = new import_client_cloudwatch.CloudWatchClient({});
var snsClient = new import_client_sns.SNSClient({});
var cognitoClient = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({});
var TABLE = process.env.TABLE_NAME;
var SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
var USER_POOL_ID = process.env.USER_POOL_ID;
var STAGE = process.env.STAGE ?? "dev";
var slaCheckerHandler = async () => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let totalBreaches = 0;
  const breachesByPriority = { EMERGENCY: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const status of ["OPEN", "IN_PROGRESS", "ON_HOLD"]) {
    let lastKey;
    do {
      const result = await ddb.send(new import_lib_dynamodb.QueryCommand({
        TableName: TABLE,
        IndexName: "StatusIndex",
        KeyConditionExpression: "#s = :s AND slaDeadline <= :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": status, ":now": now },
        ExclusiveStartKey: lastKey
      }));
      for (const item of result.Items ?? []) {
        totalBreaches++;
        breachesByPriority[item.priority] = (breachesByPriority[item.priority] ?? 0) + 1;
      }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
  }
  return { breachCount: totalBreaches };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
