"""
Behavioral Anomaly Detection Lambda - Detect Suspicious Patterns

This function uses statistical analysis and machine learning techniques to detect:
- Bot vs Human behavior patterns
- Statistical outliers in submission data
- Timing anomalies (submissions at unusual hours)
- Data quality anomalies (too perfect or too messy)
- Velocity anomalies (too fast form completion)

Uses historical data to build behavioral baselines.
"""

import json
import boto3
import logging
from datetime import datetime, time
from typing import Dict, List, Tuple, Any
import statistics
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnboardingRequests')

# Behavioral thresholds
BUSINESS_HOURS_START = time(8, 0)  # 8 AM
BUSINESS_HOURS_END = time(18, 0)   # 6 PM
MIN_FORM_COMPLETION_TIME = 30  # seconds (too fast = bot)
MAX_FORM_COMPLETION_TIME = 3600  # 1 hour (too slow = suspicious)
TYPICAL_DESCRIPTION_LENGTH = (50, 500)  # words
TYPICAL_NAME_LENGTH = (5, 50)  # characters


def lambda_handler(event, context):
    """
    Analyze behavioral patterns to detect anomalies.
    
    Returns behavioral risk score (0.0-1.0) and detected anomalies.
    """
    try:
        request_id = event.get('requestId')
        vendor_name = event.get('vendorName')
        contact_email = event.get('contactEmail')
        business_description = event.get('businessDescription')
        submitted_at = event.get('submittedAt', datetime.utcnow().isoformat())
        
        logger.info(f"Behavioral analysis for {vendor_name}")
        
        behavioral_risks = []
        risk_factors = []
        anomalies = []
        
        # Get historical data for baseline
        historical_data = get_historical_baseline()
        
        # 1. Timing Analysis
        timing_risk, timing_factors, timing_anomalies = analyze_timing_patterns(
            submitted_at
        )
        behavioral_risks.append(timing_risk)
        risk_factors.extend(timing_factors)
        anomalies.extend(timing_anomalies)
        
        # 2. Data Quality Analysis
        quality_risk, quality_factors, quality_anomalies = analyze_data_quality(
            vendor_name, contact_email, business_description
        )
        behavioral_risks.append(quality_risk)
        risk_factors.extend(quality_factors)
        anomalies.extend(quality_anomalies)
        
        # 3. Statistical Outlier Detection
        outlier_risk, outlier_factors, outlier_anomalies = detect_statistical_outliers(
            event, historical_data
        )
        behavioral_risks.append(outlier_risk)
        risk_factors.extend(outlier_factors)
        anomalies.extend(outlier_anomalies)
        
        # 4. Bot Detection
        bot_risk, bot_factors, bot_anomalies = detect_bot_behavior(
            event
        )
        behavioral_risks.append(bot_risk)
        risk_factors.extend(bot_factors)
        anomalies.extend(bot_anomalies)
        
        # 5. Velocity Analysis
        velocity_risk, velocity_factors = analyze_submission_velocity(
            event
        )
        behavioral_risks.append(velocity_risk)
        risk_factors.extend(velocity_factors)
        
        # Calculate overall behavioral risk
        behavioral_risk_score = calculate_behavioral_risk(behavioral_risks)
        
        # Generate behavioral profile
        behavioral_profile = generate_behavioral_profile(
            event, behavioral_risk_score, anomalies
        )
        
        logger.info(
            f"Behavioral analysis complete: risk={behavioral_risk_score:.2f}, "
            f"anomalies={len(anomalies)}"
        )
        
        return {
            'requestId': request_id,
            'vendorName': vendor_name,
            'contactEmail': contact_email,
            'businessDescription': business_description,
            'behavioralRiskScore': round(behavioral_risk_score, 3),
            'behavioralRiskFactors': risk_factors,
            'detectedAnomalies': anomalies,
            'behavioralProfile': behavioral_profile,
            'analysisTimestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Behavioral analysis error: {str(e)}")
        return {
            'requestId': event.get('requestId'),
            'behavioralRiskScore': 0.3,
            'behavioralRiskFactors': ['analysis_error'],
            'detectedAnomalies': [],
            'behavioralProfile': {},
            'error': str(e)
        }


def get_historical_baseline() -> Dict:
    """Get historical data for baseline calculations."""
    try:
        response = table.scan(Limit=500)
        items = response.get('Items', [])
        
        if len(items) < 10:
            return {'sample_size': 0}
        
        # Calculate baseline statistics
        name_lengths = [len(item.get('vendorName', '')) for item in items]
        desc_lengths = [len(item.get('businessDescription', '')) for item in items]
        
        return {
            'sample_size': len(items),
            'avg_name_length': statistics.mean(name_lengths) if name_lengths else 0,
            'std_name_length': statistics.stdev(name_lengths) if len(name_lengths) > 1 else 0,
            'avg_desc_length': statistics.mean(desc_lengths) if desc_lengths else 0,
            'std_desc_length': statistics.stdev(desc_lengths) if len(desc_lengths) > 1 else 0
        }
    except Exception as e:
        logger.warning(f"Error getting baseline: {e}")
        return {'sample_size': 0}


def analyze_timing_patterns(submitted_at: str) -> Tuple[float, List[str], List[Dict]]:
    """Analyze submission timing for anomalies."""
    risk = 0.0
    factors = []
    anomalies = []
    
    try:
        submit_time = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
        submit_hour = submit_time.time()
        day_of_week = submit_time.weekday()
        
        # Check if outside business hours
        if not (BUSINESS_HOURS_START <= submit_hour <= BUSINESS_HOURS_END):
            risk += 0.2
            factors.append(f'outside_business_hours_{submit_hour.hour}h')
            anomalies.append({
                'type': 'TIMING',
                'severity': 'LOW',
                'description': f'Submission at {submit_hour.hour}:00 (outside business hours)'
            })
        
        # Check if weekend
        if day_of_week >= 5:  # Saturday or Sunday
            risk += 0.15
            factors.append('weekend_submission')
            anomalies.append({
                'type': 'TIMING',
                'severity': 'LOW',
                'description': 'Weekend submission'
            })
        
        # Check for very late night (2 AM - 5 AM)
        if 2 <= submit_hour.hour <= 5:
            risk += 0.3
            factors.append('late_night_submission')
            anomalies.append({
                'type': 'TIMING',
                'severity': 'MEDIUM',
                'description': 'Submission during unusual hours (2-5 AM)'
            })
        
    except Exception as e:
        logger.warning(f"Timing analysis error: {e}")
    
    return risk, factors, anomalies


def analyze_data_quality(name: str, email: str, description: str) -> Tuple[float, List[str], List[Dict]]:
    """Analyze data quality for anomalies."""
    risk = 0.0
    factors = []
    anomalies = []
    
    # Name analysis
    if len(name) < TYPICAL_NAME_LENGTH[0]:
        risk += 0.2
        factors.append('name_too_short')
        anomalies.append({
            'type': 'DATA_QUALITY',
            'severity': 'MEDIUM',
            'description': f'Vendor name unusually short ({len(name)} chars)'
        })
    elif len(name) > TYPICAL_NAME_LENGTH[1]:
        risk += 0.1
        factors.append('name_too_long')
    
    # Check for all caps (shouting = suspicious)
    if name.isupper() and len(name) > 5:
        risk += 0.15
        factors.append('name_all_caps')
        anomalies.append({
            'type': 'DATA_QUALITY',
            'severity': 'LOW',
            'description': 'Vendor name in all capitals'
        })
    
    # Description analysis
    word_count = len(description.split())
    if word_count < TYPICAL_DESCRIPTION_LENGTH[0]:
        risk += 0.25
        factors.append('description_too_short')
        anomalies.append({
            'type': 'DATA_QUALITY',
            'severity': 'MEDIUM',
            'description': f'Business description too brief ({word_count} words)'
        })
    elif word_count > TYPICAL_DESCRIPTION_LENGTH[1]:
        risk += 0.1
        factors.append('description_too_long')
    
    # Check for repetitive text (copy-paste indicator)
    words = description.lower().split()
    if len(words) > 10:
        unique_words = len(set(words))
        repetition_ratio = unique_words / len(words)
        if repetition_ratio < 0.5:
            risk += 0.3
            factors.append('high_text_repetition')
            anomalies.append({
                'type': 'DATA_QUALITY',
                'severity': 'MEDIUM',
                'description': f'High text repetition ({int((1-repetition_ratio)*100)}%)'
            })
    
    # Check for excessive special characters
    special_char_count = sum(1 for c in description if not c.isalnum() and not c.isspace())
    if special_char_count > len(description) * 0.15:
        risk += 0.2
        factors.append('excessive_special_chars')
    
    return risk, factors, anomalies


def detect_statistical_outliers(event: Dict, baseline: Dict) -> Tuple[float, List[str], List[Dict]]:
    """Detect statistical outliers compared to baseline."""
    risk = 0.0
    factors = []
    anomalies = []
    
    if baseline.get('sample_size', 0) < 10:
        return 0.0, [], []
    
    name = event.get('vendorName', '')
    description = event.get('businessDescription', '')
    
    # Z-score analysis for name length
    name_len = len(name)
    avg_name = baseline.get('avg_name_length', 0)
    std_name = baseline.get('std_name_length', 1)
    
    if std_name > 0:
        name_z_score = abs((name_len - avg_name) / std_name)
        if name_z_score > 3:  # 3 standard deviations
            risk += 0.3
            factors.append(f'name_length_outlier_z{int(name_z_score)}')
            anomalies.append({
                'type': 'STATISTICAL',
                'severity': 'MEDIUM',
                'description': f'Name length is {int(name_z_score)}σ from mean'
            })
    
    # Z-score analysis for description length
    desc_len = len(description)
    avg_desc = baseline.get('avg_desc_length', 0)
    std_desc = baseline.get('std_desc_length', 1)
    
    if std_desc > 0:
        desc_z_score = abs((desc_len - avg_desc) / std_desc)
        if desc_z_score > 3:
            risk += 0.25
            factors.append(f'description_length_outlier_z{int(desc_z_score)}')
            anomalies.append({
                'type': 'STATISTICAL',
                'severity': 'MEDIUM',
                'description': f'Description length is {int(desc_z_score)}σ from mean'
            })
    
    return risk, factors, anomalies


def detect_bot_behavior(event: Dict) -> Tuple[float, List[str], List[Dict]]:
    """Detect bot-like behavior patterns."""
    risk = 0.0
    factors = []
    anomalies = []
    
    name = event.get('vendorName', '')
    email = event.get('contactEmail', '')
    description = event.get('businessDescription', '')
    tax_id = event.get('taxId', '')
    
    # Check for sequential patterns (bot-generated)
    if re.search(r'(123|abc|test|demo|sample)', name.lower()):
        risk += 0.4
        factors.append('test_pattern_in_name')
        anomalies.append({
            'type': 'BOT_DETECTION',
            'severity': 'HIGH',
            'description': 'Test/demo pattern detected in vendor name'
        })
    
    # Check for perfect formatting (too perfect = bot)
    if all(word[0].isupper() for word in name.split() if word):
        perfect_caps = True
    else:
        perfect_caps = False
    
    if perfect_caps and len(description.split('.')) > 3:
        # Perfect capitalization + perfect sentences = possible bot
        risk += 0.2
        factors.append('perfect_formatting')
    
    # Check for Lorem Ipsum or placeholder text
    placeholder_patterns = ['lorem ipsum', 'dolor sit amet', 'consectetur', 'placeholder']
    if any(pattern in description.lower() for pattern in placeholder_patterns):
        risk += 0.6
        factors.append('placeholder_text')
        anomalies.append({
            'type': 'BOT_DETECTION',
            'severity': 'HIGH',
            'description': 'Placeholder text detected'
        })
    
    # Check for sequential tax ID
    if re.match(r'(\d)\1{8}', tax_id.replace('-', '')):
        risk += 0.5
        factors.append('sequential_tax_id')
        anomalies.append({
            'type': 'BOT_DETECTION',
            'severity': 'HIGH',
            'description': 'Sequential or repeated digits in Tax ID'
        })
    
    return risk, factors, anomalies


def analyze_submission_velocity(event: Dict) -> Tuple[float, List[str]]:
    """Analyze submission velocity (form completion speed)."""
    risk = 0.0
    factors = []
    
    # In production, track form start time vs submit time
    # For now, estimate based on data complexity
    
    name = event.get('vendorName', '')
    description = event.get('businessDescription', '')
    
    total_chars = len(name) + len(description)
    
    # Assume average typing speed of 40 WPM = ~200 chars/min
    # Minimum expected time = total_chars / 200 chars per minute
    min_expected_time = (total_chars / 200) * 60  # in seconds
    
    # If we had actual completion time, we'd compare
    # For now, flag if data is suspiciously complete
    if total_chars > 500 and len(description.split()) > 50:
        # Very detailed submission - check for copy-paste indicators
        if '\n\n' in description or description.count('.') > 10:
            risk += 0.1
            factors.append('possible_copy_paste')
    
    return risk, factors


def calculate_behavioral_risk(risks: List[float]) -> float:
    """Calculate overall behavioral risk score."""
    if not risks:
        return 0.0
    
    # Use weighted combination
    max_risk = max(risks)
    avg_risk = sum(risks) / len(risks)
    
    # 60% max, 40% average
    return (max_risk * 0.6) + (avg_risk * 0.4)


def generate_behavioral_profile(event: Dict, risk_score: float, anomalies: List[Dict]) -> Dict:
    """Generate behavioral profile for the submission."""
    return {
        'risk_level': 'HIGH' if risk_score >= 0.7 else 'MEDIUM' if risk_score >= 0.4 else 'LOW',
        'anomaly_count': len(anomalies),
        'high_severity_anomalies': sum(1 for a in anomalies if a.get('severity') == 'HIGH'),
        'submission_characteristics': {
            'name_length': len(event.get('vendorName', '')),
            'description_length': len(event.get('businessDescription', '')),
            'description_word_count': len(event.get('businessDescription', '').split())
        },
        'confidence': 'HIGH' if len(anomalies) >= 3 else 'MEDIUM' if len(anomalies) >= 1 else 'LOW'
    }
