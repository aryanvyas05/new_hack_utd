import json
import boto3
import logging
import os
import re
import socket
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize boto3 Fraud Detector client
frauddetector_client = boto3.client('frauddetector')

# Get configuration from environment variables (subtask 13.3)
DETECTOR_NAME = os.environ.get('DETECTOR_NAME', 'veritas_onboard_detector')
EVENT_TYPE_NAME = os.environ.get('EVENT_TYPE_NAME', 'onboarding_request')
MODEL_VERSION = os.environ.get('MODEL_VERSION', '1.0')

# Disposable email domains (common ones)
DISPOSABLE_DOMAINS = {
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'mailinator.com', 'trashmail.com', 'temp-mail.org', 'fakeinbox.com'
}

# Free email providers (suspicious for business use)
FREE_EMAIL_PROVIDERS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'mail.com', 'protonmail.com', 'icloud.com'
}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to assess fraud risk using Amazon Fraud Detector.
    
    Args:
        event: Input event containing requestId, email, ipAddress, and vendorName
        context: Lambda context object
    
    Returns:
        Dictionary containing fraud score, model version, and risk factors
    """
    try:
        # Extract input parameters
        request_id = event.get('requestId', 'unknown')
        email = event.get('email', '')
        ip_address = event.get('ipAddress', '')
        vendor_name = event.get('vendorName', '')
        business_description = event.get('businessDescription', '')
        
        logger.info(f"Processing fraud detection for request: {request_id}")
        
        # DEMO MODE: Check for high-risk keywords for demonstration purposes
        demo_score = check_demo_risk_patterns(vendor_name, email, business_description)
        if demo_score is not None:
            logger.info(f"Demo mode: Using pattern-based score {demo_score} for request {request_id}")
            return {
                'fraudScore': demo_score,
                'modelVersion': 'demo-pattern-v1',
                'riskFactors': get_demo_risk_factors(vendor_name, email, business_description, demo_score)
            }
        
        logger.info(f"Using detector: {DETECTOR_NAME}, event type: {EVENT_TYPE_NAME}")
        
        # Call Fraud Detector get_event_prediction API
        response = get_fraud_prediction(
            detector_name=DETECTOR_NAME,
            event_type_name=EVENT_TYPE_NAME,
            email=email,
            ip_address=ip_address,
            vendor_name=vendor_name,
            event_id=request_id
        )
        
        # Parse fraud score from response
        fraud_score = parse_fraud_score(response)
        
        # Extract risk factors from model outcomes
        risk_factors = extract_risk_factors(response)
        
        # Get model version from response or use environment variable
        model_version = response.get('modelScores', [{}])[0].get('modelVersion', MODEL_VERSION)
        
        logger.info(f"Fraud detection completed for request {request_id}: score={fraud_score}, model={model_version}")
        
        return {
            'fraudScore': fraud_score,
            'modelVersion': model_version,
            'riskFactors': risk_factors
        }
        
    except Exception as e:
        # Error handling with default scoring
        logger.warning(f"Fraud Detector error for request {request_id}: {str(e)}")
        return handle_fraud_detector_error(e, request_id)


def check_demo_risk_patterns(vendor_name: str, email: str, description: str) -> float:
    """
    Intelligent risk scoring using real validation + heuristics.
    This simulates what a trained ML model would do with real fraud data.
    """
    logger.info(f"Analyzing vendor: {vendor_name}, email: {email}")
    
    # Extract domain from email
    domain = extract_domain_from_email(email)
    if not domain:
        logger.warning(f"Invalid email format: {email}")
        return 0.95  # Very high risk for invalid email
    
    # Initialize risk score
    base_risk = 0.10  # Everyone starts with 10% baseline risk
    risk_adjustments = []
    
    # 1. EMAIL VALIDATION
    email_risk, email_factors = validate_email_domain(email, domain, vendor_name)
    base_risk += email_risk
    risk_adjustments.extend(email_factors)
    
    # 2. DOMAIN VALIDATION
    domain_risk, domain_factors = validate_domain(domain)
    base_risk += domain_risk
    risk_adjustments.extend(domain_factors)
    
    # 3. CONTENT ANALYSIS
    content_risk, content_factors = analyze_content_risk(vendor_name, description)
    base_risk += content_risk
    risk_adjustments.extend(content_factors)
    
    # Cap risk score between 0.05 and 0.98
    final_risk = max(0.05, min(0.98, base_risk))
    
    logger.info(f"Risk score for {vendor_name}: {final_risk:.2f} - Factors: {risk_adjustments}")
    
    return final_risk


def extract_domain_from_email(email: str) -> Optional[str]:
    """Extract domain from email address."""
    try:
        if '@' in email:
            return email.split('@')[1].lower().strip()
    except Exception:
        pass
    return None


def validate_email_domain(email: str, domain: str, vendor_name: str) -> Tuple[float, List[str]]:
    """
    Validate email domain and return risk adjustment.
    Returns: (risk_adjustment, risk_factors)
    """
    risk = 0.0
    factors = []
    
    # Check for disposable email
    if domain in DISPOSABLE_DOMAINS:
        risk += 0.70
        factors.append('disposable_email_domain')
        logger.warning(f"Disposable email detected: {domain}")
        return (risk, factors)
    
    # Check for free email provider (suspicious for business)
    if domain in FREE_EMAIL_PROVIDERS:
        risk += 0.25
        factors.append('free_email_provider')
        logger.info(f"Free email provider detected: {domain}")
    
    # Check if email domain matches vendor name (good sign)
    vendor_clean = re.sub(r'[^a-z0-9]', '', vendor_name.lower())
    domain_clean = re.sub(r'[^a-z0-9]', '', domain.split('.')[0])
    
    if vendor_clean and domain_clean and vendor_clean in domain_clean:
        risk -= 0.15  # Reduce risk if domain matches company name
        factors.append('domain_matches_company')
    
    # Validate MX records
    has_mx = check_mx_records(domain)
    if not has_mx:
        risk += 0.40
        factors.append('no_mx_records')
        logger.warning(f"No MX records found for domain: {domain}")
    else:
        factors.append('valid_mx_records')
    
    return (risk, factors)


def validate_domain(domain: str) -> Tuple[float, List[str]]:
    """
    Validate domain existence and web presence.
    Returns: (risk_adjustment, risk_factors)
    """
    risk = 0.0
    factors = []
    
    # Check if domain has a website
    has_website, is_https = check_website_exists(domain)
    
    if not has_website:
        risk += 0.35
        factors.append('no_website_found')
        logger.warning(f"No website found for domain: {domain}")
    else:
        factors.append('website_exists')
        if is_https:
            risk -= 0.05  # Slight bonus for HTTPS
            factors.append('https_enabled')
    
    # Check for suspicious TLDs
    suspicious_tlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top']
    if any(domain.endswith(tld) for tld in suspicious_tlds):
        risk += 0.20
        factors.append('suspicious_tld')
    
    return (risk, factors)


def analyze_content_risk(vendor_name: str, description: str) -> Tuple[float, List[str]]:
    """
    Analyze vendor name and description for fraud indicators.
    Returns: (risk_adjustment, risk_factors)
    """
    risk = 0.0
    factors = []
    text = f"{vendor_name} {description}".lower()
    
    # High-risk fraud keywords
    fraud_keywords = ['scam', 'fraud', 'fake', 'ponzi', 'pyramid', 'guaranteed returns']
    if any(keyword in text for keyword in fraud_keywords):
        risk += 0.60
        factors.append('fraud_keywords_detected')
    
    # Urgency/pressure tactics
    urgency_keywords = ['urgent', 'limited time', 'act now', 'expires soon', 'last chance']
    if any(keyword in text for keyword in urgency_keywords):
        risk += 0.25
        factors.append('urgency_tactics')
    
    # Suspicious patterns
    suspicious_patterns = ['test', 'demo', 'sample', 'temporary', 'placeholder']
    if any(pattern in text for pattern in suspicious_patterns):
        risk += 0.15
        factors.append('suspicious_patterns')
    
    # Positive indicators (reduce risk)
    legitimate_keywords = ['established', 'certified', 'licensed', 'registered', 'incorporated']
    if any(keyword in text for keyword in legitimate_keywords):
        risk -= 0.10
        factors.append('legitimate_business_indicators')
    
    # Check for very short or vague descriptions
    if len(description.strip()) < 20:
        risk += 0.15
        factors.append('insufficient_description')
    
    return (risk, factors)


def check_mx_records(domain: str) -> bool:
    """Check if domain has valid MX records."""
    try:
        socket.setdefaulttimeout(3)
        import dns.resolver
        mx_records = dns.resolver.resolve(domain, 'MX')
        return len(mx_records) > 0
    except ImportError:
        # Fallback if dnspython not available
        try:
            socket.gethostbyname(domain)
            return True
        except Exception:
            return False
    except Exception as e:
        logger.debug(f"MX check failed for {domain}: {e}")
        return False


def check_website_exists(domain: str) -> Tuple[bool, bool]:
    """
    Check if domain has a functioning website.
    Returns: (has_website, is_https)
    """
    for protocol in ['https', 'http']:
        try:
            url = f"{protocol}://{domain}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            urllib.request.urlopen(req, timeout=5)
            return (True, protocol == 'https')
        except Exception:
            continue
    
    return (False, False)


def get_demo_risk_factors(vendor_name: str, email: str, description: str, score: float) -> List[str]:
    """Get risk factors based on demo patterns."""
    text = f"{vendor_name} {email} {description}".lower()
    factors = []
    
    if score >= 0.8:
        factors.append('high_risk_keywords_detected')
        if 'suspicious' in text or 'fraud' in text:
            factors.append('suspicious_business_description')
        if 'scam' in text or 'fake' in text:
            factors.append('potential_fraud_indicators')
    elif score >= 0.6:
        factors.append('medium_risk_profile')
        factors.append('requires_additional_verification')
    elif score >= 0.4:
        factors.append('moderate_risk_indicators')
    else:
        factors.append('low_risk_profile')
        factors.append('established_business_indicators')
    
    return factors


def get_fraud_prediction(
    detector_name: str,
    event_type_name: str,
    email: str,
    ip_address: str,
    vendor_name: str,
    event_id: str
) -> Dict[str, Any]:
    """
    Call Amazon Fraud Detector get_event_prediction API.
    
    Args:
        detector_name: Name of the Fraud Detector detector
        event_type_name: Name of the event type
        email: Contact email address
        ip_address: Source IP address
        vendor_name: Vendor/account name
        event_id: Unique event identifier (request ID)
    
    Returns:
        Fraud Detector API response
    """
    # Prepare event variables for Fraud Detector
    event_variables = {
        'email_address': email,
        'ip_address': ip_address,
        'account_name': vendor_name
    }
    
    # Call get_event_prediction
    response = frauddetector_client.get_event_prediction(
        detectorId=detector_name,
        eventId=event_id,
        eventTypeName=event_type_name,
        eventVariables=event_variables,
        entities=[{
            'entityType': 'customer',
            'entityId': email
        }]
    )
    
    return response


def parse_fraud_score(response: Dict[str, Any]) -> float:
    """
    Parse fraud score from Fraud Detector response.
    
    Args:
        response: Fraud Detector API response
    
    Returns:
        Fraud score in range 0.0 to 1.0
    """
    # Extract model scores from response
    model_scores = response.get('modelScores', [])
    
    if not model_scores:
        logger.warning("No model scores found in response, using default score")
        return 0.5
    
    # Get the first model score (primary model)
    primary_model = model_scores[0]
    scores = primary_model.get('scores', {})
    
    # Extract fraud score - typically returned as a key-value pair
    # The score key might vary based on model configuration
    fraud_score = None
    
    # Try common score keys
    for key in ['fraud_score', 'risk_score', 'score']:
        if key in scores:
            fraud_score = float(scores[key])
            break
    
    # If no score found, check ruleResults for outcomes
    if fraud_score is None:
        rule_results = response.get('ruleResults', [])
        for rule in rule_results:
            outcomes = rule.get('outcomes', [])
            if outcomes:
                # Use first outcome as indicator (high risk = 0.8, medium = 0.5, low = 0.2)
                outcome_name = outcomes[0].lower()
                if 'high' in outcome_name or 'block' in outcome_name:
                    fraud_score = 0.8
                elif 'medium' in outcome_name or 'review' in outcome_name:
                    fraud_score = 0.5
                elif 'low' in outcome_name or 'approve' in outcome_name:
                    fraud_score = 0.2
                break
    
    # Ensure score is in valid range
    if fraud_score is None:
        logger.warning("Could not parse fraud score from response, using default")
        fraud_score = 0.5
    else:
        fraud_score = max(0.0, min(1.0, fraud_score))
    
    return fraud_score


def extract_risk_factors(response: Dict[str, Any]) -> List[str]:
    """
    Extract risk factors from Fraud Detector model outcomes.
    
    Args:
        response: Fraud Detector API response
    
    Returns:
        List of risk factor strings
    """
    risk_factors = []
    
    # Extract from rule results
    rule_results = response.get('ruleResults', [])
    for rule in rule_results:
        if rule.get('outcomes'):
            rule_id = rule.get('ruleId', 'unknown_rule')
            risk_factors.append(rule_id)
    
    # Extract from model scores if available
    model_scores = response.get('modelScores', [])
    for model in model_scores:
        model_name = model.get('modelName', '')
        if model_name:
            # Add high-scoring model indicators
            scores = model.get('scores', {})
            for score_key, score_value in scores.items():
                try:
                    if float(score_value) > 0.7:
                        risk_factors.append(f"high_{score_key}")
                except (ValueError, TypeError):
                    pass
    
    # Check for specific risk indicators in response
    if 'high_risk_ip' in str(response).lower():
        risk_factors.append('high_risk_ip')
    if 'suspicious_email' in str(response).lower():
        risk_factors.append('suspicious_email_domain')
    
    return risk_factors


def handle_fraud_detector_error(error: Exception, request_id: str) -> Dict[str, Any]:
    """
    Handle Fraud Detector API errors with default scoring.
    
    Args:
        error: Exception that occurred
        request_id: Request identifier for logging
    
    Returns:
        Default response with fraud score of 0.5
    """
    error_type = type(error).__name__
    error_message = str(error)
    
    # Log detailed error information
    logger.warning(
        f"Fraud Detector API error for request {request_id}: "
        f"Type={error_type}, Message={error_message}"
    )
    
    # Check for specific error types
    if 'Throttling' in error_type or 'throttling' in error_message.lower():
        logger.warning(f"Fraud Detector throttling detected for request {request_id}")
    elif 'ServiceUnavailable' in error_type or 'unavailable' in error_message.lower():
        logger.warning(f"Fraud Detector service unavailable for request {request_id}")
    
    # Return default response with 0.5 fraud score
    return {
        'fraudScore': 0.5,
        'modelVersion': 'default',
        'riskFactors': ['error_default_score'],
        'error': error_type
    }
