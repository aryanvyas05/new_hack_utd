"""
Enhanced Fraud Detector - Combines Trust Calculator + Advanced Analyses

Returns comprehensive data for visualization:
- Trust signals (website, SSL, MX records)
- Network analysis (if multiple submissions detected)
- Entity extraction (from Comprehend)
- Behavioral indicators
"""

import json
import boto3
import logging
from typing import Dict, Any, Tuple, List, Optional
import urllib.request
import socket
import ssl

logger = logging.getLogger()
logger.setLevel(logging.INFO)

comprehend = boto3.client('comprehend')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnboardingRequests')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Enhanced fraud detection with visualization data."""
    try:
        request_id = event.get('requestId', 'unknown')
        vendor_name = event.get('vendorName', '')
        email = event.get('contactEmail', '')
        description = event.get('businessDescription', '')
        source_ip = event.get('sourceIp', 'unknown')
        
        logger.info(f"Enhanced analysis for: {vendor_name}")
        
        domain = email.split('@')[1] if '@' in email else None
        if not domain:
            return create_error_response(request_id, 0.95)
        
        # 1. TRUST SIGNALS (for visualization)
        trust_signals = calculate_trust_signals(domain)
        
        # 2. NETWORK ANALYSIS (check for patterns)
        network_analysis = analyze_network_patterns(source_ip, email, description)
        
        # 3. ENTITY EXTRACTION (for visualization)
        entities = extract_entities_safe(description, vendor_name)
        
        # 4. BEHAVIORAL INDICATORS
        behavioral_indicators = analyze_behavioral_indicators(
            vendor_name, email, description
        )
        
        # Calculate final risk score
        trust_score = trust_signals['total_score']
        network_risk = network_analysis['risk_score']
        behavioral_risk = behavioral_indicators['risk_score']
        
        # Weighted combination
        final_risk = (
            (1.0 - trust_score/100.0) * 0.6 +  # Trust is 60%
            network_risk * 0.25 +                # Network is 25%
            behavioral_risk * 0.15               # Behavioral is 15%
        )
        final_risk = max(0.05, min(0.95, final_risk))
        
        logger.info(f"Final risk for {vendor_name}: {final_risk:.2f}")
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'contactEmail': email,
            'businessDescription': description,
            'sourceIp': source_ip,
            'fraudScore': round(final_risk, 3),
            'modelVersion': 'enhanced-v1',
            'riskFactors': collect_risk_factors(trust_signals, network_analysis, behavioral_indicators),
            
            # Visualization data
            'trustSignals': trust_signals,
            'networkAnalysis': network_analysis,
            'entities': entities,
            'behavioralIndicators': behavioral_indicators,
            'visualizationData': {
                'trustBreakdown': create_trust_breakdown(trust_signals),
                'networkGraph': network_analysis.get('graph', {}),
                'entityCloud': create_entity_cloud(entities),
                'riskGauge': {
                    'value': round(final_risk * 100, 1),
                    'label': get_risk_label(final_risk),
                    'color': get_risk_color(final_risk)
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return create_error_response(event.get('requestId'), 0.50)


def calculate_trust_signals(domain: str) -> Dict:
    """Calculate trust signals with scores."""
    signals = {
        'website': {'exists': False, 'https': False, 'score': 0},
        'email': {'has_mx': False, 'score': 0},
        'ssl': {'valid': False, 'score': 0},
        'domain': {'trusted_tld': False, 'score': 0},
        'total_score': 0
    }
    
    # Website check
    try:
        url = f"https://{domain}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        urllib.request.urlopen(req, timeout=5)
        signals['website'] = {'exists': True, 'https': True, 'score': 30}
    except:
        try:
            url = f"http://{domain}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            urllib.request.urlopen(req, timeout=5)
            signals['website'] = {'exists': True, 'https': False, 'score': 15}
        except:
            signals['website'] = {'exists': False, 'https': False, 'score': 0}
    
    # MX records check
    try:
        import dns.resolver
        mx_records = dns.resolver.resolve(domain, 'MX')
        signals['email'] = {'has_mx': True, 'mx_count': len(mx_records), 'score': 20}
    except:
        try:
            socket.gethostbyname(domain)
            signals['email'] = {'has_mx': True, 'mx_count': 1, 'score': 15}
        except:
            signals['email'] = {'has_mx': False, 'score': 0}
    
    # SSL check
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                signals['ssl'] = {'valid': True, 'issuer': 'Valid', 'score': 15}
    except:
        signals['ssl'] = {'valid': False, 'score': 0}
    
    # Domain reputation
    trusted_tlds = ['.com', '.org', '.net', '.edu', '.gov']
    if any(domain.endswith(tld) for tld in trusted_tlds):
        signals['domain'] = {'trusted_tld': True, 'score': 20}
    else:
        signals['domain'] = {'trusted_tld': False, 'score': 10}
    
    # Calculate total
    signals['total_score'] = sum(s['score'] for s in signals.values() if isinstance(s, dict) and 'score' in s)
    
    return signals


def analyze_network_patterns(source_ip: str, email: str, description: str) -> Dict:
    """Analyze network patterns for fraud rings."""
    analysis = {
        'risk_score': 0.0,
        'patterns_detected': [],
        'graph': {'nodes': [], 'edges': []}
    }
    
    try:
        # Get recent submissions
        response = table.scan(Limit=100)
        items = response.get('Items', [])
        
        # Check IP clustering
        same_ip_count = sum(1 for item in items if item.get('sourceIp') == source_ip)
        if same_ip_count >= 3:
            analysis['risk_score'] += 0.4
            analysis['patterns_detected'].append(f'ip_clustering_{same_ip_count}_vendors')
        
        # Check email domain patterns
        domain = email.split('@')[1] if '@' in email else ''
        same_domain_count = sum(
            1 for item in items 
            if '@' in item.get('contactEmail', '') and 
            item.get('contactEmail', '').split('@')[1] == domain
        )
        if same_domain_count >= 5:
            analysis['risk_score'] += 0.3
            analysis['patterns_detected'].append(f'domain_sharing_{same_domain_count}_vendors')
        
        # Build simple graph
        analysis['graph'] = {
            'nodes': [{'id': 'current', 'type': 'current_vendor'}],
            'edges': [],
            'clusters': same_ip_count if same_ip_count >= 2 else 0
        }
        
    except Exception as e:
        logger.warning(f"Network analysis error: {e}")
    
    return analysis


def extract_entities_safe(description: str, vendor_name: str) -> List[Dict]:
    """Extract entities using Comprehend (with permission check)."""
    entities = []
    
    if not description or len(description) < 20:
        return entities
    
    try:
        response = comprehend.detect_entities(
            Text=description[:5000],
            LanguageCode='en'
        )
        
        entities = [
            {
                'text': e['Text'],
                'type': e['Type'],
                'score': round(e['Score'], 2)
            }
            for e in response.get('Entities', [])
            if e['Score'] > 0.7
        ]
        
        logger.info(f"Extracted {len(entities)} entities")
        
    except Exception as e:
        logger.warning(f"Entity extraction failed: {e}")
        # Fallback: basic entity extraction
        entities = [
            {'text': vendor_name, 'type': 'ORGANIZATION', 'score': 1.0}
        ]
    
    return entities


def analyze_behavioral_indicators(vendor_name: str, email: str, description: str) -> Dict:
    """Analyze behavioral indicators."""
    indicators = {
        'risk_score': 0.0,
        'flags': [],
        'metrics': {}
    }
    
    # Check description length
    word_count = len(description.split())
    indicators['metrics']['description_length'] = word_count
    
    if word_count < 20:
        indicators['risk_score'] += 0.2
        indicators['flags'].append('description_too_short')
    elif word_count > 500:
        indicators['risk_score'] += 0.1
        indicators['flags'].append('description_unusually_long')
    
    # Check name length
    name_length = len(vendor_name)
    indicators['metrics']['name_length'] = name_length
    
    if name_length < 5:
        indicators['risk_score'] += 0.15
        indicators['flags'].append('name_too_short')
    
    # Check for all caps (suspicious)
    if vendor_name.isupper() and name_length > 5:
        indicators['risk_score'] += 0.1
        indicators['flags'].append('name_all_caps')
    
    return indicators


def collect_risk_factors(trust_signals: Dict, network: Dict, behavioral: Dict) -> List[str]:
    """Collect all risk factors."""
    factors = []
    
    if trust_signals['total_score'] < 50:
        factors.append('low_trust_score')
    if not trust_signals['website']['exists']:
        factors.append('no_website')
    if not trust_signals['email']['has_mx']:
        factors.append('no_mx_records')
    
    factors.extend(network['patterns_detected'])
    factors.extend(behavioral['flags'])
    
    return factors


def create_trust_breakdown(signals: Dict) -> List[Dict]:
    """Create trust breakdown for visualization."""
    return [
        {'category': 'Website', 'score': signals['website']['score'], 'max': 30},
        {'category': 'Email', 'score': signals['email']['score'], 'max': 20},
        {'category': 'SSL', 'score': signals['ssl']['score'], 'max': 15},
        {'category': 'Domain', 'score': signals['domain']['score'], 'max': 20}
    ]


def create_entity_cloud(entities: List[Dict]) -> List[Dict]:
    """Create entity cloud data for visualization."""
    return [
        {
            'text': e['text'],
            'type': e['type'],
            'size': int(e['score'] * 100)
        }
        for e in entities[:10]  # Top 10 entities
    ]


def get_risk_label(risk: float) -> str:
    """Get risk label."""
    if risk >= 0.7:
        return 'High Risk'
    elif risk >= 0.4:
        return 'Medium Risk'
    elif risk >= 0.2:
        return 'Low Risk'
    return 'Very Low Risk'


def get_risk_color(risk: float) -> str:
    """Get risk color."""
    if risk >= 0.7:
        return '#EF4444'  # Red
    elif risk >= 0.4:
        return '#F59E0B'  # Yellow
    elif risk >= 0.2:
        return '#10B981'  # Green
    return '#059669'  # Dark green


def create_error_response(request_id: str, risk_score: float) -> Dict:
    """Create error response."""
    return {
        'requestId': request_id,
        'fraudScore': risk_score,
        'modelVersion': 'enhanced-v1',
        'riskFactors': ['analysis_error'],
        'trustSignals': {},
        'networkAnalysis': {},
        'entities': [],
        'behavioralIndicators': {},
        'visualizationData': {}
    }
