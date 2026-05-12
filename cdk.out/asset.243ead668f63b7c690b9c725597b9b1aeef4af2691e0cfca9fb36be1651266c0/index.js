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

// lambda/postConfirm.ts
var postConfirm_exports = {};
__export(postConfirm_exports, {
  handler: () => postConfirmHandler
});
module.exports = __toCommonJS(postConfirm_exports);

// lambda/handlers.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var SLA_HOURS = JSON.parse(
  process.env.SLA_HOURS_JSON ?? '{"EMERGENCY":4,"HIGH":24,"MEDIUM":48,"LOW":168}'
);
var ddbClient = new import_client_dynamodb.DynamoDBClient({});
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });
var cognitoClient = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({});
var TABLE = process.env.TABLE_NAME;
var postConfirmHandler = async (event) => {
  try {
    await cognitoClient.send(new import_client_cognito_identity_provider.AdminAddUserToGroupCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      GroupName: "residents"
    }));
  } catch (err) {
  }
  return event;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
