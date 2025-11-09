# Veritas Onboard - Design Document

## Overview

Veritas Onboard is a serverless, event-driven onboarding platform built entirely on AWS services. The architecture follows a microservices pattern where each component is loosely coupled and communicates through managed AWS services. The system processes onboarding requests through an automated workflow that includes PII redaction, parallel AI-based risk assessment, intelligent routing, and comprehensive audit logging.

### Key Design Principles

1. **Serverless-First**: No EC2 instances or containers; all compute via Lambda and managed services
2. **Event-Driven**: Step Functions orchestrates asynchronous workflows
3. **Security by Default**: WAF protection, Cognito authentication, IAM least-privilege, PII masking
4. **AI-Powered**: Amazon Fraud Detector and Comprehend provide intelligent risk assessment
5. **Scalable**: DynamoDB and Lambda auto-scale to handle variable load
6. **Observable**: CloudWatch logs and metrics at every layer; QuickSight for business intelligence

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  React/Next.js Portal (AWS Amplify Hosting)                  │  │
│  │  - Dynamic Forms  - Amplify UI Components  - Auth UI         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Amazon Cognito User Pool                                     │  │
│  │  - User Registration  - Login  - JWT Tokens                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ JWT Token
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AWS WAF → API Gateway (REST)                                 │  │
│  │  - SQL Injection Rules  - XSS Rules  - Rate Limiting          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ POST /onboard
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATION LAYER                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Lambda: Start Workflow                                       │  │
│  │  - Validate Input  - Generate Request ID  - Start Step Fn    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                  │                                   │
│                                  ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AWS Step Functions State Machine                             │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ 1. Redact PII                                           │  │  │
│  │  │ 2. Parallel: [Fraud Detection | Sentiment Analysis]    │  │  │
│  │  │ 3. Combine Risk Scores                                  │  │  │
│  │  │ 4. Choice: Score > 0.8 ? Manual Review : Auto-Approve  │  │  │
│  │  │ 5. Save to DynamoDB                                     │  │  │
│  │  │ 6. Notify (if manual review)                            │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│      AI/ML SERVICES          │  │     DATA & NOTIFICATION      │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ Amazon Fraud Detector  │  │  │  │  Amazon DynamoDB       │  │
│  │ - New Account Model    │  │  │  │  - OnboardingRequests  │  │
│  │ - Risk Score 0.0-1.0   │  │  │  │  - GSI on Status       │  │
│  └────────────────────────┘  │  │  └────────────────────────┘  │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ Amazon Comprehend      │  │  │  │  Amazon SNS            │  │
│  │ - Sentiment Analysis   │  │  │  │  - Admin Notifications │  │
│  │ - Key Phrase Extract   │  │  │  └────────────────────────┘  │
│  └────────────────────────┘  │  └──────────────────────────────┘
└──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ANALYTICS LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Amazon QuickSight Dashboard                                  │  │
│  │  - Onboarding Metrics  - Risk Trends  - Approval Rates        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Flow

1. User accesses Portal → Cognito authenticates → JWT token issued
2. User submits form → Portal calls API Gateway with JWT
3. API Gateway validates JWT → WAF checks for attacks → Routes to Start Lambda
4. Start Lambda validates input → Generates UUID → Starts Step Functions execution
5. Step Functions executes workflow:
   - **Step 1**: Redact PII Lambda masks sensitive data
   - **Step 2**: Parallel execution of Fraud Detector Lambda and Comprehend Lambda
   - **Step 3**: Combine Scores Lambda calculates weighted risk score
   - **Step 4**: Choice state routes based on score threshold
   - **Step 5**: Save Lambda writes to DynamoDB
   - **Step 6**: Notify Lambda sends SNS alert (if manual review)
6. API returns request ID to Portal
7. QuickSight queries DynamoDB for dashboard updates

## Components and Interfaces

### 1. Frontend Portal (React/Next.js)

**Technology Stack:**
- Next.js 14 (App Router)
- AWS Amplify (v6) for hosting and auth integration
- Amplify UI React components
- TypeScript

