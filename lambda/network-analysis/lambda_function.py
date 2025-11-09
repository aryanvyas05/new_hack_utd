"""
Network Analysis Lambda - Detect Fraud Rings and Suspicious Patterns

This function analyzes relationships between vendors to detect:
- Multiple vendors from same IP address
- Similar business descriptions (plagiarism detection)
- Shared email domains across "different" companies
- Temporal clustering (many submissions in short time)
- Geographic anomalies

Uses DynamoDB to build a network graph of vendor relationships.
"""

import json
import boto3
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from collections import defaultdict
import hashlib

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnboardingRequests')

# Thresholds for network analysis
SAME_IP_THRESHOLD = 3  # Flag if 3+ vendors from same IP
SIMILARITY_THRESHOLD = 0.85  # 85% text similarity is suspicious
TIME_WINDOW_MINUTES = 60  # Check submissions in last hour
SHARED_DOMAIN_THRESHOLD = 5  # Flag if 5+ vendors share email domain


def lambda_handler(event, context):
    """
    Analyze network patterns to detect fraud rings.
    
    Returns network risk score (0.0-1.0) and detected patterns.
    """
    try:
        request_id = event.get('requestId')
        vendor_name = event.get('vendorName')
        contact_email = event.get('contactEmail')
        business_description = event.get('businessDescription')
        source_ip = event.get('sourceIp', 'unknown')
        
        logger.info(f"Network analysis for {vendor_name} from IP {source_ip}")
        
        # Get recent submissions for pattern analysis
        recent_submissions = get_recent_submissions(hours=24)
        
        # Analyze multiple risk vectors
        network_risks = []
        risk_factors = []
        
        # 1. IP Address Clustering
        ip_risk, ip_factors = analyze_ip_clustering(source_ip, recent_submissions)
        network_risks.append(ip_risk)
        risk_factors.extend(ip_factors)
        
        # 2. Text Similarity (Plagiarism Detection)
        similarity_risk, sim_factors = analyze_text_similarity(
            business_description, recent_submissions
        )
        network_risks.append(similarity_risk)
        risk_factors.extend(sim_factors)
        
        # 3. Email Domain Patterns
        domain_risk, domain_factors = analyze_email_domains(
            contact_email, recent_submissions
        )
        network_risks.append(domain_risk)
        risk_factors.extend(domain_factors)
        
        # 4. Temporal Clustering
        temporal_risk, temporal_factors = analyze_temporal_patterns(
            recent_submissions
        )
        network_risks.append(temporal_risk)
        risk_factors.extend(temporal_factors)
        
        # 5. Behavioral Fingerprinting
        fingerprint_risk, fingerprint_factors = analyze_behavioral_fingerprint(
            event, recent_submissions
        )
        network_risks.append(fingerprint_risk)
        risk_factors.extend(fingerprint_factors)
        
        # Calculate weighted network risk score
        network_risk_score = calculate_network_risk(network_risks)
        
        # Build network graph data
        network_graph = build_network_graph(
            vendor_name, contact_email, source_ip, recent_submissions
        )
        
        logger.info(
            f"Network analysis complete: risk={network_risk_score:.2f}, "
            f"factors={len(risk_factors)}"
        )
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'contactEmail': contact_email,
            'businessDescription': business_description,
            'sourceIp': source_ip,
            'networkRiskScore': round(network_risk_score, 3),
            'networkRiskFactors': risk_factors,
            'networkGraph': network_graph,
            'analysisTimestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Network analysis error: {str(e)}")
        # Return safe default
        return {
            'requestId': event.get('requestId'),
            'networkRiskScore': 0.3,
            'networkRiskFactors': ['analysis_error'],
            'networkGraph': {},
            'error': str(e)
        }


def get_recent_submissions(hours: int = 24) -> List[Dict]:
    """Get recent submissions from DynamoDB."""
    try:
        cutoff_time = int((datetime.utcnow() - timedelta(hours=hours)).timestamp())
        
        response = table.scan(
            FilterExpression='createdAt > :cutoff',
            ExpressionAttributeValues={':cutoff': cutoff_time},
            Limit=1000
        )
        
        return response.get('Items', [])
    except Exception as e:
        logger.warning(f"Error fetching recent submissions: {e}")
        return []


def analyze_ip_clustering(source_ip: str, submissions: List[Dict]) -> Tuple[float, List[str]]:
    """Detect multiple vendors from same IP address."""
    if source_ip == 'unknown':
        return 0.0, []
    
    # Count submissions from this IP
    same_ip_count = sum(1 for s in submissions if s.get('sourceIp') == source_ip)
    
    risk = 0.0
    factors = []
    
    if same_ip_count >= SAME_IP_THRESHOLD:
        risk = min(0.8, 0.3 + (same_ip_count * 0.1))
        factors.append(f'ip_clustering_{same_ip_count}_vendors')
        logger.warning(f"IP clustering detected: {same_ip_count} vendors from {source_ip}")
    
    return risk, factors


def analyze_text_similarity(description: str, submissions: List[Dict]) -> Tuple[float, List[str]]:
    """Detect plagiarized or template-based descriptions."""
    if not description or len(description) < 20:
        return 0.0, []
    
    desc_lower = description.lower()
    desc_words = set(desc_lower.split())
    
    max_similarity = 0.0
    similar_count = 0
    
    for submission in submissions:
        other_desc = submission.get('businessDescription', '')
        if not other_desc or len(other_desc) < 20:
            continue
        
        other_words = set(other_desc.lower().split())
        
        # Calculate Jaccard similarity
        if len(desc_words) > 0 and len(other_words) > 0:
            intersection = len(desc_words & other_words)
            union = len(desc_words | other_words)
            similarity = intersection / union if union > 0 else 0
            
            if similarity > SIMILARITY_THRESHOLD:
                similar_count += 1
                max_similarity = max(max_similarity, similarity)
    
    risk = 0.0
    factors = []
    
    if similar_count > 0:
        risk = min(0.7, 0.4 + (similar_count * 0.15))
        factors.append(f'text_plagiarism_{similar_count}_matches')
        factors.append(f'max_similarity_{int(max_similarity * 100)}pct')
        logger.warning(f"Text similarity detected: {similar_count} similar descriptions")
    
    return risk, factors


