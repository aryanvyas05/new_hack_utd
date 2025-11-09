# 🚨 CRITICAL ISSUE FOUND

## The Problem

The Step Functions workflow has HARDCODED the payload to save-dynamo in the AutoApprove and ManualReview states.

It ONLY passes:
- requestId
- vendorName  
- contactEmail
- businessDescription
- taxId
- sourceIp
- submittedAt
- fraudScore
- contentRiskScore
- combinedRiskScore
- recommendation
- status

It does NOT pass:
- networkRiskScore ❌
- entityRiskScore ❌
- behavioralRiskScore ❌
- **paymentRiskScore** ❌
- **legalRiskScore** ❌
- trustScore ❌
- paymentAnalysis ❌
- legalAnalysis ❌
- paymentInsights ❌
- legalIssues ❌

## The Data Flow

1. fraud-detector returns ALL fields ✅
2. combine-scores passes ALL fields ✅  
3. Step Functions AutoApprove state STRIPS them ❌
4. save-dynamo only gets basic fields ❌
5. DynamoDB has zeros ❌

## The Solution

We need to update the Step Functions workflow to pass `"Payload.$": "$"` instead of the hardcoded payload.

This requires either:
1. Updating the CDK code and redeploying (takes 5-10 minutes)
2. Manually editing the Step Functions state machine in AWS Console (2 minutes)

## Quick Manual Fix

1. Go to AWS Console → Step Functions
2. Open `veritas-onboard-workflow`
3. Click "Edit"
4. Find the AutoApprove state
5. Change the Payload from the hardcoded object to: `"Payload.$": "$"`
6. Do the same for ManualReview state
7. Save

This will pass ALL fields through!
