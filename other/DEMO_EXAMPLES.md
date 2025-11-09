# 🎯 Demo Examples - Risk Scoring

## How It Works

Your system uses **pattern-based risk detection** for demo purposes:

1. **Fraud Detector**: Analyzes vendor name, email, and description for risk keywords
2. **Comprehend**: Analyzes sentiment (negative = higher risk)
3. **Combined Score**: `(Fraud × 0.7) + (Content × 0.3)`
4. **Threshold**: > 80% → Manual Review, ≤ 80% → Auto-Approved

---

## ✅ LOW RISK - Auto-Approved

### Example 1: Enterprise Vendor
```
Vendor Name: Acme Corporation
Email: contact@acme.com
Description: We are an established enterprise software provider with certified solutions
Tax ID: 12-3456789
```
**Expected**: Fraud Score ~15%, Auto-APPROVED

### Example 2: Trusted Partner
```
Vendor Name: TechCorp Solutions
Email: info@techcorp.com
Description: Trusted technology partner providing enterprise consulting services
Tax ID: 23-4567890
```
**Expected**: Fraud Score ~15%, Auto-APPROVED

---

## ⚠️ MEDIUM RISK - Auto-Approved (but higher scores)

### Example 3: Startup
```
Vendor Name: Beta Innovations
Email: hello@betainnovations.com
Description: We are a new startup in beta testing phase
Tax ID: 34-5678901
```
**Expected**: Fraud Score ~45%, Auto-APPROVED

### Example 4: Unverified
```
Vendor Name: Unknown Services LLC
Email: contact@unknownservices.com
Description: Temporary vendor providing unverified services
Tax ID: 45-6789012
```
**Expected**: Fraud Score ~65%, Auto-APPROVED

---

## 🚨 HIGH RISK - Manual Review

### Example 5: Suspicious Vendor
```
Vendor Name: Suspicious Vendor LLC
Email: admin@suspicious-vendor.com
Description: This is a test high-risk vendor for demonstration purposes
Tax ID: 99-9999999
```
**Expected**: Fraud Score ~90%, **MANUAL REVIEW**

### Example 6: Fraud Keywords
```
Vendor Name: QuickCash Services
Email: fraud@scamsite.com
Description: Fake company with suspicious business practices
Tax ID: 88-8888888
```
**Expected**: Fraud Score ~90%, **MANUAL REVIEW**

---

## 🎬 Demo Script

### Show Low Risk (30 seconds)
1. Submit "Acme Corporation" example
2. Show: APPROVED, Low scores (~15%)
3. Say: "Legitimate vendor approved automatically"

### Show High Risk (30 seconds)
1. Submit "Suspicious Vendor LLC" example
2. Show: MANUAL REVIEW, High scores (~90%)
3. Say: "High-risk vendor flagged for manual review"

### Explain the AI (1 minute)
"The system analyzes:
- **Keywords**: Suspicious terms trigger higher scores
- **Sentiment**: Negative language increases risk
- **Patterns**: Email domains, business descriptions
- **Threshold**: Above 80% goes to manual review

In production, you'd train this on historical fraud data. For the demo, we're using pattern matching to showcase the workflow."

---

## 💡 Key Talking Points

1. **"The architecture is production-ready"** - Real AWS services, real workflow
2. **"Pattern detection works now"** - Demonstrates the concept
3. **"Extensible with ML"** - Can plug in trained models
4. **"Complete automation"** - Low risk auto-approved, high risk flagged

---

## 🎯 What Judges Care About

- ✅ Does it work? **YES**
- ✅ Is it intelligent? **YES** (pattern-based + sentiment analysis)
- ✅ Is it scalable? **YES** (serverless AWS)
- ✅ Is it complete? **YES** (end-to-end workflow)

**You have a working system. That's what wins.** 🏆
