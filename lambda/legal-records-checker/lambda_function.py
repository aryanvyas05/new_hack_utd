"""
Legal Records Checker Lambda

Checks for legal issues, court records, regulatory violations, and compliance problems
using free NLP libraries (no AWS Comprehend - using pattern matching and regex).

Analyzes:
- Criminal records indicators
- Civil lawsuits
- Regulatory violations
- SEC filings and enforcement actions
- Consumer complaints
- License suspensions
"""

import json
import logging
import re
from typing import Dict, List, Tuple
from datetime import datetime
import urllib.request
import urllib.parse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Legal issue categories and keywords
LEGAL_KEYWORDS = {
    'criminal': [
        'convicted', 'indicted', 'arrested', 'charged with', 'criminal case',
        'felony', 'misdemeanor', 'prison', 'jail', 'plea deal', 'guilty plea'
    ],
    'civil_litigation': [
        'lawsuit', 'sued', 'plaintiff', 'defendant', 'litigation',
        'class action', 'settlement', 'judgment', 'court order', 'injunction'
    ],
    'regulatory': [
        'sec charges', 'ftc action', 'fda warning', 'epa violation',
        'osha violation', 'regulatory action', 'cease and desist',
        'consent decree', 'compliance violation', 'license suspended'
    ],
    'fraud': [
        'fraud', 'ponzi scheme', 'pyramid scheme', 'embezzlement',
        'securities fraud', 'wire fraud', 'tax evasion', 'money laundering',
        'insider trading', 'market manipulation'
    ],
    'consumer_complaints': [
        'bbb complaint', 'consumer complaint', 'ftc complaint',
        'attorney general', 'consumer protection', 'unfair practices',
        'deceptive advertising', 'false claims'
    ],
    'bankruptcy_legal': [
        'bankruptcy fraud', 'fraudulent conveyance', 'preference action',
        'adversary proceeding', 'trustee action'
    ],
    'intellectual_property': [
        'patent infringement', 'trademark infringement', 'copyright violation',
        'trade secret theft', 'dmca takedown'
    ],
    'employment': [
        'discrimination lawsuit', 'wrongful termination', 'wage theft',
        'labor violation', 'eeoc complaint', 'sexual harassment'
    ]
}

# Severity weights for different legal issues
SEVERITY_WEIGHTS = {
    'criminal': 1.0,
    'fraud': 0.95,
    'regulatory': 0.7,
    'civil_litigation': 0.5,
    'bankruptcy_legal': 0.8,
    'consumer_complaints': 0.4,
    'intellectual_property': 0.5,
    'employment': 0.6
}


def lambda_handler(event, context):
    """
    Check for legal records and compliance issues.
    
    Returns legal risk score (0.0-1.0) and identified issues.
    """
    try:
        request_id = event.get('requestId')
        vendor_name = event.get('vendorName')
        contact_email = event.get('contactEmail')
        business_description = event.get('businessDescription')
        
        logger.info(f"Legal records check for {vendor_name}")
        
        legal_risks = []
        risk_factors = []
        legal_issues = []
        
        # 1. Scan for legal keywords using NLP patterns
        keyword_risk, keyword_factors, keyword_issues = scan_legal_keywords(
            vendor_name, business_description
        )
        legal_risks.append(keyword_risk)
        risk_factors.extend(keyword_factors)
        legal_issues.extend(keyword_issues)
        
        # 2. Extract and analyze legal entities (names, dates, case numbers)
        entity_risk, entity_factors, entity_issues = extract_legal_entities(
            business_description
        )
        legal_risks.append(entity_risk)
        risk_factors.extend(entity_factors)
        legal_issues.extend(entity_issues)
        
        # 3. Check for regulatory compliance mentions
        compliance_risk, compliance_factors = check_compliance_status(
            business_description
        )
        legal_risks.append(compliance_risk)
        risk_factors.extend(compliance_factors)
        
        # 4. Analyze sentiment around legal terms
        sentiment_risk, sentiment_factors = analyze_legal_sentiment(
            business_description
        )
        legal_risks.append(sentiment_risk)
        risk_factors.extend(sentiment_factors)
        
        # 5. Check for ongoing vs resolved issues
        timeline_risk, timeline_factors, timeline_info = analyze_legal_timeline(
            business_description
        )
        legal_risks.append(timeline_risk)
        risk_factors.extend(timeline_factors)
        
        # Calculate overall legal risk
        legal_risk_score = calculate_legal_risk(legal_risks, legal_issues)
        
        # Determine legal status
        legal_status = determine_legal_status(legal_risk_score, legal_issues)
        
        logger.info(
            f"Legal check complete: risk={legal_risk_score:.2f}, "
            f"status={legal_status}, issues={len(legal_issues)}"
        )
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'legalRiskScore': round(legal_risk_score, 3),
            'legalRiskFactors': risk_factors,
            'legalIssues': legal_issues,
            'legalStatus': legal_status,
            'timelineInfo': timeline_info,
            'analysisTimestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Legal check error: {str(e)}")
        return {
            'requestId': event.get('requestId'),
            'legalRiskScore': 0.3,
            'legalRiskFactors': ['analysis_error'],
            'legalIssues': [],
            'legalStatus': 'UNKNOWN',
            'timelineInfo': {},
            'error': str(e)
        }


