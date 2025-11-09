"""
SIMPLE, REALISTIC Fraud Detector

Real companies (Google, Microsoft, etc.) → LOW risk (5-15%)
Fake/suspicious companies → HIGH risk (70-95%)
"""

import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Known legitimate domains (major companies)
LEGITIMATE_DOMAINS = {
    'google.com', 'microsoft.com', 'amazon.com', 'apple.com', 'meta.com',
    'facebook.com', 'netflix.com', 'adobe.com', 'salesforce.com', 'oracle.com',
    'ibm.com', 'intel.com', 'cisco.com', 'dell.com', 'hp.com', 'sap.com'
}

# Disposable/temporary email domains
DISPOSABLE_DOMAINS = {
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'mailinator.com', 'trashmail.com', 'temp-mail.org', 'fakeinbox.com'
}

# Fraud keywords
FRAUD_KEYWORDS = [
    'scam', 'fraud', 'ponzi', 'pyramid', 'guaranteed returns',
    'get rich quick', 'make money fast', 'urgent', 'act now',
    'limited time', 'expires soon', 'test', 'demo', 'sample'
]


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Simple, realistic fraud detection."""
    try:
        request_id = event.get('requestId', 'unknown')
        vendor_name = event.get('vendorName', '')
        email = event.get('contactEmail', '')
        description = event.get('businessDescription', '')
        
        logger.info(f"Analyzing: {vendor_name} ({email})")
        
        # Extract domain
        domain = email.split('@')[1].lower() if '@' in email else ''
        
        # Calculate risk score
        fraud_score = 0.08  # Start with 8% baseline
        risk_factors = []
        
        # 1. Check if it's a known legitimate company
        if domain in LEGITIMATE_DOMAINS:
            fraud_score = 0.05  # Very low risk
            risk_factors.append('legitimate_company')
            logger.info(f"✅ Legitimate company detected: {domain}")
        
        # 2. Check for disposable email (VERY HIGH RISK)
        elif domain in DISPOSABLE_DOMAINS:
            fraud_score = 0.90  # Very high risk
            risk_factors.append('disposable_email')
            logger.warning(f"🚨 Disposable email detected: {domain}")
        
        # 3. Check for fraud keywords
        else:
            text = f"{vendor_name} {description}".lower()
            fraud_count = sum(1 for keyword in FRAUD_KEYWORDS if keyword in text)
            
            if fraud_count >= 3:
                fraud_score = 0.85  # High risk
                risk_factors.append(f'fraud_keywords_{fraud_count}')
                logger.warning(f"⚠️ Multiple fraud keywords detected: {fraud_count}")
            elif fraud_count >= 1:
                fraud_score = 0.45  # Medium risk
                risk_factors.append(f'fraud_keywords_{fraud_count}')
            else:
                fraud_score = 0.12  # Low risk for normal companies
                risk_factors.append('normal_profile')
        
        logger.info(f"Final score for {vendor_name}: {fraud_score:.2f}")
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'contactEmail': email,
            'businessDescription': description,
            'fraudScore': round(fraud_score, 3),
            'modelVersion': 'simple-v1',
            'riskFactors': risk_factors
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'requestId': event.get('requestId'),
            'fraudScore': 0.5,
            'modelVersion': 'error',
            'riskFactors': ['analysis_error']
        }
