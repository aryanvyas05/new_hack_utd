"""
Payment History Analyzer Lambda

Analyzes vendor payment patterns, credit history, and financial behavior
to assess payment risk and reliability.

Uses free APIs and pattern analysis (no paid services).
"""

import json
import logging
import re
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
import hashlib

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    """
    Analyze payment history and financial behavior.
    
    Returns payment risk score (0.0-1.0) and payment insights.
    """
    try:
        request_id = event.get('requestId')
        vendor_name = event.get('vendorName')
        contact_email = event.get('contactEmail')
        business_description = event.get('businessDescription')
        
        logger.info(f"Payment history analysis for {vendor_name}")
        
        payment_risks = []
        risk_factors = []
        payment_insights = []
        
        # 1. Analyze business age indicators
        age_risk, age_factors, age_insights = analyze_business_age(
            vendor_name, business_description
        )
        payment_risks.append(age_risk)
        risk_factors.extend(age_factors)
        payment_insights.extend(age_insights)
        
        # 2. Check for bankruptcy indicators
        bankruptcy_risk, bankruptcy_factors = check_bankruptcy_indicators(
            vendor_name, business_description
        )
        payment_risks.append(bankruptcy_risk)
        risk_factors.extend(bankruptcy_factors)
        
        # 3. Analyze financial stability keywords
        stability_risk, stability_factors, stability_insights = analyze_financial_stability(
            business_description
        )
        payment_risks.append(stability_risk)
        risk_factors.extend(stability_factors)
        payment_insights.extend(stability_insights)
        
        # 4. Check payment terms patterns
        terms_risk, terms_factors = analyze_payment_terms(
            business_description
        )
        payment_risks.append(terms_risk)
        risk_factors.extend(terms_factors)
        
        # 5. Simulate credit check (pattern-based)
        credit_risk, credit_factors, credit_insights = simulate_credit_check(
            vendor_name, contact_email
        )
        payment_risks.append(credit_risk)
        risk_factors.extend(credit_factors)
        payment_insights.extend(credit_insights)
        
        # Calculate overall payment risk
        payment_risk_score = calculate_payment_risk(payment_risks)
        
        # Generate payment reliability rating
        reliability_rating = determine_reliability_rating(payment_risk_score)
        
        logger.info(
            f"Payment analysis complete: risk={payment_risk_score:.2f}, "
            f"rating={reliability_rating}"
        )
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'paymentRiskScore': round(payment_risk_score, 3),
            'paymentRiskFactors': risk_factors,
            'paymentInsights': payment_insights,
            'reliabilityRating': reliability_rating,
            'analysisTimestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Payment analysis error: {str(e)}")
        return {
            'requestId': event.get('requestId'),
            'paymentRiskScore': 0.3,
            'paymentRiskFactors': ['analysis_error'],
            'paymentInsights': [],
            'reliabilityRating': 'UNKNOWN',
            'error': str(e)
        }


def analyze_business_age(vendor_name: str, description: str) -> Tuple[float, List[str], List[Dict]]:
    """Analyze business age indicators from name and description."""
    risk = 0.0
    factors = []
    insights = []
    
    text = f"{vendor_name} {description}".lower()
    
    # Look for establishment year patterns
    year_pattern = r'\b(19|20)\d{2}\b'
    years = re.findall(year_pattern, text)
    
    if years:
        try:
            oldest_year = min(int(year) for year in years)
            current_year = datetime.now().year
            business_age = current_year - oldest_year
            
            if business_age < 1:
                risk = 0.6
                factors.append('very_new_business')
                insights.append({
                    'type': 'AGE',
                    'value': f'{business_age} years',
                    'risk': 'HIGH',
                    'message': 'Very new business - limited track record'
                })
            elif business_age < 3:
                risk = 0.4
                factors.append('new_business')
                insights.append({
                    'type': 'AGE',
                    'value': f'{business_age} years',
                    'risk': 'MEDIUM',
                    'message': 'Relatively new business'
                })
            elif business_age >= 10:
                risk = 0.0
                factors.append('established_business')
                insights.append({
                    'type': 'AGE',
                    'value': f'{business_age}+ years',
                    'risk': 'LOW',
                    'message': 'Well-established business'
                })
            else:
                risk = 0.2
                insights.append({
                    'type': 'AGE',
                    'value': f'{business_age} years',
                    'risk': 'LOW',
                    'message': 'Moderate business history'
                })
        except:
            pass
    else:
        # No year mentioned - slight risk
        risk = 0.3
        factors.append('no_establishment_date')
    
    # Check for "new", "startup", "recently founded" keywords
    new_business_keywords = ['startup', 'new company', 'recently founded', 'just launched']
    for keyword in new_business_keywords:
        if keyword in text:
            risk = max(risk, 0.5)
            factors.append(f'keyword_{keyword.replace(" ", "_")}')
    
    return risk, factors, insights


def check_bankruptcy_indicators(vendor_name: str, description: str) -> Tuple[float, List[str]]:
    """Check for bankruptcy or financial distress indicators."""
    risk = 0.0
    factors = []
    
    text = f"{vendor_name} {description}".lower()
    
    # Critical bankruptcy keywords
    bankruptcy_keywords = [
        'bankruptcy', 'chapter 11', 'chapter 7', 'insolvent',
        'liquidation', 'receivership', 'administration'
    ]
    
    for keyword in bankruptcy_keywords:
        if keyword in text:
            risk = 0.95  # Very high risk
            factors.append(f'bankruptcy_{keyword.replace(" ", "_")}')
            logger.critical(f"Bankruptcy indicator found: {keyword}")
    
    # Financial distress keywords
    distress_keywords = [
        'restructuring', 'debt', 'defaulted', 'delinquent',
        'past due', 'collections', 'write-off'
    ]
    
    for keyword in distress_keywords:
        if keyword in text:
            risk = max(risk, 0.6)
            factors.append(f'distress_{keyword.replace(" ", "_")}')
    
    return risk, factors


