# 📊 Viewing New Payment & Legal Heuristics

## ✅ What's Working

Your new discriminative heuristics are now fully integrated:

### 💳 Payment History Analysis
- Business age detection
- Bankruptcy indicators
- Financial stability keywords
- Payment terms analysis
- Credit profile simulation
- **Risk Score:** 0-1.0 scale
- **Output:** Payment insights with risk levels

### ⚖️ Legal Records Checking
- Criminal records detection
- Civil lawsuit indicators
- Regulatory violations (SEC, FTC, FDA, etc.)
- Fraud keywords
- Court case extraction
- Monetary judgment detection
- **Risk Score:** 0-1.0 scale
- **Output:** Legal issues with severity ratings

## 🔍 How to See Them on the Website

### Option 1: Use the Enhanced Page (With Pie Charts!)

The enhanced page at `/status/[requestId]/enhanced-page.tsx` shows:
- ✅ Pie charts for risk distribution
- ✅ Payment insights section
- ✅ Legal issues section
- ✅ All 7 risk scores (fraud, network, entity, behavioral, payment, legal, trust)

**To use it:** Navigate to `/status/YOUR_REQUEST_ID/enhanced` (you may need to update routing)

### Option 2: Current Status Page

The current status page at `/status/[requestId]/page.tsx` already displays:
- All risk scores in the data
- Risk factors
- Trust signals

The data is there, it just needs the UI components to display payment and legal sections.

## 🧪 Test Results

### Theranos Example:

**Legal Analysis:**
```json
{
  "legalRiskScore": 1.0,
  "legalStatus": "CRITICAL_ISSUES",
  "legalIssues": [
    {
      "category": "CRIMINAL",
      "keyword": "convicted",
      "severity": 1.0
    },
    {
      "category": "FRAUD",
      "keyword": "fraud",
      "severity": 0.95
    }
  ]
}
```

**Payment Analysis:**
```json
{
  "paymentRiskScore": 0.95,
  "reliabilityRating": "HIGH_RISK",
  "paymentRiskFactors": [
    "bankruptcy_bankruptcy",
    "established_business"
  ]
}
```

## 🚀 Quick Fix to See Data Now

### Add to Current Status Page

Add these sections to `frontend/app/status/[requestId]/page.tsx`:

```tsx
{/* Payment Insights */}
{status.paymentInsights && status.paymentInsights.length > 0 && (
  <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">💳 Payment Analysis</h2>
    <div className="space-y-3">
      {status.paymentInsights.map((insight, index) => (
        <div key={index} className="border-l-4 pl-4 py-2" style={{
          borderColor: insight.risk === 'HIGH' ? '#ef4444' : 
                       insight.risk === 'MEDIUM' ? '#f59e0b' : '#10b981'
        }}>
          <div className="font-semibold">{insight.type}</div>
          <div className="text-sm text-gray-600">{insight.message}</div>
          <div className="text-sm font-medium">{insight.value}</div>
        </div>
      ))}
    </div>
    <div className="mt-4 text-sm">
      <strong>Payment Risk Score:</strong> {(status.paymentRiskScore * 100).toFixed(0)}%
      <br />
      <strong>Reliability Rating:</strong> {status.reliabilityRating}
    </div>
  </div>
)}

{/* Legal Issues */}
{status.legalIssues && status.legalIssues.length > 0 && (
  <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">⚖️ Legal Issues</h2>
    <div className="space-y-3">
      {status.legalIssues.map((issue, index) => (
        <div key={index} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50">
          <div className="font-semibold text-red-900">{issue.category}</div>
          <div className="text-sm text-red-700">Keyword: {issue.keyword}</div>
          {issue.context && (
            <div className="text-sm text-gray-600 mt-1 italic">{issue.context}</div>
          )}
          <div className="text-sm font-medium text-red-600 mt-1">
            Severity: {(issue.severity * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
    <div className="mt-4 text-sm">
      <strong>Legal Risk Score:</strong> {(status.legalRiskScore * 100).toFixed(0)}%
      <br />
      <strong>Legal Status:</strong> {status.legalStatus}
    </div>
  </div>
)}
```

## 📊 Data Flow

```
User submits "Theranos" →
API Gateway →
Step Functions Workflow →
Advanced Risk Orchestrator →
  ├─ Network Analysis
  ├─ Entity Resolution
  ├─ Behavioral Analysis
  ├─ Payment History ← NEW!
  └─ Legal Records ← NEW!
→ Save to DynamoDB →
Frontend displays all 7 risk scores + insights
```

## 🎯 What You'll See for Theranos

1. **Legal Risk Score:** 100% (CRITICAL)
   - Detected: "convicted", "fraud", "SEC charges", "bankruptcy"
   - Status: CRITICAL_ISSUES

2. **Payment Risk Score:** 95% (HIGH_RISK)
   - Detected: Bankruptcy filing
   - Reliability: HIGH_RISK

3. **Entity Risk Score:** High
   - Negative news keywords detected

4. **Overall Risk:** BLOCKED/MANUAL_REVIEW

## 🔧 Current Status

- ✅ Lambda functions deployed
- ✅ Orchestrator updated to call new functions
- ✅ save-dynamo updated to store new data
- ✅ Enhanced page created with pie charts
- ⚠️ Need to add UI components to current status page OR
- ⚠️ Route users to enhanced page

## 🚀 Next Steps

1. **Quick Win:** Copy the code above into your current status page
2. **Better:** Use the enhanced-page.tsx with pie charts
3. **Best:** Create a tabbed interface showing all analyses

The data is flowing through the system - you just need to display it!