**Key Pages:**
- `/` - Landing page with login/signup
- `/onboard` - Main onboarding form
- `/status/[requestId]` - Check onboarding status

**API Client Interface:**
```typescript
interface OnboardingRequest {
  vendorName: string;
  contactEmail: string;
  businessDescription: string;
  taxId: string;
}

interface OnboardingResponse {
  requestId: string;
  status: 'SUBMITTED';
  message: string;
}

// API Client
async function submitOnboarding(data: OnboardingRequest): Promise<OnboardingResponse>
```

### 2. API Gateway

**Endpoints:**
- `POST /onboard` - Submit new onboarding request
  - Auth: Cognito JWT required
  - Request body: OnboardingRequest JSON
  - Response: 202 Accepted with requestId
- `GET /status/{requestId}` - Query onboarding status
  - Auth: Cognito JWT required
  - Response: Current status and risk score

**WAF Rules:**
- AWS Managed Rules: Core Rule Set (SQL injection, XSS)
- Rate-based rule: 100 requests per 5 minutes per IP
- Geo-blocking: Optional (can restrict to specific countries)

### 3. Lambda Functions

#### 3.1 Start Workflow Lambda
**Runtime:** Python 3.12  
**Memory:** 256 MB  
**Timeout:** 30 seconds

**Input:**
```json
{
  "vendorName": "string",
  "contactEmail": "string",
  "businessDescription": "string",
  "taxId": "string",
  "sourceIp": "string"
}
```

**Output:**
```json
{
  "statusCode": 202,
  "body": {
    "requestId": "uuid",
    "status": "SUBMITTED"
  }
}
```

**Responsibilities:**
- Validate required fields
- Generate UUID for request
- Capture source IP from API Gateway context
- Start Step Functions execution
- Return request ID immediately

#### 3.2 Redact PII Lambda
**Runtime:** Python 3.12  
**Memory:** 512 MB  
**Timeout:** 60 seconds

**Input:** Complete onboarding request object

**Output:** Same object with PII fields masked

**PII Detection Patterns:**
- SSN: `\d{3}-\d{2}-\d{4}` → `***-**-1234`
- Credit Card: `\d{13,19}` → `************1234`
- Phone: `\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}` → `***-***-1234`
- Email: Preserve domain, mask local part → `a***@example.com`

#### 3.3 Fraud Detector Lambda
**Runtime:** Python 3.12  
**Memory:** 512 MB  
**Timeout:** 60 seconds

**Input:**
```json
{
  "requestId": "uuid",
  "email": "string",
  "ipAddress": "string",
  "vendorName": "string"
}
```

**Output:**
```json
{
  "fraudScore": 0.75,
  "modelVersion": "1.0",
  "riskFactors": ["high_risk_ip", "suspicious_email_domain"]
}
```

**Fraud Detector Configuration:**
- Model: New Account Fraud (Online Fraud Insights)
- Variables: email_address, ip_address, account_name
- Outcome: fraud_score (0.0 - 1.0)

#### 3.4 Comprehend Lambda
**Runtime:** Python 3.12  
**Memory:** 512 MB  
**Timeout:** 60 seconds

**Input:**
```json
{
  "requestId": "uuid",
  "businessDescription": "string"
}
```

**Output:**
```json
{
  "sentimentScore": 0.35,
  "sentiment": "NEGATIVE",
  "keyPhrases": ["high risk", "offshore accounts"],
  "contentRiskScore": 0.45
}
```

**Risk Calculation Logic:**
- NEGATIVE sentiment: +0.4 to risk score
- MIXED sentiment: +0.2 to risk score
- Risky key phrases (e.g., "money laundering", "offshore", "shell company"): +0.1 each (max +0.3)
- Final content risk score: min(1.0, sum of above)

#### 3.5 Combine Scores Lambda
**Runtime:** Python 3.12  
**Memory:** 256 MB  
**Timeout:** 30 seconds