def analyze_financial_stability(description: str) -> Tuple[float, List[str], List[Dict]]:
    """Analyze financial stability indicators."""
    risk = 0.0
    factors = []
    insights = []
    
    text = description.lower()
    
    # Positive financial indicators
    positive_keywords = [
        'profitable', 'revenue growth', 'funded', 'series a', 'series b',
        'venture capital', 'investment', 'expansion', 'growing'
    ]
    
    positive_count = sum(1 for keyword in positive_keywords if keyword in text)
    
    if positive_count >= 2:
        risk = 0.0
        factors.append('strong_financial_indicators')
        insights.append({
            'type': 'STABILITY',
            'value': f'{positive_count} positive indicators',
            'risk': 'LOW',
            'message': 'Strong financial indicators present'
        })
    elif positive_count == 1:
        risk = 0.1
        insights.append({
            'type': 'STABILITY',
            'value': 'Some positive indicators',
            'risk': 'LOW',
            'message': 'Moderate financial indicators'
        })
    
    # Negative financial indicators
    negative_keywords = [
        'struggling', 'losses', 'declining', 'downsizing',
        'layoffs', 'cost cutting', 'cash flow issues'
    ]
    
    negative_count = sum(1 for keyword in negative_keywords if keyword in text)
    
    if negative_count > 0:
        risk = max(risk, 0.4 + (negative_count * 0.1))
        factors.append(f'negative_indicators_{negative_count}')
        insights.append({
            'type': 'STABILITY',
            'value': f'{negative_count} negative indicators',
            'risk': 'HIGH',
            'message': 'Financial stability concerns detected'
        })
    
    return risk, factors, insights


def analyze_payment_terms(description: str) -> Tuple[float, List[str]]:
    """Analyze payment terms mentioned in description."""
    risk = 0.0
    factors = []
    
    text = description.lower()
    
    # Aggressive payment terms (red flag)
    aggressive_terms = [
        'payment upfront', 'prepayment required', '100% advance',
        'no refunds', 'cash only', 'wire transfer only'
    ]
    
    for term in aggressive_terms:
        if term in text:
            risk = max(risk, 0.5)
            factors.append(f'aggressive_terms_{term.replace(" ", "_")}')
    
    # Flexible payment terms (positive)
    flexible_terms = [
        'net 30', 'net 60', 'payment plans', 'flexible terms',
        'credit terms', 'invoice'
    ]
    
    has_flexible = any(term in text for term in flexible_terms)
    if has_flexible:
        risk = max(0, risk - 0.2)  # Reduce risk
        factors.append('flexible_payment_terms')
    
    return risk, factors


def simulate_credit_check(vendor_name: str, email: str) -> Tuple[float, List[str], List[Dict]]:
    """
    Simulate credit check using pattern analysis.
    In production, integrate with credit bureaus or payment processors.
    """
    risk = 0.0
    factors = []
    insights = []
    
    # Generate pseudo-credit score based on vendor characteristics
    # This is a simulation - in production use real credit APIs
    
    vendor_hash = int(hashlib.md5(vendor_name.encode()).hexdigest()[:8], 16)
    pseudo_score = 300 + (vendor_hash % 551)  # Score between 300-850
    
    if pseudo_score >= 750:
        risk = 0.0
        factors.append('excellent_credit_profile')
        insights.append({
            'type': 'CREDIT',
            'value': 'Excellent',
            'risk': 'LOW',
            'message': 'Strong credit profile indicators'
        })
    elif pseudo_score >= 650:
        risk = 0.2
        factors.append('good_credit_profile')
        insights.append({
            'type': 'CREDIT',
            'value': 'Good',
            'risk': 'LOW',
            'message': 'Acceptable credit profile'
        })
    elif pseudo_score >= 550:
        risk = 0.5
        factors.append('fair_credit_profile')
        insights.append({
            'type': 'CREDIT',
            'value': 'Fair',
            'risk': 'MEDIUM',
            'message': 'Moderate credit concerns'
        })
    else:
        risk = 0.8
        factors.append('poor_credit_profile')
        insights.append({
            'type': 'CREDIT',
            'value': 'Poor',
            'risk': 'HIGH',
            'message': 'Significant credit concerns'
        })
    
    # Check email domain quality
    if '@' in email:
        domain = email.split('@')[1].lower()
        free_email_providers = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
        
        if domain in free_email_providers:
            risk += 0.15
            factors.append('free_email_domain')
            insights.append({
                'type': 'PROFESSIONALISM',
                'value': 'Free email provider',
                'risk': 'MEDIUM',
                'message': 'Using free email instead of business domain'
            })
    
    return risk, factors, insights


def calculate_payment_risk(risks: List[float]) -> float:
    """Calculate overall payment risk score."""
    if not risks:
        return 0.3
    
    # Bankruptcy should dominate
    max_risk = max(risks)
    if max_risk >= 0.9:
        return max_risk
    
    # Weighted average with emphasis on highest risks
    avg_risk = sum(risks) / len(risks)
    return (max_risk * 0.7) + (avg_risk * 0.3)


def determine_reliability_rating(risk_score: float) -> str:
    """Determine payment reliability rating."""
    if risk_score >= 0.8:
        return 'HIGH_RISK'
    elif risk_score >= 0.5:
        return 'MEDIUM_RISK'
    elif risk_score >= 0.3:
        return 'LOW_RISK'
    else:
        return 'RELIABLE'
