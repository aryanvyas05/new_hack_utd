# 🔐 Complete Authentication System Demo Guide

## Overview
Veritas uses a **JWT-based authentication system** with secure password hashing (bcrypt) and API Gateway authorization.

---

## 🎯 Demo Flow

### Step 1: Register a New User

**Navigate to:** http://localhost:3001/register

**Demo Script:**
```
"First, let me show you our secure registration system. 
We'll create a new user account with email and password."
```

**Fill in the form:**
- Email: `demo@veritas.com`
- Password: `SecurePass123!`
- Confirm Password: `SecurePass123!`

**Click:** "Create Account"

**What happens behind the scenes:**
1. Frontend sends POST to `/auth/register`
2. `auth-handler` Lambda validates email format
3. Password is hashed with bcrypt (10 rounds)
4. User stored in DynamoDB `Users` table
5. JWT token generated and returned
6. Token stored in localStorage
7. User redirected to dashboard

**Show in browser console:**
```javascript
// Open DevTools (F12) → Console
localStorage.getItem('token')
// Shows: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Step 2: Logout

**Demo Script:**
```
"Now I'll log out to show the authentication flow."
```

**In browser console:**
```javascript
localStorage.removeItem('token')
location.reload()
```

**Or click logout button if available**

---

### Step 3: Login with Existing User

**Navigate to:** http://localhost:3001/login

**Demo Script:**
```
"Let's log back in with our credentials. 
The system will verify the password against the bcrypt hash."
```

**Fill in:**
- Email: `demo@veritas.com`
- Password: `SecurePass123!`

**Click:** "Sign In"

**What happens:**
1. Frontend sends POST to `/auth/login`
2. Lambda retrieves user from DynamoDB
3. bcrypt compares password with stored hash
4. If valid, generates new JWT token (24-hour expiry)
5. Token returned and stored
6. User authenticated

---

### Step 4: Make Authenticated API Call

**Demo Script:**
```
"Now that we're authenticated, let's submit a vendor onboarding request.
The API will validate our JWT token before processing."
```

**Navigate to:** http://localhost:3001/onboard

**Fill in the form:**
- Company Name: `Microsoft Corporation`
- Email: `contact@microsoft.com`
- Description: `Leading technology company established in 1975...`
- Tax ID: `91-1144442`

**Click:** "Submit Application"

**What happens:**
1. Frontend includes JWT in Authorization header:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
2. API Gateway triggers JWT Authorizer Lambda
3. Authorizer validates:
   - Token signature (HMAC-SHA256)
   - Token expiration
   - Token format
4. If valid, returns IAM policy (Allow)
5. Request proceeds to Step Functions workflow
6. Response returned with request ID

---

### Step 5: Demonstrate Token Expiration

**Demo Script:**
```
"Our tokens expire after 24 hours for security. 
Let me show what happens with an invalid token."
```

**In browser console:**
```javascript
// Set an invalid token
localStorage.setItem('token', 'invalid.token.here')

// Try to make a request
fetch('https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer invalid.token.here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    vendorName: 'Test',
    contactEmail: 'test@test.com',
    businessDescription: 'Test',
    taxId: '12-3456789'
  })
})
.then(r => r.json())
.then(console.log)
```

**Expected Response:**
```json
{
  "message": "Unauthorized"
}
```

---

## 🔍 Technical Deep Dive

### JWT Token Structure

**Decode a token:** https://jwt.io

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "user-uuid-here",
  "email": "demo@veritas.com",
  "iat": 1699545600,
  "exp": 1699632000
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  SECRET_KEY
)
```

---

### Password Security

**Hashing Process:**
```python
import bcrypt

# Registration
password = "SecurePass123!"
salt = bcrypt.gensalt(rounds=10)  # 2^10 = 1024 iterations
hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
# Result: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

# Login verification
is_valid = bcrypt.checkpw(password.encode('utf-8'), hashed)
# Returns: True or False
```

**Why bcrypt?**
- Adaptive: Can increase rounds as computers get faster
- Salt included: Each password has unique hash
- Slow by design: Prevents brute force attacks
- Industry standard: Used by major platforms

---

### API Gateway Authorization Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. Request + JWT Token
       ▼
┌─────────────────────┐
│   API Gateway       │
│  (REST API)         │
└──────┬──────────────┘
       │ 2. Trigger Authorizer
       ▼
┌─────────────────────┐
│ JWT Authorizer      │
│ Lambda              │
│                     │
│ • Decode token      │
│ • Verify signature  │
│ • Check expiration  │
└──────┬──────────────┘
       │ 3. Return IAM Policy
       ▼
┌─────────────────────┐
│ Allow/Deny          │
│                     │
│ If Allow:           │
│   → Execute Lambda  │
│   → Return response │
│                     │
│ If Deny:            │
│   → Return 401      │
└─────────────────────┘
```

---

## 🧪 Testing Authentication

### Test 1: Register New User
```bash
curl -X POST https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