**Input:**
```json
{
  "fraudScore": 0.75,
  "contentRiskScore": 0.45
}
```

**Output:**
```json
{
  "combinedRiskScore": 0.66,
  "recommendation": "AUTO_APPROVE"
}
```

**Formula:**
```
combinedRiskScore = (fraudScore * 0.7) + (contentRiskScore * 0.3)
recommendation = "MANUAL_REVIEW" if score > 0.8 else "AUTO_APPROVE"
```

#### 3.6 Save to DynamoDB Lambda
**Runtime:** Python 3.12  
**Memory:** 256 MB  
**Timeout:** 30 seconds

**Responsibilities:**
- Write complete onboarding record to DynamoDB
- Include all risk scores, timestamps, and audit trail
- Update status based on recommendation

#### 3.7 Notify Admin Lambda
**Runtime:** Python 3.12  
**Memory:** 256 MB  
**Timeout:** 30 seconds

**Responsibilities:**
- Publish SNS message to admin topic
- Include request ID, vendor name, risk score
- Format message for email/SMS delivery

### 4. Step Functions State Machine

**State Machine Definition (Amazon States Language):**

```json
{
  "Comment": "Veritas Onboard Workflow",
  "StartAt": "RedactPII",
  "States": {
    "RedactPII": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:RedactPIIFunction",
      "ResultPath": "$.redactedData",
      "Next": "ParallelRiskAssessment"
    },
    "ParallelRiskAssessment": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "CheckFraudDetector",
          "States": {
            "CheckFraudDetector": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:FraudDetectorFunction",
              "ResultPath": "$.fraudResult",
              "End": true
            }
          }
        },
        {
          "StartAt": "CheckComprehend",
          "States": {
            "CheckComprehend": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:ComprehendFunction",
              "ResultPath": "$.comprehendResult",
              "End": true
            }
          }
        }
      ],
      "ResultPath": "$.riskAssessments",
      "Next": "CombineScores"
    },
    "CombineScores": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:CombineScoresFunction",
      "ResultPath": "$.finalRisk",
      "Next": "EvaluateRisk"
    },
    "EvaluateRisk": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.finalRisk.combinedRiskScore",
          "NumericGreaterThan": 0.8,
          "Next": "ManualReview"
        }
      ],
      "Default": "AutoApprove"
    },
    "ManualReview": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:SaveToDynamoFunction",
      "Parameters": {
        "status": "MANUAL_REVIEW",
        "data.$": "$"
      },
      "Next": "NotifyAdmin"
    },
    "NotifyAdmin": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:NotifyAdminFunction",
      "End": true
    },
    "AutoApprove": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:SaveToDynamoFunction",
      "Parameters": {
        "status": "APPROVED",
        "data.$": "$"
      },
      "End": true
    }
  }
}
```

### 5. AWS CDK Stack Organization

**Stack Structure:**
```
veritas-onboard-cdk/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── amplify-stack.ts          # Frontend + Cognito
│   ├── api-stack.ts              # API Gateway + WAF + Start Lambda
│   ├── database-stack.ts         # DynamoDB table
│   ├── workflow-stack.ts         # Step Functions + All workflow Lambdas
│   └── monitoring-stack.ts       # CloudWatch dashboards (optional)
└── lambda/
    ├── start-workflow/
    ├── redact-pii/
    ├── fraud-detector/
    ├── comprehend/
    ├── combine-scores/
    ├── save-dynamo/
    └── notify-admin/
```

**Stack Dependencies:**
1. Database Stack (no dependencies)
2. Workflow Stack (depends on Database)
3. API Stack (depends on Workflow)
4. Amplify Stack (depends on API)

## Data Models

### DynamoDB Table: OnboardingRequests

**Table Configuration:**
- Table Name: `OnboardingRequests`
- Partition Key: `requestId` (String)
- Billing Mode: PAY_PER_REQUEST (on-demand)
- Point-in-time Recovery: Enabled
- Encryption: AWS managed key

