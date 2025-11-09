# 🚀 Quick Start Guide

## What You Have Now

✅ **Intelligent fraud detection** with real domain/email validation  
✅ **Clean, professional UI** (minimal & aesthetic)  
✅ **Robust error handling** (no crashes on bad data)  
✅ **Production-ready** AWS architecture  

## Start the System

### 1. Start Frontend (Terminal 1)
```bash
cd frontend
npm run dev
```

Frontend will be at: **http://localhost:3000**

### 2. Test the System (Terminal 2)
```bash
./test-enhanced-system.sh
```

This will test 3 scenarios:
- ✅ Legitimate company (Google) → Low risk, auto-approved
- ⚠️ Suspicious company → High risk, manual review
- 🚫 Non-existent company → Very high risk, manual review

## Manual Testing

### Test Case 1: Legitimate Company (Should Auto-Approve)
```
Company Name: Microsoft Corporation
Email: partnerships@microsoft.com
Description: Established enterprise software and cloud computing company providing Windows, Office, Azure, and other business solutions. Certified and licensed technology leader.
Tax ID: 12-3456789
```
**Expected:** ~10-15% fraud risk → APPROVED

### Test Case 2: Suspicious Company (Should Flag)
```
Company Name: QuickProfit LLC
Email: admin@tempmail.com
Description: Urgent investment opportunity! Guaranteed returns of 500%! Limited time offer! Act now before this expires!
Tax ID: 98-7654321
```
**Expected:** ~85-90% fraud risk → MANUAL_REVIEW

### Test Case 3: Non-Existent Company (Should Reject)
```
Company Name: FakeVendor XYZ
Email: test@nonexistentdomain99999.com
Description: Test company
Tax ID: 11-1111111
```
**Expected:** ~95%+ fraud risk → MANUAL_REVIEW

## How It Works

### Fraud Detection Logic

**Domain Validation:**
- ✅ Checks MX records (email server exists)
- ✅ Verifies website exists (HTTP/HTTPS)
- ✅ Detects suspicious TLDs (.tk, .ml, etc.)

**Email Analysis:**
- ✅ Flags disposable emails (tempmail, guerrillamail)
- ✅ Detects free emails for business (gmail, yahoo)
- ✅ Validates domain matches company name

**Content Analysis:**
- ✅ Detects fraud keywords (scam, ponzi, fake)
- ✅ Identifies urgency tactics (limited time, act now)
- ✅ Recognizes legitimate indicators (established, certified)

### Risk Scoring
- **0-20%**: Low risk → AUTO-APPROVED
- **20-50%**: Medium risk → AUTO-APPROVED (with monitoring)
- **50-70%**: Medium-high risk → MANUAL_REVIEW
- **70-100%**: High risk → MANUAL_REVIEW

## Demo Flow

1. **Home Page** → Show clean design and AWS architecture
2. **Submit Google** → Show fast approval with low risk
3. **Submit Suspicious** → Show high risk detection
4. **Status Page** → Show professional risk visualization
5. **Explain Intelligence** → Domain validation, email checks, content analysis

## Troubleshooting

### Frontend won't start
```bash
cd frontend
npm install
npm run dev
```

### Lambda not updated
```bash
cd lambda/fraud-detector
pip3 install dnspython -t .
zip -r fraud-detector-enhanced.zip . -x "*.md" -x "*.sh"
aws lambda update-function-code --function-name veritas-onboard-fraud-detector --zip-file fileb://fraud-detector-enhanced.zip
```

### API not responding
Check API Gateway URL:
```bash
aws apigateway get-rest-apis --query "items[?name=='veritas-onboard-api'].id" --output text
```

## What Makes This Special

🎯 **No training data needed** - Uses intelligent heuristics  
🎯 **Works for any company** - No hardcoded lists  
🎯 **Real validation** - DNS, HTTP, email checks  
🎯 **Professional UI** - Clean, minimal, aesthetic  
🎯 **Production-ready** - Error handling, scalability  

---

**You're ready to demo!** 🎉
