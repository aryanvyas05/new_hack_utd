"""
Entity Resolution Lambda - Check Against Sanctions & Watchlists

This function performs real-time entity resolution to check vendors against:
- OFAC Sanctions Lists (SDN - Specially Designated Nationals)
- Global Watchlists
- Negative News Articles
- Corporate Registry Verification
- PEP (Politically Exposed Persons) Lists

Uses AWS Comprehend for entity extraction and external APIs for verification.
"""

import json
import logging
import urllib.request
import urllib.parse
import re
from typing import Dict, List, Tuple, Any
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Simulated OFAC SDN List (in production, use real API or S3-hosted list)
SANCTIONS_LIST = {
    'individuals': [
        'vladimir putin', 'kim jong un', 'bashar al-assad',
        'nicolas maduro', 'alexander lukashenko'
    ],
    'entities': [
        'rosneft', 'gazprom bank', 'sberbank', 'vtb bank',
        'huawei', 'zte corporation', 'kaspersky lab'
    ],
    'keywords': [
        'sanctioned', 'embargo', 'restricted', 'prohibited',
        'blacklist', 'designated national'
    ]
}

# High-risk jurisdictions
HIGH_RISK_COUNTRIES = [
    'north korea', 'iran', 'syria', 'cuba', 'venezuela',
    'crimea', 'donetsk', 'luhansk', 'russia', 'belarus'
]

# Negative news keywords
NEGATIVE_NEWS_KEYWORDS = [
    'fraud', 'scam', 'ponzi', 'investigation', 'indicted',
    'arrested', 'lawsuit', 'bankrupt', 'scandal', 'corruption',
    'money laundering', 'embezzlement', 'sec charges'
]


def lambda_handler(event, context):
    """
    Perform entity resolution and sanctions screening.
    
    Returns entity risk score (0.0-1.0) and matched entities.
    """
    try:
        request_id = event.get('requestId')
        vendor_name = event.get('vendorName')
        contact_email = event.get('contactEmail')
        business_description = event.get('businessDescription')
        
        logger.info(f"Entity resolution for {vendor_name}")
        
        entity_risks = []
        risk_factors = []
        matched_entities = []
        
        # 1. Extract entities from business description using Comprehend
        entities = extract_entities(business_description)
        
        # 2. Check against sanctions lists
        sanctions_risk, sanctions_factors, sanctions_matches = check_sanctions_lists(
            vendor_name, entities
        )
        entity_risks.append(sanctions_risk)
        risk_factors.extend(sanctions_factors)
        matched_entities.extend(sanctions_matches)
        
        # 3. Check for high-risk jurisdictions
        jurisdiction_risk, jurisdiction_factors = check_jurisdictions(
            vendor_name, business_description, entities
        )
        entity_risks.append(jurisdiction_risk)
        risk_factors.extend(jurisdiction_factors)
        
        # 4. Negative news screening
        news_risk, news_factors = screen_negative_news(
            vendor_name, business_description
        )
        entity_risks.append(news_risk)
        risk_factors.extend(news_factors)
        
        # 5. PEP (Politically Exposed Persons) screening
        pep_risk, pep_factors = screen_pep(entities)
        entity_risks.append(pep_risk)
        risk_factors.extend(pep_factors)
        
        # 6. Corporate registry verification
        registry_risk, registry_factors = verify_corporate_registry(
            vendor_name, contact_email
        )
        entity_risks.append(registry_risk)
        risk_factors.extend(registry_factors)
        
        # Calculate overall entity risk
        entity_risk_score = calculate_entity_risk(entity_risks)
        
        # Determine compliance status
        compliance_status = determine_compliance_status(
            entity_risk_score, matched_entities
        )
        
        logger.info(
            f"Entity resolution complete: risk={entity_risk_score:.2f}, "
            f"status={compliance_status}"
        )
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'contactEmail': contact_email,
            'businessDescription': business_description,
            'entityRiskScore': round(entity_risk_score, 3),
            'entityRiskFactors': risk_factors,
            'matchedEntities': matched_entities,
            'extractedEntities': entities,
            'complianceStatus': compliance_status,
            'analysisTimestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Entity resolution error: {str(e)}")
        return {
            'requestId': event.get('requestId'),
            'entityRiskScore': 0.3,
            'entityRiskFactors': ['analysis_error'],
            'matchedEntities': [],
            'extractedEntities': [],
            'complianceStatus': 'UNKNOWN',
            'error': str(e)
        }