**Global Secondary Index:**
- Index Name: `StatusIndex`
- Partition Key: `status` (String)
- Sort Key: `createdAt` (Number - Unix timestamp)
- Projection: ALL

**Item Schema:**
```json
{
  "requestId": "uuid",
  "status": "SUBMITTED | APPROVED | MANUAL_REVIEW | REJECTED",
  "vendorName": "string (PII redacted)",
  "contactEmail": "string (PII redacted)",
  "businessDescription": "string",
  "taxId": "string (PII redacted)",
  "sourceIp": "string",
  "createdAt": 1699564800,
  "updatedAt": 1699564900,
  "riskScores": {
    "fraudScore": 0.75,
    "contentRiskScore": 0.45,
    "combinedRiskScore": 0.66
  },
  "fraudDetails": {
    "modelVersion": "1.0",
    "riskFactors": ["array"]
  },
  "sentimentDetails": {
    "sentiment": "NEGATIVE",
    "keyPhrases": ["array"]
  },
  "auditTrail": [
    {
      "timestamp": 1699564800,
      "action": "SUBMITTED",
      "actor": "user@example.com"
    },
    {
      "timestamp": 1699564850,
      "action": "PII_REDACTED",
      "actor": "system"
    }
  ]
}
```

### Cognito User Pool

**Configuration:**
- Sign-in: Email
- Password Policy: Minimum 8 characters, require uppercase, lowercase, number, symbol
- MFA: Optional (TOTP)
- Email Verification: Required
- User Attributes: email (required), name (optional)

**App Client:**
- Auth Flows: USER_SRP_AUTH, REFRESH_TOKEN_AUTH
- Token Expiration: Access token 1 hour, Refresh token 30 days
- OAuth Flows: Implicit grant (for Amplify)

## Error Handling

### Lambda Error Handling Strategy

**Retry Policy:**
- All Lambda functions in Step Functions: 2 retries with exponential backoff
- Interval: 2 seconds
- Backoff Rate: 2.0
- Max Interval: 10 seconds

**Catch Blocks:**
- Each Lambda task has a Catch block for `States.ALL`
- On error: Log to CloudWatch, set status to ERROR, save to DynamoDB, end execution

**Specific Error Scenarios:**

1. **Fraud Detector API Failure:**
   - Catch error in Lambda
   - Assign default fraud score of 0.5
   - Log warning to CloudWatch
   - Continue workflow

2. **Comprehend API Failure:**
   - Catch error in Lambda
   - Assign default content risk score of 0.0
   - Log warning to CloudWatch
   - Continue workflow

3. **DynamoDB Write Failure:**
   - Retry 3 times with exponential backoff
   - If still fails: Log error, send alert to SNS dead-letter topic
   - Do not fail the workflow (eventual consistency)

4. **SNS Notification Failure:**
   - Log error to CloudWatch
   - Do not block workflow completion
   - Admin can check CloudWatch logs for missed notifications

### API Gateway Error Responses

- 400 Bad Request: Invalid input format
- 401 Unauthorized: Missing or invalid JWT token
- 403 Forbidden: WAF blocked request
- 429 Too Many Requests: Rate limit exceeded
- 500 Internal Server Error: Lambda execution failure
- 503 Service Unavailable: Step Functions throttling

## Testing Strategy

### Unit Testing

**Lambda Functions:**
- Framework: pytest (Python), Jest (TypeScript)
- Mock AWS SDK calls using moto (Python) or aws-sdk-mock (TypeScript)
- Test coverage target: 80%

**Test Cases per Lambda:**
1. Happy path with valid input
2. Invalid input handling
3. AWS service error handling
4. Timeout simulation
5. Edge cases (empty strings, special characters, etc.)

### Integration Testing

**API Gateway + Lambda:**
- Use AWS SAM Local or LocalStack
- Test complete request flow from API to Lambda
- Verify JWT validation
- Test WAF rule triggering

**Step Functions:**
- Use Step Functions Local
- Test complete workflow execution
- Test parallel branch execution
- Test choice state logic with different risk scores
- Test error handling and retries

