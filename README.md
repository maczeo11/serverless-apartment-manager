# Serverless Apartment Maintenance Portal

A full-stack, serverless apartment maintenance management system built on AWS. This application allows residents to submit maintenance requests and administrators to triage, assign, and resolve them efficiently. It features automated SLA (Service Level Agreement) tracking and role-based access control.

## 🚀 Features

*   **Role-Based Access Control (RBAC):** Distinct portals for Residents and Administrators using Amazon Cognito groups.
*   **Automated SLA Tracking:** EventBridge triggers a Lambda function every 15 minutes to identify and flag requests that have breached their SLA deadlines based on priority.
*   **Real-time Status Tracking:** Residents can monitor the status of their requests (Open, In Progress, Resolved, etc.).
*   **Serverless Architecture:** Fully managed, auto-scaling infrastructure ensuring zero idle costs.
*   **Infrastructure as Code (IaC):** 100% of the AWS infrastructure is provisioned using AWS Cloud Development Kit (CDK).

## 🛠️ Technology Stack

*   **Infrastructure:** AWS CDK (TypeScript)
*   **Compute:** AWS Lambda (Node.js)
*   **Database:** Amazon DynamoDB (Single-table design)
*   **Authentication:** Amazon Cognito (User Pools)
*   **API:** Amazon API Gateway (REST API)
*   **Frontend Hosting:** Amazon S3 Static Website Hosting
*   **Automation:** Amazon EventBridge (Cron jobs)
*   **Frontend Framework:** React (Vite) + AWS Amplify

## 📋 Prerequisites

Before deploying this project, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
*   [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)

## ⚙️ Deployment Instructions

1.  **Clone the repository and install dependencies:**

    ```bash
    git clone <your-repo-url>
    cd apartment-maintenance-portal
    npm install
    cd portal
    npm install
    cd ..
    ```

2.  **Bootstrap the CDK environment (if first time using CDK in this account/region):**

    ```bash
    npx cdk bootstrap
    ```

3.  **Deploy the backend stack:**

    ```bash
    npx cdk deploy
    ```
    *Note: The CLI will output the `ApiEndpoint`, `UserPoolId`, and `UserPoolClientId` upon successful deployment.*

4.  **Configure the Frontend:**
    Create a `.env` file in the `portal/` directory with the outputs from the CDK deployment:
    ```env
    VITE_API_URL=<ApiEndpoint>
    VITE_COGNITO_USER_POOL_ID=<UserPoolId>
    VITE_COGNITO_CLIENT_ID=<UserPoolClientId>
    ```

5.  **Build and deploy the frontend:**
    ```bash
    cd portal
    npm run build
    # Sync the dist folder to the deployed S3 bucket
    aws s3 sync dist/ s3://<your-s3-bucket-name>
    ```

## 🔐 Authentication Flow

1.  Users sign up via the React portal.
2.  Upon email verification, a Cognito Post-Confirmation Lambda trigger automatically assigns new users to the `residents` group.
3.  Administrators must be manually added to the `admins` Cognito group via the AWS Console or CLI.

## 🗄️ Database Design

The application uses a Single-Table Design in Amazon DynamoDB.
*   **Primary Key:** `PK` (Request ID), `SK` (Metadata)
*   **Global Secondary Indexes (GSIs):**
    *   `ResidentIndex`: For residents to query their own requests quickly.
    *   `StatusIndex`: For admins and the SLA checker to query requests by their current status and deadline.
