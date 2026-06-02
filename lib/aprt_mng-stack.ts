import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';

import * as iam from 'aws-cdk-lib/aws-iam';

import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as fs from 'fs';

import { join } from 'path';

export const SLA_HOURS: Record<string, number> = {
  EMERGENCY: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 168,
};

export interface MaintenanceTrackerProps extends cdk.StackProps {
  alertEmail: string;
  stage: 'dev' | 'staging' | 'prod';
}

export class MaintenanceTrackerStack extends cdk.Stack {
  public readonly apiUrl!: string;
  public readonly portalUrl!: string;
  public readonly userPoolId!: string;
  public readonly userPoolClientId!: string;

  constructor(scope: Construct, id: string, props: MaintenanceTrackerProps) {
    super(scope, id, props);

    const { alertEmail, stage } = props;

    const isProd = stage === 'prod';

    // SNS
    const slaBreachTopic = new sns.Topic(this, 'SlaBreachTopic', {
      topicName: `maintenance-sla-breach-${stage}`,
    });

    slaBreachTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(alertEmail),
    );

    // DynamoDB
    const requestsTable = new dynamodb.Table(this, 'RequestsTable', {
      tableName: `maintenance-requests-${stage}`,

      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },

      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },

      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      timeToLiveAttribute: 'ttl',

      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    requestsTable.addGlobalSecondaryIndex({
      indexName: 'ResidentIndex',

      partitionKey: {
        name: 'residentId',
        type: dynamodb.AttributeType.STRING,
      },

      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    requestsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',

      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },

      sortKey: {
        name: 'slaDeadline',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Cognito
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `maintenance-tracker-${stage}`,

      selfSignUpEnabled: true,

      signInAliases: {
        email: true,
        username: false,
      },

      autoVerify: {
        email: true,
      },
    });

    new cognito.CfnUserPoolGroup(this, 'ResidentsGroup', {
      userPoolId: userPool.userPoolId,

      groupName: 'residents',
    });

    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      userPoolId: userPool.userPoolId,

      groupName: 'admins',
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'PortalClient', {
      userPool,

      userPoolClientName: `portal-${stage}`,

      authFlows: {
        userSrp: true,
      },
    });

    // Lambdas
    const commonEnv = {
      TABLE_NAME: requestsTable.tableName,

      SLA_HOURS_JSON: JSON.stringify(SLA_HOURS),
    };

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_22_X,

      environment: commonEnv,
    };

    const createRequestFn = new NodejsFunction(this, 'CreateFn', {
      ...lambdaDefaults,

      entry: join(__dirname, '../lambda/createRequest.ts'),

      handler: 'handler',
    });

    const getRequestsFn = new NodejsFunction(this, 'GetFn', {
      ...lambdaDefaults,

      entry: join(__dirname, '../lambda/getRequests.ts'),

      handler: 'handler',
    });

    const updateRequestFn = new NodejsFunction(this, 'UpdateFn', {
      ...lambdaDefaults,

      entry: join(__dirname, '../lambda/updateRequest.ts'),

      handler: 'handler',
    });

    const slaCheckerFn = new NodejsFunction(this, 'SlaFn', {
      ...lambdaDefaults,

      entry: join(__dirname, '../lambda/slaChecker.ts'),

      handler: 'handler',

      environment: {
        ...commonEnv,
        SNS_TOPIC_ARN: slaBreachTopic.topicArn,
      },
    });

    slaBreachTopic.grantPublish(slaCheckerFn);

    const postConfirmFn = new NodejsFunction(this, 'PostConfirmFn', {
      ...lambdaDefaults,

      entry: join(__dirname, '../lambda/postConfirm.ts'),

      handler: 'handler',
    });

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,

      postConfirmFn,
    );

    requestsTable.grantWriteData(createRequestFn);

    requestsTable.grantReadData(getRequestsFn);

    requestsTable.grantReadWriteData(updateRequestFn);

    requestsTable.grantReadData(slaCheckerFn);

    postConfirmFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminAddUserToGroup'],

        resources: [`arn:aws:cognito-idp:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:userpool/*`],
      }),
    );

    // EventBridge
    new events.Rule(this, 'SlaRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),

      targets: [new eventsTargets.LambdaFunction(slaCheckerFn)],
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'Api', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,

        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'Auth', {
      cognitoUserPools: [userPool],
    });

    const authOpts = {
      authorizer: auth,

      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    const apiRoot = api.root.addResource('api');

    const reqs = apiRoot.addResource('requests');

    reqs.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createRequestFn),
      authOpts,
    );

    reqs.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getRequestsFn),
      authOpts,
    );

    const reqById = reqs.addResource('{id}');

    reqById.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getRequestsFn),
      authOpts,
    );

    reqById.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updateRequestFn),
      authOpts,
    );

    const reqComments = reqById.addResource('comments');

    reqComments.addMethod(
      'POST',
      new apigateway.LambdaIntegration(updateRequestFn),
      authOpts,
    );

    const portalBucket = new s3.Bucket(this, 'PortalBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'PortalDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(portalBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        }
      ]
    });

    new s3deploy.BucketDeployment(this, 'PortalDeploy', {
      sources: [
        s3deploy.Source.asset(join(__dirname, '../portal'), {
          bundling: {
            image: cdk.DockerImage.fromRegistry('node:22'),
            local: {
              tryBundle(outputDir: string) {
                try {
                  const portalDir = join(__dirname, '../portal');
                  const { execSync } = require('child_process');
                  execSync('npm install', { cwd: portalDir, stdio: 'ignore' });
                  execSync('npm run build', { cwd: portalDir, stdio: 'ignore' });
                  fs.cpSync(join(portalDir, 'dist'), outputDir, { recursive: true });
                  return true;
                } catch (e) {
                  return false;
                }
              }
            }
          }
        })
      ],
      destinationBucket: portalBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Assign public properties
    this.apiUrl = api.url;
    this.portalUrl = portalBucket.bucketWebsiteUrl;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'PortalUrl', {
      value: `https://${distribution.domainName}`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
  }
}