### End-to-End Testing

**Full System Test:**
1. Deploy to dedicated test AWS account
2. Use Cypress or Playwright for frontend testing
3. Submit test onboarding requests with known risk profiles
4. Verify correct routing (auto-approve vs manual review)
5. Verify DynamoDB records
6. Verify SNS notifications

**Test Data Sets:**
- Low risk: Legitimate business, clean IP, positive sentiment
- High risk: Suspicious email, known fraud IP, negative sentiment
- Edge cases: Missing optional fields, very long descriptions, special characters

### Load Testing

**Tools:** Artillery or Locust

**Scenarios:**
- Baseline: 10 requests/second for 5 minutes
- Peak: 100 requests/second for 1 minute
- Sustained: 50 requests/second for 30 minutes

**Metrics to Monitor:**
- API Gateway latency (target: p99 < 1000ms)
- Lambda duration (target: p99 < 5000ms)
- Step Functions execution time (target: p99 < 30 seconds)
- DynamoDB throttling (target: 0 throttled requests)
- Error rate (target: < 0.1%)

### Security Testing

**Automated Scans:**
- OWASP ZAP against API Gateway
- npm audit / pip-audit for dependency vulnerabilities
- AWS Security Hub for infrastructure compliance

**Manual Testing:**
- Attempt SQL injection through form fields
- Attempt XSS through business description
- Test rate limiting by exceeding threshold
- Verify PII is properly masked in DynamoDB
- Verify IAM roles follow least privilege

## Deployment Strategy

### CI/CD Pipeline

**Tool:** AWS CodePipeline or GitHub Actions

**Stages:**
1. **Source:** Trigger on git push to main branch
2. **Build:**
   - Install dependencies (npm, pip)
   - Run linters (eslint, pylint)
   - Run unit tests
   - Build CDK assets
3. **Test:**
   - Deploy to test environment
   - Run integration tests
   - Run security scans
4. **Deploy:**
   - Deploy to production via CDK
   - Run smoke tests
   - Monitor CloudWatch alarms

### Environment Strategy

**Environments:**
- `dev`: Developer sandbox, auto-deploy on feature branch
- `test`: Integration testing, auto-deploy on main branch
- `prod`: Production, manual approval required

**Environment Configuration:**
- Use CDK context for environment-specific values
- Store secrets in AWS Secrets Manager
- Use separate AWS accounts for prod isolation

### Rollback Strategy

- CloudFormation stack rollback on deployment failure
- Keep previous Lambda versions for 7 days
- Blue/green deployment for API Gateway stages
- DynamoDB point-in-time recovery for data issues

## Monitoring and Observability

### CloudWatch Metrics

**Lambda Metrics:**
- Invocations, Errors, Duration, Throttles
- Custom metric: PII patterns detected count

**API Gateway Metrics:**
- Count, Latency, 4XXError, 5XXError
- Custom metric: WAF blocked requests

**Step Functions Metrics:**
- ExecutionsStarted, ExecutionsSucceeded, ExecutionsFailed
- ExecutionTime

**DynamoDB Metrics:**
- ConsumedReadCapacityUnits, ConsumedWriteCapacityUnits
- UserErrors, SystemErrors

### CloudWatch Alarms

**Critical Alarms (PagerDuty):**
- API Gateway 5XX error rate > 1% for 5 minutes
- Step Functions execution failure rate > 5% for 5 minutes
- Lambda error rate > 5% for 5 minutes

**Warning Alarms (Email):**
- API Gateway latency p99 > 2000ms for 10 minutes
- DynamoDB throttling events > 0 for 5 minutes
- Lambda concurrent executions > 80% of limit

### Logging Strategy

**Log Levels:**
- ERROR: Unrecoverable errors requiring investigation
- WARN: Recoverable errors (e.g., Fraud Detector timeout)
- INFO: Key business events (submission, approval, manual review)
- DEBUG: Detailed execution information (disabled in prod)

