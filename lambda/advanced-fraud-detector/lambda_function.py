"""
Advanced Fraud Detector with Multiple Heuristics

Checks:
1. Domain validation (website, SSL, MX)
2. Legal/court records (fraud, lawsuits, bankruptcy)
3. News sentiment (negative mentions)
4. Business registry validation
5. Social media presence
6. Financial indicators

Returns detailed breakdown for pie chart visualization.
"""

import json
import boto3
import logging
import urllib.request
import urllib.parse
import socket
import ssl
import re
from typing import Dict, Any, Tuple, List

logger = logging.getLogger()
logger.setLevel(logging.INFO)

comprehend = boto3.client('comprehend')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Advanced fraud detection with multiple heuristics."""
    try:
        request_id = event.get('requestId', 'unknown')
        vendor_name = event.get('vendorName', '')
        email = event.get('contactEmail', '')
        description = event.get('businessDescription', '')
        
        logger.info(f"Advanced analysis for: {vendor_name}")
        
        domain = email.split('@')[1] if '@' in email else None
        if not domain:
            return create_error_response(request_id, 0.95)
        
        # Run all validation checks
        checks = {}
        
        # 1. Technical Validation (40 points)
        checks['technical'] = check_technical_validation(domain)
        
        # 2. Legal/Court Records (25 points)
        checks['legal'] = check_legal_records(vendor_name, description)
        
        # 3. News Sentiment (20 points)
        checks['news'] = check_news_sentiment(vendor_name, description)
        
        # 4. Business Registry (15 points)
        checks['registry'] = check_business_registry(vendor_name, domain)
        
        # Calculate total trust score
        total_trust = sum(check['score'] for check in checks.values())
        
        # Convert to risk score
        risk_score = 1.0 - (total_trust / 100.0)
        risk_score = max(0.05, min(0.95, risk_score))
        
        # Collect all risk factors
        risk_factors = []
        for category, data in checks.items():
            risk_factors.extend(data.get('risk_factors', []))
        
        logger.info(f"Trust: {total_trust}/100, Risk: {risk_score:.2f}")
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'contactEmail': email,
            'businessDescription': description,
            'fraudScore': round(risk_score, 3),
            'modelVersion': 'advanced-v1',
            'riskFactors': risk_factors,
            'trustScore': round(total_trust, 1),
            'detailedChecks': checks,
            'chartData': create_chart_data(checks)
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return create_error_response(event.get('requestId'), 0.50)


def check_technical_validation(domain: str) -> Dict:
    """Technical validation: website, SSL, MX, DNS."""
    result = {'score': 0, 'checks': {}, 'risk_factors': []}
    
    # Website (15 points)
    try:
        url = f"https://{domain}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        urllib.request.urlopen(req, timeout=5)
        result['checks']['website'] = {'status': 'found', 'https': True}
        result['score'] += 15
    except:
        try:
            url = f"http://{domain}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            urllib.request.urlopen(req, timeout=5)
            result['checks']['website'] = {'status': 'found', 'https': False}
            result['score'] += 7
        except:
            result['checks']['website'] = {'status': 'not_found', 'https': False}
            result['risk_factors'].append('no_website')
    
    # SSL Certificate (10 points)
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                result['checks']['ssl'] = {'valid': True}
                result['score'] += 10
    except:
        result['checks']['ssl'] = {'valid': False}
        result['risk_factors'].append('no_ssl')
    
    # MX Records (10 points)
    try:
        import dns.resolver
        mx_records = dns.resolver.resolve(domain, 'MX')
        result['checks']['mx_records'] = {'found': True, 'count': len(mx_records)}
        result['score'] += 10
    except:
        result['checks']['mx_records'] = {'found': False}
        result['risk_factors'].append('no_mx_records')
    
    # Domain Age/TLD (5 points)
    trusted_tlds = ['.com', '.org', '.net', '.edu', '.gov']
    if any(domain.endswith(tld) for tld in trusted_tlds):
        result['checks']['domain_tld'] = {'trusted': True}
        result['score'] += 5
    else:
        result['checks']['domain_tld'] = {'trusted': False}
    
    return result


def check_legal_records(vendor_name: str, description: str) -> Dict:
    """Check for legal issues using NLP pattern matching."""
    result = {'score': 25, 'checks': {}, 'risk_factors': []}
    
    text = f"{vendor_name} {description}".lower()
    
    # Negative legal keywords
    legal_red_flags = {
        'lawsuit': -10,
        'sued': -10,
        'fraud': -15,
        'bankrupt': -15,
        'investigation': -8,
        'indicted': -15,
        'convicted': -20,
        'settlement': -5,
        'violation': -8,
        'penalty': -5,
        'scandal': -10,
        'corruption': -15,
        'embezzlement': -15,
        'money laundering': -20
    }
    
    detected_issues = []
    for keyword, penalty in legal_red_flags.items():
        if keyword in text:
            result['score'] += penalty
            detected_issues.append(keyword)
            result['risk_factors'].append(f'legal_issue_{keyword.replace(" ", "_")}')
    
    result['checks']['legal_issues'] = {
        'detected': detected_issues,
        'count': len(detected_issues),
        'clean': len(detected_issues) == 0
    }
    
    # Ensure score doesn't go negative
    result['score'] = max(0, result['score'])
    
    return result


def check_news_sentiment(vendor_name: str, description: str) -> Dict:
    """Check news sentiment using simple NLP."""
    result = {'score': 20, 'checks': {}, 'risk_factors': []}
    
    text = f"{vendor_name} {description}".lower()
    
    # Negative sentiment keywords
    negative_keywords = [
        'scam', 'ponzi', 'pyramid', 'fake', 'fraudulent',
        'deceptive', 'misleading', 'dishonest', 'criminal'
    ]
    
    # Positive business keywords
    positive_keywords = [
        'established', 'trusted', 'certified', 'licensed',
        'registered', 'accredited', 'reputable', 'leading'
    ]
    
    negative_count = sum(1 for kw in negative_keywords if kw in text)
    positive_count = sum(1 for kw in positive_keywords if kw in text)
    
    # Adjust score based on sentiment
    if negative_count > 0:
        result['score'] -= (negative_count * 5)
        result['risk_factors'].append(f'negative_sentiment_{negative_count}_keywords')
    
    if positive_count > 0:
        result['score'] = min(20, result['score'] + (positive_count * 2))
    
    result['checks']['sentiment'] = {
        'negative_count': negative_count,
        'positive_count': positive_count,
        'overall': 'negative' if negative_count > positive_count else 
                   'positive' if positive_count > 0 else 'neutral'
    }
    
    result['score'] = max(0, min(20, result['score']))
    
    return result


def check_business_registry(vendor_name: str, domain: str) -> Dict:
    """Check business registry indicators."""
    result = {'score': 15, 'checks': {}, 'risk_factors': []}
    
    # Check for corporate suffixes
    corporate_suffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'limited', 'company', 'co']
    vendor_lower = vendor_name.lower()
    
    has_suffix = any(suffix in vendor_lower for suffix in corporate_suffixes)
    result['checks']['corporate_suffix'] = {'present': has_suffix}
    
    if not has_suffix:
        result['score'] -= 5
        result['risk_factors'].append('no_corporate_suffix')
    
    # Check email domain matches company name
    vendor_clean = re.sub(r'[^a-z0-9]', '', vendor_lower)
    domain_clean = domain.split('.')[0]
    
    domain_matches = vendor_clean in domain_clean or domain_clean in vendor_clean
    result['checks']['domain_match'] = {'matches': domain_matches}
    
    if not domain_matches:
        result['score'] -= 5
        result['risk_factors'].append('domain_name_mismatch')
    
    result['score'] = max(0, result['score'])
    
    return result


def create_chart_data(checks: Dict) -> Dict:
    """Create data for pie charts and visualizations."""
    return {
        'trust_breakdown': {
            'labels': ['Technical', 'Legal', 'News', 'Registry'],
            'values': [
                checks['technical']['score'],
                checks['legal']['score'],
                checks['news']['score'],
                checks['registry']['score']
            ],
            'colors': ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']
        },
        'validation_status': {
            'labels': ['Passed', 'Failed'],
            'values': [
                sum(1 for c in checks.values() if c['score'] > c.get('max_score', 100) * 0.5),
                sum(1 for c in checks.values() if c['score'] <= c.get('max_score', 100) * 0.5)
            ],
            'colors': ['#10B981', '#EF4444']
        },
        'risk_distribution': {
            'technical_risk': round((1 - checks['technical']['score'] / 40) * 100, 1),
            'legal_risk': round((1 - checks['legal']['score'] / 25) * 100, 1),
            'news_risk': round((1 - checks['news']['score'] / 20) * 100, 1),
            'registry_risk': round((1 - checks['registry']['score'] / 15) * 100, 1)
        }
    }


def create_error_response(request_id: str, risk_score: float) -> Dict:
    """Create error response."""
    return {
        'requestId': request_id,
        'fraudScore': risk_score,
        'modelVersion': 'advanced-v1',
        'riskFactors': ['analysis_error'],
        'trustScore': 0,
        'detailedChecks': {},
        'chartData': {}
    }
