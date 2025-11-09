# 📊 How to See Your New Pie Charts & Heuristics

## ✅ What's Done

1. **Backend:** Payment & Legal analysis Lambdas are deployed and working
2. **Frontend:** Pie charts and bar charts added to status page
3. **Data Flow:** save-dynamo and query-status updated to pass all data

## 🎯 To See It Working

### Step 1: Make Sure Frontend is Running
```bash
cd frontend
npm run dev
```

### Step 2: Submit a Test (Theranos)
Go to: `http://localhost:3000`

Fill in:
- **Vendor Name:** Theranos Inc
- **Contact Email:** contact@theranos.com  
- **Business Description:** 
```
Theranos was a health technology company founded in 2003 that claimed to revolutionize blood testing. The company faced fraud charges from the SEC in 2018. CEO Elizabeth Holmes was convicted of fraud in federal court in 2022. The company filed for bankruptcy and shut down operations after investigations revealed the technology did not work as claimed.
```
- **Tax ID:** 12-3456789

### Step 3: View Results
After submission, you'll be redirected to the status page.

**You should now see:**
- ✅ **Pie Chart** showing risk distribution across all 6 types
- ✅ **Bar Chart** showing individual risk scores
- ✅ **Payment Analysis Section** with insights
- ✅ **Legal Records Section** with detected issues

## 📊 What You'll See for Theranos

### Pie Chart Will Show:
- Fraud Risk: ~39%
- Legal Risk: ~100% (RED - CRITICAL!)
- Payment Risk: ~95% (bankruptcy detected)
- Entity Risk: High
- Network Risk: Medium
- Behavioral Risk: Medium

### Legal Section Will Show:
- **Legal Status:** CRITICAL_ISSUES
- **Legal Risk Score:** 100%
- **Issues Detected:**
  - CRIMINAL: "convicted" (Severity: 100%)
  - FRAUD: "fraud" (Severity: 95%)
  - FRAUD: "SEC charges" (Severity: 95%)

### Payment Section Will Show:
- **Payment Risk Score:** 95%
- **Reliability Rating:** HIGH_RISK
- **Insights:**
  - Bankruptcy filing detected
  - Business age indicators

## 🔍 Troubleshooting

### If Charts Don't Show:
1. Check browser console for errors
2. Make sure Recharts is installed: `cd frontend && npm install recharts`
3. Refresh the page

### If Payment/Legal Sections Don't Show:
1. Wait 10-15 seconds after submission (workflow takes time)
2. Click "Refresh Status" button
3. Check that the new Lambdas are being called

### If Data is Missing:
The data flows like this:
```
Submit → Step Functions → Advanced Orchestrator → 
  Calls 5 Lambdas (network, entity, behavioral, payment, legal) →
  save-dynamo stores all data →
  query-status returns it →
  Frontend displays with charts
```

## 🎨 What the Charts Look Like

**Pie Chart:** Circular chart showing percentage of each risk type
**Bar Chart:** Vertical bars for each risk category with color coding
**Payment Section:** Blue-themed with insights cards
**Legal Section:** Red-themed with issue cards showing severity

## 🚀 Quick Test Command

```bash
# From project root
curl -X POST "https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Theranos Inc",
    "contactEmail": "contact@theranos.com",
    "businessDescription": "Theranos faced fraud charges from the SEC. Elizabeth Holmes was convicted of fraud. The company filed for bankruptcy.",
    "taxId": "12-3456789",
    "sourceIp": "192.168.1.1"
  }'
```

Then check the status page with the returned requestId!

## ✨ You're All Set!

Your KYC system now has:
- 📊 Beautiful pie charts
- 📈 Bar charts for risk breakdown
- 💳 Payment history analysis
- ⚖️ Legal records checking
- 🎨 Color-coded risk indicators
- 📱 Responsive design

**Just submit "Theranos" and watch the magic happen!** 🎉