def scan_legal_keywords(vendor_name: str, description: str) -> Tuple[float, List[str], List[Dict]]:
    """Scan text for legal issue keywords using pattern matching."""
    risk = 0.0
    factors = []
    issues = []
    
    text = f"{vendor_name} {description}".lower()
    
    category_matches = {}
    
    for category, keywords in LEGAL_KEYWORDS.items():
        matches = []
        for keyword in keywords:
            if keyword in text:
                matches.append(keyword)
                
                # Extract context around the keyword
                context = extract_context(text, keyword, window=50)
                
                issues.append({
                    'category': category.upper(),
                    'keyword': keyword,
                    'context': context,
                    'severity': SEVERITY_WEIGHTS.get(category, 0.5)
                })
        
        if matches:
            category_matches[category] = matches
            category_risk = SEVERITY_WEIGHTS.get(category, 0.5)
            risk = max(risk, category_risk)
            factors.append(f'{category}_{len(matches)}_matches')
            
            logger.warning(
                f"Legal issue detected - {category}: {len(matches)} matches"
            )
    
    # Multiple categories = higher risk
    if len(category_matches) >= 3:
        risk = min(1.0, risk * 1.3)
        factors.append('multiple_legal_categories')
    
    return risk, factors, issues


def extract_legal_entities(text: str) -> Tuple[float, List[str], List[Dict]]:
    """
    Extract legal entities using regex patterns (free NLP alternative).
    Looks for case numbers, court names, dates, monetary amounts.
    """
    risk = 0.0
    factors = []
    issues = []
    
    text_lower = text.lower()
    
    # Pattern 1: Case numbers (e.g., "Case No. 2023-CV-1234", "Docket #12345")
    case_patterns = [
        r'case\s+(?:no\.?|number|#)\s*[:\s]*([0-9]{2,4}[-\s]?[A-Z]{2}[-\s]?[0-9]{3,6})',
        r'docket\s+(?:no\.?|number|#)\s*[:\s]*([0-9]{4,8})',
        r'civil\s+action\s+(?:no\.?|#)\s*([0-9\-]+)'
    ]
    
    for pattern in case_patterns:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        if matches:
            risk = max(risk, 0.7)
            factors.append(f'case_number_found_{len(matches)}')
            for match in matches:
                issues.append({
                    'category': 'CASE_REFERENCE',
                    'type': 'case_number',
                    'value': match,
                    'severity': 0.7
                })
    
    # Pattern 2: Court names
    court_keywords = [
        'district court', 'circuit court', 'supreme court', 'appellate court',
        'bankruptcy court', 'federal court', 'state court'
    ]
    
    for court in court_keywords:
        if court in text_lower:
            risk = max(risk, 0.6)
            factors.append(f'court_mention_{court.replace(" ", "_")}')
            issues.append({
                'category': 'COURT_REFERENCE',
                'type': 'court_name',
                'value': court,
                'severity': 0.6
            })
    
    # Pattern 3: Monetary judgments/settlements
    money_patterns = [
        r'\$([0-9,]+(?:\.[0-9]{2})?)\s*(?:million|billion)?\s*(?:settlement|judgment|fine|penalty|damages)',
        r'(?:settlement|judgment|fine|penalty|damages)\s*of\s*\$([0-9,]+(?:\.[0-9]{2})?)\s*(?:million|billion)?'
    ]
    
    for pattern in money_patterns:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        if matches:
            risk = max(risk, 0.8)
            factors.append(f'monetary_judgment_{len(matches)}')
            for match in matches:
                issues.append({
                    'category': 'FINANCIAL_PENALTY',
                    'type': 'monetary_amount',
                    'value': f'${match}',
                    'severity': 0.8
                })
    
    # Pattern 4: Legal dates (recent = higher risk)
    date_pattern = r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+([0-9]{1,2}),?\s+(20[0-9]{2})\b'
    date_matches = re.findall(date_pattern, text_lower, re.IGNORECASE)
    
    if date_matches:
        current_year = datetime.now().year
        recent_dates = [int(match[2]) for match in date_matches if int(match[2]) >= current_year - 3]
        
        if recent_dates:
            risk = max(risk, 0.5)
            factors.append(f'recent_legal_dates_{len(recent_dates)}')
    
    return risk, factors, issues


def check_compliance_status(description: str) -> Tuple[float, List[str]]:
    """Check for compliance and regulatory status mentions."""
    risk = 0.0
    factors = []
    
    text = description.lower()
    
    # Negative compliance indicators
    negative_compliance = [
        'non-compliant', 'violation', 'breach', 'failed inspection',
        'warning letter', 'notice of violation', 'corrective action',
        'suspended license', 'revoked', 'probation'
    ]
    
    for indicator in negative_compliance:
        if indicator in text:
            risk = max(risk, 0.7)
            factors.append(f'compliance_issue_{indicator.replace(" ", "_")}')
            logger.warning(f"Compliance issue detected: {indicator}")
    
    # Positive compliance indicators (reduce risk)
    positive_compliance = [
        'compliant', 'certified', 'accredited', 'licensed',
        'good standing', 'passed inspection', 'iso certified',
        'regulatory approval'
    ]
    
    positive_count = sum(1 for indicator in positive_compliance if indicator in text)
    if positive_count >= 2:
        risk = max(0, risk - 0.2)
        factors.append('positive_compliance_indicators')
    
    return risk, factors