**Expected Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "uuid-here",
    "email": "test@example.com"
  }
}
```

### Test 2: Login
```bash
curl -X POST https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

### Test 3: Authenticated Request
```bash
TOKEN="your-jwt-token-here"

curl -X POST https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Test Corp",
    "contactEmail": "test@testcorp.com",
    "businessDescription": "Test company",
    "taxId": "12-3456789"
  }'
```

### Test 4: Invalid Token
```bash
curl -X POST https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorName": "Test Corp",
    "contactEmail": "test@testcorp.com",
    "businessDescription": "Test company",
    "taxId": "12-3456789"
  }'
```

**Expected:** `{"message": "Unauthorized"}`

---

## 🎬 Demo Presentation Script

### Opening (30 seconds)
```
"Let me show you our enterprise-grade authentication system. 
We use JWT tokens with bcrypt password hashing - the same 
security standards used by companies like GitHub and Stripe."
```

### Registration Demo (1 minute)
```
"First, I'll register a new user. Watch how the system:
1. Validates the email format
2. Hashes the password with bcrypt - 10 rounds of salting
3. Stores the user securely in DynamoDB
4. Returns a signed JWT token

[Perform registration]

Notice the token in localStorage - this is a cryptographically 
signed JWT that proves the user's identity."
```

### Login Demo (1 minute)
```
"Now I'll log out and log back in to show the authentication flow.

[Logout and login]

The system just:
1. Retrieved the user from the database
2. Verified the password against the bcrypt hash
3. Generated a fresh JWT token with 24-hour expiration

This token will be included in every API request."
```

### Authenticated Request Demo (1 minute)
```
"Let's submit a vendor onboarding request. Behind the scenes:

[Submit form]

1. The browser sends the JWT in the Authorization header
2. API Gateway triggers our JWT Authorizer Lambda
3. The authorizer validates the token signature and expiration
4. If valid, it returns an IAM policy allowing the request
5. The request proceeds to our fraud detection workflow

This happens in milliseconds and is completely transparent to the user."
```

### Security Demo (1 minute)
```
"Let me show what happens with an invalid token.

[Open DevTools, set invalid token, make request]

See? Immediate rejection. No processing, no data access.
The API Gateway blocks it before it even reaches our Lambdas.

This is defense in depth - multiple layers of security:
- bcrypt password hashing (can't be reversed)
- JWT signature verification (can't be forged)
- Token expiration (24-hour limit)
- API Gateway authorization (blocks at the edge)
"
```

### Closing (30 seconds)
```
"This authentication system provides:
✅ Secure password storage with bcrypt
✅ Stateless authentication with JWT
✅ API-level authorization
✅ Automatic token expiration
✅ Industry-standard security practices

All built on AWS serverless architecture for scalability and reliability."
```

---

## 📊 Security Features Checklist

- ✅ **Password Hashing**: bcrypt with 10 rounds
- ✅ **JWT Tokens**: HMAC-SHA256 signed
- ✅ **Token Expiration**: 24-hour lifetime
- ✅ **Secure Storage**: DynamoDB with encryption at rest
- ✅ **API Authorization**: JWT Authorizer Lambda
- ✅ **HTTPS Only**: All traffic encrypted in transit
- ✅ **Input Validation**: Email format, password strength
- ✅ **Error Handling**: No information leakage
- ✅ **Rate Limiting**: API Gateway throttling
- ✅ **Audit Trail**: CloudWatch logs for all auth events

---

## 🚀 Quick Demo Commands

```bash
# Start frontend
cd frontend && npm run dev

# Open browser
open http://localhost:3001

# Register
# → Go to /register
# → Fill form
# → Submit

# Check token
# → Open DevTools Console
# → Run: localStorage.getItem('token')

# Login
# → Go to /login
# → Enter credentials
# → Submit

# Make authenticated request
# → Go to /onboard
# → Fill vendor form
# → Submit (token sent automatically)

# Test invalid token
# → Console: localStorage.setItem('token', 'invalid')
# → Try to submit form
# → See 401 Unauthorized
```

---

## 🎯 Key Talking Points

1. **"We use bcrypt, not plain text"** - Show you understand security
2. **"JWT tokens are stateless"** - No session storage needed
3. **"API Gateway authorization"** - Security at the edge
4. **"24-hour expiration"** - Balance security and UX
5. **"Industry standards"** - Same as GitHub, Stripe, etc.

---

## 📱 Mobile/Postman Demo

If you want to demo with Postman:

1. **Register:**
   - POST to `/auth/register`
   - Body: `{"email": "...", "password": "..."}`
   - Copy token from response

2. **Use Token:**
   - POST to `/onboard`
   - Headers: `Authorization: Bearer <token>`
   - Body: vendor data

3. **Show Rejection:**
   - Remove/modify token
   - Try request again
   - Show 401 response

---

**Your authentication system is production-ready and demo-ready! 🔐✨**
