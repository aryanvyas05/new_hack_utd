#!/bin/bash

echo "🏢 Testing Multiple Companies - Fraud Detection Demo"
echo "=================================================="
echo ""

API_URL="https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/onboard"

# Array to store request IDs
declare -a REQUEST_IDS

# Function to submit a company
submit_company() {
    local name="$1"
    local email="$2"
    local description="$3"
    local tax_id="$4"
    
    echo "📤 Submitting: $name"
    
    REQUEST_ID=$(curl -s -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"vendorName\": \"$name\",
        \"contactEmail\": \"$email\",
        \"businessDescription\": \"$description\",
        \"taxId\": \"$tax_id\",
        \"sourceIp\": \"192.168.1.1\"
      }" | jq -r '.requestId')
    
    if [ "$REQUEST_ID" != "null" ] && [ -n "$REQUEST_ID" ]; then
        echo "✅ Submitted: $REQUEST_ID"
        REQUEST_IDS+=("$REQUEST_ID")
    else
        echo "❌ Failed to submit $name"
    fi
    echo ""
}

# 1. Microsoft Corporation (LOW RISK - Legitimate)
submit_company \
    "Microsoft Corporation" \
    "contact@microsoft.com" \
    "Microsoft Corporation is a leading technology company founded in 1975. We develop, license, and support software products, services, and devices worldwide. Our products include Windows operating systems, Microsoft Office suite, Azure cloud services, Xbox gaming consoles, and Surface devices. We are a publicly traded company (NASDAQ: MSFT) with headquarters in Redmond, Washington. We maintain the highest standards of corporate governance and compliance." \
    "91-1144442"

# 2. Theranos Inc (HIGH RISK - Fraudulent)
submit_company \
    "Theranos Inc" \
    "admin@theranos-fake.xyz" \
    "Theranos was a health technology company that claimed to revolutionize blood testing. The company was sued in 2023 for fraud. Case No. 2023-CV-8765. SEC charges filed for securities fraud. Company filed for bankruptcy in 2024. Federal investigation ongoing. Settlement of 500 million dollars with investors. Criminal charges pending against executives. Ponzi scheme allegations from multiple sources. Money laundering investigation by FBI. Federal court case in progress. Multiple regulatory violations cited by FDA. Consumer complaints filed with FTC." \
    "11-1111111"

# 3. Meta Platforms, Inc. (LOW-MEDIUM RISK - Legitimate with some controversies)
submit_company \
    "Meta Platforms, Inc." \
    "business@meta.com" \
    "Meta Platforms, Inc., formerly Facebook, Inc., is a leading social technology company founded in 2004. We build technologies that help people connect, find communities, and grow businesses. Our products include Facebook, Instagram, WhatsApp, and Messenger. We are developing the metaverse through Reality Labs. Publicly traded (NASDAQ: META) with headquarters in Menlo Park, California. We have faced regulatory scrutiny regarding data privacy and antitrust concerns but maintain strong compliance programs." \
    "20-1665019"

# 4. Nestlé S.A. (LOW RISK - Legitimate)
submit_company \
    "Nestlé S.A." \
    "corporate@nestle.com" \
    "Nestlé S.A. is the world's largest food and beverage company, founded in 1866 in Vevey, Switzerland. We operate in 186 countries with over 2000 brands including Nescafé, KitKat, Maggi, and Purina. Listed on the Swiss Stock Exchange (NESN). We are committed to nutrition, health, and wellness with strong ESG practices. Our corporate governance follows Swiss law and international best practices. We maintain comprehensive compliance and ethics programs globally." \
    "98-0000000"

echo "⏳ Waiting 20 seconds for processing..."
sleep 20

echo ""
echo "📊 RESULTS SUMMARY"
echo "=================================================="
echo ""

# Check results for each company
for i in "${!REQUEST_IDS[@]}"; do
    REQUEST_ID="${REQUEST_IDS[$i]}"
    
    echo "Company $((i+1)): $REQUEST_ID"
    
    RESULT=$(curl -s "https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/status/$REQUEST_ID")
    
    STATUS=$(echo "$RESULT" | jq -r '.status // "PROCESSING"')
    VENDOR=$(echo "$RESULT" | jq -r '.vendorName // "Unknown"')
    COMBINED_RISK=$(echo "$RESULT" | jq -r '.riskScores.combinedRiskScore // 0')
    LEGAL_RISK=$(echo "$RESULT" | jq -r '.riskScores.legalRiskScore // 0')
    PAYMENT_RISK=$(echo "$RESULT" | jq -r '.riskScores.paymentRiskScore // 0')
    
    # Convert to percentage
    COMBINED_PCT=$(echo "$COMBINED_RISK * 100" | bc)
    LEGAL_PCT=$(echo "$LEGAL_RISK * 100" | bc)
    PAYMENT_PCT=$(echo "$PAYMENT_RISK * 100" | bc)
    
    echo "  Vendor: $VENDOR"
    echo "  Status: $STATUS"
    echo "  Combined Risk: ${COMBINED_PCT}%"
    echo "  Legal Risk: ${LEGAL_PCT}%"
    echo "  Payment Risk: ${PAYMENT_PCT}%"
    echo "  View: http://localhost:3001/status/$REQUEST_ID"
    echo ""
done

echo "🎯 Demo Complete!"
echo ""
echo "Expected Results:"
echo "  1. Microsoft: LOW risk (~10-20%)"
echo "  2. Theranos: HIGH risk (~80-100%)"
echo "  3. Meta: LOW-MEDIUM risk (~30-40%)"
echo "  4. Nestlé: LOW risk (~10-20%)"
