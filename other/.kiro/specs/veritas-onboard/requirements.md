# Requirements Document

## Introduction

Veritas Onboard is a serverless, AI-powered onboarding platform built on AWS that streamlines vendor and client onboarding while providing robust fraud detection, PII protection, and compliance management. The system replaces manual, fragmented onboarding processes with an automated, intelligent workflow that reduces operational costs, enhances security, and mitigates fraud risks.

## Glossary

- **Onboarding System**: The complete Veritas Onboard platform including frontend portal, API, workflow engine, and AI services
- **Onboarding Request**: A single vendor or client onboarding submission containing business information and documentation
- **Risk Score**: A numerical value (0.0 to 1.0) representing the fraud risk level of an onboarding request
- **PII**: Personally Identifiable Information including SSN, credit card numbers, phone numbers, and email addresses
- **Workflow Engine**: AWS Step Functions state machine that orchestrates the onboarding process
- **Fraud Detection Service**: Amazon Fraud Detector service configured with New Account Fraud model
- **Sentiment Analysis Service**: Amazon Comprehend service for analyzing business description text
- **Portal**: React-based web application for submitting onboarding requests
- **Admin Dashboard**: QuickSight-based reporting interface for leadership oversight
- **Auto-Approval Threshold**: Risk score below 0.8 that allows automatic approval
- **Manual Review Queue**: Collection of onboarding requests with risk scores above 0.8

## Requirements

### Requirement 1

**User Story:** As a vendor or client, I want to submit my business information through a secure web portal, so that I can initiate the onboarding process without manual paperwork

#### Acceptance Criteria

1. THE Onboarding System SHALL provide a web-based Portal accessible via HTTPS
2. WHEN a user accesses the Portal, THE Onboarding System SHALL authenticate the user via Amazon Cognito
3. THE Portal SHALL display a dynamic form requesting vendor name, contact email, business description, and tax identification number
4. WHEN a user submits the onboarding form, THE Onboarding System SHALL validate all required fields are present
5. WHEN form validation succeeds, THE Portal SHALL transmit the data to the API Gateway via secure REST API call

### Requirement 2

**User Story:** As a security officer, I want all PII automatically detected and masked before storage, so that we maintain data privacy compliance

#### Acceptance Criteria

1. WHEN an Onboarding Request is received, THE Workflow Engine SHALL invoke the PII redaction function before any other processing
2. THE Onboarding System SHALL detect Social Security Numbers matching the pattern XXX-XX-XXXX
3. THE Onboarding System SHALL detect credit card numbers with 13-19 consecutive digits
4. THE Onboarding System SHALL detect phone numbers matching North American format patterns
5. WHEN PII is detected, THE Onboarding System SHALL replace sensitive digits with asterisks while preserving the last 4 characters

### Requirement 3

**User Story:** As a fraud prevention analyst, I want real-time fraud risk scoring on all onboarding requests, so that we can identify and block fraudulent entities

#### Acceptance Criteria

1. WHEN an Onboarding Request enters the workflow, THE Workflow Engine SHALL invoke the Fraud Detection Service in parallel with sentiment analysis
2. THE Onboarding System SHALL pass IP address, email domain, and business information to the Fraud Detection Service
3. THE Fraud Detection Service SHALL return a fraud risk score between 0.0 and 1.0
4. WHEN the Fraud Detection Service is unavailable, THE Onboarding System SHALL log the error and assign a default risk score of 0.5
5. THE Onboarding System SHALL store the fraud risk score with the Onboarding Request record

### Requirement 4

**User Story:** As a compliance manager, I want business descriptions analyzed for risky content and negative sentiment, so that we can identify potentially problematic partnerships

#### Acceptance Criteria

1. WHEN an Onboarding Request contains a business description, THE Workflow Engine SHALL invoke the Sentiment Analysis Service
2. THE Sentiment Analysis Service SHALL analyze the business description text and return sentiment scores
3. THE Sentiment Analysis Service SHALL extract key phrases from the business description
4. THE Onboarding System SHALL calculate a content risk score based on negative sentiment and risky key phrases
5. WHEN sentiment analysis fails, THE Onboarding System SHALL log the error and assign a default content risk score of 0.0

