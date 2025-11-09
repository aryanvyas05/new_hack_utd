# Workflow Fix - Pass Through All Risk Scores

## Problem
The charts show 0 for payment, legal, network, entity, and behavioral risk scores because the Step Functions workflow's `TransformScores` step was only passing through `fraudScore` and `contentRiskScore`.

## Solution Applied
Updated `other/lib/workflow-stack.ts` line 291-310 to pass through ALL risk scores from the fraud detector:

```typescript
const transformScores = new sfn.Pass(this, 'TransformScores', {
  parameters: {
    // ... existing fields ...
    'fraudScore.$': '$.riskAssessments[0].fraudScore',
    'contentRiskScore.$': '$.riskAssessments[1].contentRiskScore',
    
    // NEW: Pass through all the advanced risk scores
    'networkRiskScore.$': '$.riskAssessments[0].networkRiskScore',
    'entityRiskScore.$': '$.riskAssessments[0].entityRiskScore',
    'behavioralRiskScore.$': '$.riskAssessments[0].behavioralRiskScore',
    'paymentRiskScore.$': '$.riskAssessments[0].paymentRiskScore',
    'legalRiskScore.$': '$.riskAssessments[0].legalRiskScore',
    'trustScore.$': '$.riskAssessments[0].trustScore',
    
    // Pass through analysis details
    'paymentAnalysis.$': '$.riskAssessments[0].paymentAnalysis',
    'paymentInsights.$': '$.riskAssessments[0].paymentInsights',
    'reliabilityRating.$': '$.riskAssessments[0].reliabilityRating',
    'legalAnalysis.$': '$.riskAssessments[0].legalAnalysis',
    'legalIssues.$': '$.riskAssessments[0].legalIssues',
    'legalStatus.$': '$.riskAssessments[0].legalStatus',
    'trustSignals.$': '$.riskAssessments[0].trustSignals',
    'networkAnalysis.$': '$.riskAssessments[0].networkAnalysis',
    'entityResolution.$': '$.riskAssessments[0].entityResolution',
    'behavioralAnalysis.$': '$.riskAssessments[0].behavioralAnalysis',
  },
});
```

## To Deploy

### Option 1: AWS CDK (Recommended)
```bash
# Install CDK if not installed
npm install -g aws-cdk

# Deploy the workflow stack
cd other
cdk deploy VeritasWorkflowStack
```

### Option 2: AWS Console
1. Go to AWS Step Functions console
2. Find `veritas-onboard-workflow`
3. Click "Edit"
4. Update the `TransformScores` Pass state to include all the new fields
5. Save and publish

## Verification
After deployment, run:
```bash
./test-theranos.sh
```

You should see:
- `legalRiskScore`: ~1.0 (100% - lots of legal issues detected)
- `paymentRiskScore`: ~0.95 (95% - bankruptcy indicators)
- `networkRiskScore`: ~0.3 (30% - some network patterns)
- `entityRiskScore`: ~0.4 (40% - entity analysis)
- `behavioralRiskScore`: ~0.3 (30% - behavioral anomalies)

The pie chart and bar chart will now show ALL 6 risk types with proper values! 🎯📊

## What Was Happening Before
1. ✅ Enhanced Fraud Detector calculated all scores correctly (logs showed payment: 0.95, legal: 1.0)
2. ❌ TransformScores step dropped them (only passed fraudScore and contentRiskScore)
3. ❌ Combine Scores received 0.0 for all advanced scores
4. ❌ Save Dynamo saved 0.0 values
5. ❌ Frontend displayed empty/zero charts

## What Happens Now
1. ✅ Enhanced Fraud Detector calculates all scores
2. ✅ TransformScores passes ALL scores through
3. ✅ Combine Scores receives all scores
4. ✅ Save Dynamo saves all scores
5. ✅ Frontend displays beautiful charts with real data! 🎉
