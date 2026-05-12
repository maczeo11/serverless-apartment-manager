#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MaintenanceTrackerStack } from '../lib/aprt_mng-stack';

const app = new cdk.App();
new MaintenanceTrackerStack(app, 'MaintenanceTrackerStack', {
    alertEmail: process.env.ALERT_EMAIL ?? 'you@example.com',
    stage: (process.env.STAGE as 'dev' | 'staging' | 'prod') ?? 'dev',
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});