### Requirement 5

**User Story:** As a risk manager, I want combined risk scores to determine approval routing, so that high-risk requests receive manual review while low-risk requests are auto-approved

#### Acceptance Criteria

1. WHEN both fraud detection and sentiment analysis complete, THE Workflow Engine SHALL invoke a risk combination function
2. THE Onboarding System SHALL calculate a combined risk score as the weighted average of fraud score (70%) and content risk score (30%)
3. WHEN the combined risk score exceeds 0.8, THE Workflow Engine SHALL route the Onboarding Request to the Manual Review Queue
4. WHEN the combined risk score is 0.8 or below, THE Workflow Engine SHALL automatically approve the Onboarding Request
5. THE Onboarding System SHALL update the Onboarding Request status in the database with the final decision

### Requirement 6

**User Story:** As an administrator, I want to receive notifications for high-risk onboarding requests, so that I can promptly review and make approval decisions

#### Acceptance Criteria

1. WHEN an Onboarding Request is routed to manual review, THE Onboarding System SHALL publish a notification to the admin notification topic
2. THE notification SHALL include the request ID, vendor name, combined risk score, and submission timestamp
3. THE Onboarding System SHALL deliver notifications via Amazon SNS to subscribed administrators
4. WHEN notification delivery fails, THE Onboarding System SHALL log the failure and continue workflow execution
5. THE Onboarding System SHALL record the notification timestamp in the audit trail

### Requirement 7

**User Story:** As a database administrator, I want all onboarding data stored in a scalable NoSQL database, so that we can handle high volumes and query by various attributes

#### Acceptance Criteria

1. THE Onboarding System SHALL store all Onboarding Request records in Amazon DynamoDB
2. THE database table SHALL use request ID as the primary partition key
3. THE database table SHALL include a Global Secondary Index on status field for querying by approval state
4. WHEN saving an Onboarding Request, THE Onboarding System SHALL include timestamps for creation, last update, and status changes
5. THE Onboarding System SHALL store the complete audit trail including all risk scores and workflow decisions

### Requirement 8

**User Story:** As an executive, I want a real-time dashboard showing onboarding metrics and risk trends, so that I can monitor program effectiveness and identify issues

#### Acceptance Criteria

1. THE Admin Dashboard SHALL connect to the DynamoDB table as its data source
2. THE Admin Dashboard SHALL display total onboarding requests by status (pending, approved, manual review, rejected)
3. THE Admin Dashboard SHALL visualize risk score distribution across all requests
4. THE Admin Dashboard SHALL show time-series trends of onboarding volume and approval rates
5. WHEN data is updated in DynamoDB, THE Admin Dashboard SHALL reflect changes within 5 minutes

### Requirement 9

**User Story:** As a security engineer, I want the API protected against common web attacks, so that our system remains secure against malicious actors

#### Acceptance Criteria

1. THE Onboarding System SHALL deploy AWS WAF in front of the API Gateway
2. THE AWS WAF SHALL include rules to block SQL injection attempts
3. THE AWS WAF SHALL include rules to block cross-site scripting (XSS) attempts
4. THE AWS WAF SHALL rate-limit requests to 100 requests per 5 minutes per IP address
5. WHEN AWS WAF blocks a request, THE Onboarding System SHALL log the blocked request details for security analysis

### Requirement 10

**User Story:** As a DevOps engineer, I want all infrastructure defined as code using AWS CDK, so that we can version control, review, and deploy the system consistently

#### Acceptance Criteria

1. THE Onboarding System infrastructure SHALL be defined using AWS CDK in TypeScript
2. THE CDK code SHALL be organized into separate stacks for Amplify, API, database, and workflow components
3. THE CDK code SHALL define all IAM roles and policies following least-privilege principles
4. WHEN deploying via CDK, THE Onboarding System SHALL create all resources in the correct dependency order
5. THE CDK code SHALL export key resource identifiers (API endpoint, table name, Cognito pool ID) as CloudFormation outputs