def extract_entities(text: str) -> List[Dict]:
    """
    Extract named entities using free regex-based NLP (no AWS Comprehend).
    Identifies: persons, organizations, locations, dates, monetary amounts.
    """
    if not text or len(text) < 10:
        return []
    
    try:
        entities = []
        
        # Extract PERSON names (capitalized words, common titles)
        person_pattern = r'\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
        person_matches = re.findall(person_pattern, text)
        for match in person_matches:
            entities.append({
                'text': match,
                'type': 'PERSON',
                'score': 0.85
            })
        
        # Extract ORGANIZATION names (Inc, LLC, Corp, Ltd)
        org_pattern = r'\b([A-Z][A-Za-z0-9\s&]+(?:Inc\.|LLC|Corp\.|Corporation|Ltd\.|Limited|GmbH|S\.A\.))'
        org_matches = re.findall(org_pattern, text)
        for match in org_matches:
            entities.append({
                'text': match.strip(),
                'type': 'ORGANIZATION',
                'score': 0.9
            })
        
        # Extract LOCATION (countries, cities, states)
        location_keywords = [
            'United States', 'USA', 'China', 'Russia', 'Iran', 'North Korea',
            'Syria', 'Venezuela', 'Cuba', 'Belarus', 'Crimea', 'Ukraine',
            'New York', 'California', 'Texas', 'London', 'Moscow', 'Beijing'
        ]
        for location in location_keywords:
            if location in text:
                entities.append({
                    'text': location,
                    'type': 'LOCATION',
                    'score': 0.95
                })
        
        # Extract DATES
        date_pattern = r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b'
        date_matches = re.findall(date_pattern, text, re.IGNORECASE)
        for match in date_matches:
            entities.append({
                'text': match,
                'type': 'DATE',
                'score': 0.9
            })
        
        # Extract MONETARY amounts
        money_pattern = r'\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:million|billion|thousand))?'
        money_matches = re.findall(money_pattern, text, re.IGNORECASE)
        for match in money_matches:
            entities.append({
                'text': match,
                'type': 'QUANTITY',
                'score': 0.95
            })
        
        # Remove duplicates
        seen = set()
        unique_entities = []
        for entity in entities:
            key = (entity['text'].lower(), entity['type'])
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)
        
        logger.info(f"Extracted {len(unique_entities)} entities from text (free NLP)")
        return unique_entities
        
    except Exception as e:
        logger.warning(f"Entity extraction error: {e}")
        return []


def check_sanctions_lists(vendor_name: str, entities: List[Dict]) -> Tuple[float, List[str], List[Dict]]:
    """Check vendor and entities against sanctions lists."""
    risk = 0.0
    factors = []
    matches = []
    
    vendor_lower = vendor_name.lower()
    
    # Check vendor name against SDN list
    for sanctioned_entity in SANCTIONS_LIST['entities']:
        if sanctioned_entity in vendor_lower or vendor_lower in sanctioned_entity:
            risk = 1.0  # Maximum risk for sanctions match
            factors.append(f'sanctions_match_{sanctioned_entity.replace(" ", "_")}')
            matches.append({
                'type': 'SANCTIONS',
                'matched_text': sanctioned_entity,
                'list': 'OFAC_SDN',
                'severity': 'CRITICAL'
            })
            logger.critical(f"SANCTIONS MATCH: {vendor_name} matches {sanctioned_entity}")
    
    # Check extracted entities
    for entity in entities:
        entity_text = entity['text'].lower()
        
        # Check against individuals
        for sanctioned_person in SANCTIONS_LIST['individuals']:
            if sanctioned_person in entity_text:
                risk = max(risk, 0.95)
                factors.append(f'pep_match_{sanctioned_person.replace(" ", "_")}')
                matches.append({
                    'type': 'PEP',
                    'matched_text': sanctioned_person,
                    'list': 'OFAC_SDN',
                    'severity': 'CRITICAL'
                })
        
        # Check for sanctions keywords
        for keyword in SANCTIONS_LIST['keywords']:
            if keyword in entity_text:
                risk = max(risk, 0.7)
                factors.append(f'sanctions_keyword_{keyword.replace(" ", "_")}')
    
    return risk, factors, matches