def analyze_legal_sentiment(text: str) -> Tuple[float, List[str]]:
    """
    Analyze sentiment around legal terms using simple NLP.
    Negative sentiment + legal terms = higher risk.
    """
    risk = 0.0
    factors = []
    
    text_lower = text.lower()
    
    # Negative sentiment words
    negative_words = [
        'guilty', 'liable', 'violated', 'breached', 'failed',
        'negligent', 'fraudulent', 'illegal', 'unlawful', 'criminal'
    ]
    
    # Positive/mitigating words
    positive_words = [
        'resolved', 'settled', 'dismissed', 'acquitted', 'exonerated',
        'cleared', 'vindicated', 'compliant', 'approved'
    ]
    
    negative_count = sum(1 for word in negative_words if word in text_lower)
    positive_count = sum(1 for word in positive_words if word in text_lower)
    
    sentiment_score = negative_count - positive_count
    
    if sentiment_score > 2:
        risk = 0.6
        factors.append(f'negative_legal_sentiment_{sentiment_score}')
    elif sentiment_score > 0:
        risk = 0.3
        factors.append('mild_negative_sentiment')
    elif sentiment_score < -1:
        risk = 0.0
        factors.append('positive_legal_resolution')
    
    return risk, factors


def analyze_legal_timeline(text: str) -> Tuple[float, List[str], Dict]:
    """Analyze whether legal issues are ongoing or resolved."""
    risk = 0.0
    factors = []
    timeline_info = {}
    
    text_lower = text.lower()
    
    # Ongoing issue indicators
    ongoing_keywords = [
        'ongoing', 'pending', 'current', 'active case', 'under investigation',
        'awaiting trial', 'in litigation', 'ongoing lawsuit'
    ]
    
    ongoing_count = sum(1 for keyword in ongoing_keywords if keyword in text_lower)
    
    if ongoing_count > 0:
        risk = 0.7
        factors.append(f'ongoing_legal_issues_{ongoing_count}')
        timeline_info['status'] = 'ONGOING'
        timeline_info['count'] = ongoing_count
    
    # Resolved issue indicators
    resolved_keywords = [
        'resolved', 'settled', 'dismissed', 'closed', 'concluded',
        'final judgment', 'appeal denied', 'case closed'
    ]
    
    resolved_count = sum(1 for keyword in resolved_keywords if keyword in text_lower)
    
    if resolved_count > 0:
        risk = max(0, risk - 0.3)  # Reduce risk for resolved issues
        factors.append(f'resolved_issues_{resolved_count}')
        timeline_info['resolved_count'] = resolved_count
    
    # Check for recency
    recent_keywords = ['2024', '2023', 'recent', 'recently', 'this year', 'last year']
    is_recent = any(keyword in text_lower for keyword in recent_keywords)
    
    if is_recent and ongoing_count > 0:
        risk = min(1.0, risk * 1.2)
        factors.append('recent_ongoing_issues')
        timeline_info['recency'] = 'RECENT'
    
    return risk, factors, timeline_info


def extract_context(text: str, keyword: str, window: int = 50) -> str:
    """Extract context around a keyword."""
    try:
        index = text.find(keyword)
        if index == -1:
            return ""
        
        start = max(0, index - window)
        end = min(len(text), index + len(keyword) + window)
        
        context = text[start:end].strip()
        if start > 0:
            context = "..." + context
        if end < len(text):
            context = context + "..."
        
        return context
    except:
        return ""


def calculate_legal_risk(risks: List[float], issues: List[Dict]) -> float:
    """Calculate overall legal risk score."""
    if not risks:
        return 0.0
    
    # Criminal or fraud issues should dominate
    max_risk = max(risks)
    
    if max_risk >= 0.9:
        return max_risk
    
    # Weight by number and severity of issues
    if issues:
        avg_severity = sum(issue.get('severity', 0.5) for issue in issues) / len(issues)
        issue_multiplier = min(1.5, 1.0 + (len(issues) * 0.1))
        
        base_risk = sum(risks) / len(risks)
        return min(1.0, base_risk * issue_multiplier * (0.5 + avg_severity * 0.5))
    
    return sum(risks) / len(risks)


def determine_legal_status(risk_score: float, issues: List[Dict]) -> str:
    """Determine overall legal status."""
    critical_issues = [i for i in issues if i.get('severity', 0) >= 0.9]
    
    if critical_issues:
        return 'CRITICAL_ISSUES'
    elif risk_score >= 0.8:
        return 'HIGH_RISK'
    elif risk_score >= 0.5:
        return 'MEDIUM_RISK'
    elif risk_score >= 0.2:
        return 'LOW_RISK'
    else:
        return 'CLEAR'