**Structured Logging:**
```json
{
  "timestamp": "2024-11-09T12:00:00Z",
  "level": "INFO",
  "requestId": "uuid",
  "service": "fraud-detector-lambda",
  "message": "Fraud score calculated",
  "fraudScore": 0.75,
  "executionTime": 234
}
```

**Log Retention:**
- Production: 90 days
- Test: 30 days
- Dev: 7 days

### Distributed Tracing

**AWS X-Ray:**
- Enable on all Lambda functions
- Enable on API Gateway
- Enable on Step Functions
- Trace complete request flow from API to DynamoDB

## Security Considerations

### IAM Roles and Policies

**Principle:** Least privilege for all roles

**Lambda Execution Roles:**
- Redact PII: CloudWatch Logs write only
- Fraud Detector: CloudWatch Logs + Fraud Detector read
- Comprehend: CloudWatch Logs + Comprehend read
- Save DynamoDB: CloudWatch Logs + DynamoDB write to specific table
- Notify Admin: CloudWatch Logs + SNS publish to specific topic

**API Gateway Role:**
- Invoke specific Lambda function only

**Step Functions Role:**
- Invoke specific Lambda functions only
- CloudWatch Logs write

### Data Encryption

**At Rest:**
- DynamoDB: AWS managed encryption key
- CloudWatch Logs: Encrypted by default
- S3 (if used for large files): SSE-S3 or SSE-KMS

**In Transit:**
- All API calls: HTTPS/TLS 1.2+
- Internal AWS service calls: Encrypted by default

### Secrets Management

**AWS Secrets Manager:**
- Fraud Detector API keys (if needed)
- Third-party API keys
- Database credentials (if RDS used in future)

**Rotation:**
- Automatic rotation every 90 days
- Lambda functions retrieve secrets at runtime

### Compliance

**GDPR Considerations:**
- PII redaction before storage
- Right to erasure: Implement delete API
- Data retention: Implement TTL on DynamoDB items

**SOC 2 Considerations:**
- Audit trail for all actions
- Access logging enabled
- Regular security assessments

## Cost Optimization

### Estimated Monthly Costs (1000 requests/day)

- API Gateway: ~$3.50 (1M requests)
- Lambda: ~$5.00 (30K invocations, 512MB, 3s avg)
- Step Functions: ~$25.00 (30K executions)
- DynamoDB: ~$2.50 (on-demand, 30K writes, 10K reads)
- Fraud Detector: ~$75.00 (30K predictions at $2.50/1000)
- Comprehend: ~$15.00 (30K sentiment + key phrase calls)
- Cognito: Free tier (< 50K MAU)
- Amplify: ~$15.00 (hosting + build minutes)
- QuickSight: ~$24.00 (2 authors)
- **Total: ~$165/month**

### Cost Optimization Strategies

1. **Lambda:** Right-size memory allocation based on profiling
2. **DynamoDB:** Use on-demand for variable traffic; switch to provisioned if traffic becomes predictable
3. **Fraud Detector:** Batch predictions if real-time not required
4. **Comprehend:** Cache sentiment results for duplicate descriptions
5. **CloudWatch Logs:** Implement log filtering to reduce ingestion costs
6. **S3:** Use Intelligent-Tiering for any stored documents

## Future Enhancements

### Phase 2 Features

1. **Document Upload:** S3 + Textract for document verification
2. **Multi-step Approval:** Workflow for multiple approvers
3. **Integration APIs:** Webhooks to notify external systems
4. **Advanced Analytics:** Athena queries on DynamoDB exports
5. **Mobile App:** React Native app using same backend

### Scalability Improvements

1. **Caching:** ElastiCache for frequently accessed data
2. **CDN:** CloudFront for static assets
3. **Global:** Multi-region deployment for international users
4. **Async Processing:** SQS for decoupling if needed

### AI/ML Enhancements

1. **Custom Fraud Model:** Train on historical data
2. **Document Classification:** Comprehend custom classifier
3. **Anomaly Detection:** SageMaker for pattern detection
4. **Predictive Analytics:** Forecast onboarding volume