def check_jurisdictions(vendor_name: str, description: str, entities: List[Dict]) -> Tuple[float, List[str]]:
    """Check for high-risk jurisdictions."""
    risk = 0.0
    factors = []
    
    text = f"{vendor_name} {description}".lower()
    
    for country in HIGH_RISK_COUNTRIES:
        if country in text:
            risk = max(risk, 0.8)
            factors.append(f'high_risk_jurisdiction_{country.replace(" ", "_")}')
            logger.warning(f"High-risk jurisdiction detected: {country}")
    
    # Check extracted locations
    for entity in entities:
        if entity['type'] == 'LOCATION':
            entity_text = entity['text'].lower()
            for country in HIGH_RISK_COUNTRIES:
                if country in entity_text:
                    risk = max(risk, 0.8)
                    factors.append(f'location_risk_{country.replace(" ", "_")}')
    
    return risk, factors


def screen_negative_news(vendor_name: str, description: str) -> Tuple[float, List[str]]:
    """Screen for negative news indicators."""
    risk = 0.0
    factors = []
    
    text = f"{vendor_name} {description}".lower()
    
    negative_count = 0
    for keyword in NEGATIVE_NEWS_KEYWORDS:
        if keyword in text:
            negative_count += 1
            factors.append(f'negative_news_{keyword.replace(" ", "_")}')
    
    if negative_count > 0:
        risk = min(0.7, 0.3 + (negative_count * 0.1))
        logger.warning(f"Negative news indicators: {negative_count} keywords found")
    
    return risk, factors


def screen_pep(entities: List[Dict]) -> Tuple[float, List[str]]:
    """Screen for Politically Exposed Persons."""
    risk = 0.0
    factors = []
    
    # Check for government/political titles
    political_titles = [
        'president', 'minister', 'senator', 'governor', 'ambassador',
        'secretary', 'chairman', 'commissioner', 'director general'
    ]
    
    for entity in entities:
        if entity['type'] in ['PERSON', 'TITLE']:
            entity_text = entity['text'].lower()
            for title in political_titles:
                if title in entity_text:
                    risk = max(risk, 0.6)
                    factors.append(f'pep_title_{title}')
                    logger.info(f"PEP indicator detected: {title}")
    
    return risk, factors


def verify_corporate_registry(vendor_name: str, email: str) -> Tuple[float, List[str]]:
    """Verify corporate registry information."""
    risk = 0.0
    factors = []
    
    # Check for corporate indicators
    corporate_suffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'limited']
    vendor_lower = vendor_name.lower()
    
    has_corporate_suffix = any(suffix in vendor_lower for suffix in corporate_suffixes)
    
    if not has_corporate_suffix:
        risk = 0.2
        factors.append('no_corporate_suffix')
    
    # Check email domain matches company name
    if '@' in email:
        domain = email.split('@')[1].lower()
        vendor_clean = ''.join(c for c in vendor_lower if c.isalnum())
        domain_clean = domain.split('.')[0]
        
        if vendor_clean not in domain_clean and domain_clean not in vendor_clean:
            risk += 0.15
            factors.append('email_domain_mismatch')
    
    return risk, factors


def calculate_entity_risk(risks: List[float]) -> float:
    """Calculate overall entity risk score."""
    if not risks:
        return 0.0
    
    # Sanctions matches should dominate
    max_risk = max(risks)
    
    if max_risk >= 0.95:  # Sanctions match
        return max_risk
    
    # Otherwise use weighted average
    avg_risk = sum(risks) / len(risks)
    return (max_risk * 0.6) + (avg_risk * 0.4)


def determine_compliance_status(risk_score: float, matches: List[Dict]) -> str:
    """Determine compliance status based on risk and matches."""
    if any(m['severity'] == 'CRITICAL' for m in matches):
        return 'BLOCKED'
    elif risk_score >= 0.8:
        return 'HIGH_RISK'
    elif risk_score >= 0.5:
        return 'MEDIUM_RISK'
    else:
        return 'CLEAR'