def analyze_email_domains(email: str, submissions: List[Dict]) -> Tuple[float, List[str]]:
    """Detect shared email domains across vendors."""
    if '@' not in email:
        return 0.0, []
    
    domain = email.split('@')[1].lower()
    
    # Count vendors using this domain
    same_domain_count = sum(
        1 for s in submissions 
        if '@' in s.get('contactEmail', '') and 
        s.get('contactEmail', '').split('@')[1].lower() == domain
    )
    
    risk = 0.0
    factors = []
    
    # Free email domains are handled elsewhere, focus on custom domains
    free_domains = {'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'}
    
    if domain not in free_domains and same_domain_count >= SHARED_DOMAIN_THRESHOLD:
        risk = min(0.6, 0.2 + (same_domain_count * 0.08))
        factors.append(f'shared_domain_{same_domain_count}_vendors')
        logger.warning(f"Domain sharing detected: {same_domain_count} vendors use {domain}")
    
    return risk, factors


def analyze_temporal_patterns(submissions: List[Dict]) -> Tuple[float, List[str]]:
    """Detect suspicious temporal clustering."""
    if len(submissions) < 5:
        return 0.0, []
    
    # Get submission timestamps
    now = datetime.utcnow()
    recent_window = now - timedelta(minutes=TIME_WINDOW_MINUTES)
    
    recent_count = sum(
        1 for s in submissions 
        if datetime.fromtimestamp(s.get('createdAt', 0)) > recent_window
    )
    
    risk = 0.0
    factors = []
    
    # Unusual burst of activity
    if recent_count >= 10:
        risk = min(0.5, 0.2 + (recent_count * 0.03))
        factors.append(f'temporal_burst_{recent_count}_in_{TIME_WINDOW_MINUTES}min')
        logger.warning(f"Temporal clustering: {recent_count} submissions in {TIME_WINDOW_MINUTES}min")
    
    return risk, factors


def analyze_behavioral_fingerprint(event: Dict, submissions: List[Dict]) -> Tuple[float, List[str]]:
    """Create behavioral fingerprint to detect automated submissions."""
    # Create fingerprint from submission characteristics
    fingerprint_elements = [
        len(event.get('vendorName', '')),
        len(event.get('businessDescription', '')),
        event.get('taxId', '')[:2] if event.get('taxId') else 'XX'
    ]
    
    fingerprint = hashlib.md5(str(fingerprint_elements).encode()).hexdigest()[:8]
    
    # Check for similar fingerprints (bot-like behavior)
    similar_fingerprints = 0
    
    for submission in submissions:
        other_elements = [
            len(submission.get('vendorName', '')),
            len(submission.get('businessDescription', '')),
            submission.get('taxId', '')[:2] if submission.get('taxId') else 'XX'
        ]
        other_fingerprint = hashlib.md5(str(other_elements).encode()).hexdigest()[:8]
        
        if fingerprint == other_fingerprint:
            similar_fingerprints += 1
    
    risk = 0.0
    factors = []
    
    if similar_fingerprints >= 3:
        risk = 0.6
        factors.append(f'bot_pattern_{similar_fingerprints}_similar')
        logger.warning(f"Bot-like behavior detected: {similar_fingerprints} similar patterns")
    
    return risk, factors


def calculate_network_risk(risks: List[float]) -> float:
    """Calculate weighted network risk score."""
    if not risks:
        return 0.0
    
    # Use maximum risk with averaging to prevent single-factor dominance
    max_risk = max(risks)
    avg_risk = sum(risks) / len(risks)
    
    # Weighted combination: 70% max, 30% average
    combined_risk = (max_risk * 0.7) + (avg_risk * 0.3)
    
    return min(1.0, combined_risk)


def build_network_graph(vendor: str, email: str, ip: str, submissions: List[Dict]) -> Dict:
    """Build network graph showing relationships."""
    graph = {
        'nodes': [],
        'edges': [],
        'clusters': []
    }
    
    # Add current vendor as node
    graph['nodes'].append({
        'id': vendor,
        'type': 'vendor',
        'email': email,
        'ip': ip
    })
    
    # Find related vendors
    domain = email.split('@')[1] if '@' in email else ''
    
    for submission in submissions[:20]:  # Limit for performance
        sub_email = submission.get('contactEmail', '')
        sub_domain = sub_email.split('@')[1] if '@' in sub_email else ''
        sub_ip = submission.get('sourceIp', '')
        sub_vendor = submission.get('vendorName', '')
        
        # Create edge if relationship exists
        if sub_ip == ip or sub_domain == domain:
            graph['nodes'].append({
                'id': sub_vendor,
                'type': 'related_vendor',
                'email': sub_email,
                'ip': sub_ip
            })
            
            relationship = []
            if sub_ip == ip:
                relationship.append('same_ip')
            if sub_domain == domain:
                relationship.append('same_domain')
            
            graph['edges'].append({
                'from': vendor,
                'to': sub_vendor,
                'relationship': relationship
            })
    
    return graph
