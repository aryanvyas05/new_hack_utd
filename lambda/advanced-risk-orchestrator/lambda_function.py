"""
Advanced Risk Orchestrator - Combines All Three Innovative Analyses

This Lambda orchestrates the three advanced risk analysis functions:
1. Network Analysis - Fraud ring detection
2. Entity Resolution - Sanctions & watchlist screening
3. Behavioral Analysis - Anomaly detection

Combines their outputs into a comprehensive risk assessment.
"""

import json
import boto3
import logging
from typing import Dict, Any, List

logger = logging.getLogger()
logger.setLevel(logging.INFO)

lambda_client = boto3.client('lambda')

# Lambda function names
NETWORK_ANALYSIS_FUNCTION = 'veritas-onboard-network-analysis'
ENTITY_RESOLUTION_FUNCTION = 'veritas-onboard-entity-resolution'
BEHAVIORAL_ANALYSIS_FUNCTION = 'veritas-onboard-behavioral-analysis'
PAYMENT_HISTORY_FUNCTION = 'veritas-onboard-payment-history'
LEGAL_RECORDS_FUNCTION = 'veritas-onboard-legal-records'

# Risk weights for final score
WEIGHTS = {
    'network': 0.15,
    'entity': 0.30,  # Highest weight - sanctions are critical
    'behavioral': 0.15,
    'payment': 0.15,  # Payment history
    'legal': 0.15,    # Legal records
    'fraud': 0.05,    # Original fraud detector
    'content': 0.05   # Original content analysis
}


def lambda_handler(event, context):
    """
    Orchestrate all advanced risk analyses and combine results.
    """
    try:
        request_id = event.get('requestId')
        logger.info(f"Advanced risk orchestration for request {request_id}")
        
        # Invoke all five advanced analysis functions in parallel
        results = invoke_parallel_analyses(event)
        
        # Extract individual risk scores
        network_risk = results.get('network', {}).get('networkRiskScore', 0.3)
        entity_risk = results.get('entity', {}).get('entityRiskScore', 0.3)
        behavioral_risk = results.get('behavioral', {}).get('behavioralRiskScore', 0.3)
        payment_risk = results.get('payment', {}).get('paymentRiskScore', 0.3)
        legal_risk = results.get('legal', {}).get('legalRiskScore', 0.3)
        
        # Get original scores if available
        fraud_risk = event.get('fraudScore', 0.3)
        content_risk = event.get('contentRiskScore', 0.3)
        
        # Calculate comprehensive risk score
        comprehensive_risk = calculate_comprehensive_risk(
            network_risk, entity_risk, behavioral_risk, payment_risk, legal_risk, fraud_risk, content_risk
        )
        
        # Determine final recommendation
        recommendation = determine_recommendation(
            comprehensive_risk, results
        )
        
        # Compile all risk factors
        all_risk_factors = compile_risk_factors(results)
        
        # Generate executive summary
        executive_summary = generate_executive_summary(
            comprehensive_risk, recommendation, results
        )
        
        logger.info(
            f"Advanced risk analysis complete: "
            f"comprehensive_risk={comprehensive_risk:.2f}, "
            f"recommendation={recommendation}"
        )
        
        return {
            'requestId': request_id,
            'vendorName': event.get('vendorName'),
            'contactEmail': event.get('contactEmail'),
            
            # Comprehensive scores
            'comprehensiveRiskScore': round(comprehensive_risk, 3),
            'recommendation': recommendation,
            
            # Individual analysis scores
            'networkRiskScore': round(network_risk, 3),
            'entityRiskScore': round(entity_risk, 3),
            'behavioralRiskScore': round(behavioral_risk, 3),
            'paymentRiskScore': round(payment_risk, 3),
            'legalRiskScore': round(legal_risk, 3),
            'fraudScore': round(fraud_risk, 3),
            'contentRiskScore': round(content_risk, 3),
            
            # Detailed results
            'networkAnalysis': results.get('network', {}),
            'entityResolution': results.get('entity', {}),
            'behavioralAnalysis': results.get('behavioral', {}),
            'paymentAnalysis': results.get('payment', {}),
            'legalAnalysis': results.get('legal', {}),
            
            # Summary
            'allRiskFactors': all_risk_factors,
            'executiveSummary': executive_summary,
            
            # Pass through other fields
            'businessDescription': event.get('businessDescription'),
            'taxId': event.get('taxId'),
            'sourceIp': event.get('sourceIp'),
            'submittedAt': event.get('submittedAt')
        }
        
    except Exception as e:
        logger.error(f"Advanced risk orchestration error: {str(e)}")
        # Return safe defaults
        return {
            'requestId': event.get('requestId'),
            'comprehensiveRiskScore': 0.5,
            'recommendation': 'MANUAL_REVIEW',
            'error': str(e)
        }


def invoke_parallel_analyses(event: Dict) -> Dict[str, Any]:
    """Invoke all five analysis functions in parallel."""
    results = {}
    
    # Prepare payload
    payload = json.dumps(event).encode('utf-8')
    
    # Invoke Network Analysis
    try:
        response = lambda_client.invoke(
            FunctionName=NETWORK_ANALYSIS_FUNCTION,
            InvocationType='RequestResponse',
            Payload=payload
        )
        results['network'] = json.loads(response['Payload'].read())
        logger.info("Network analysis completed")
    except Exception as e:
        logger.warning(f"Network analysis failed: {e}")
        results['network'] = {'networkRiskScore': 0.3, 'error': str(e)}
    
    # Invoke Entity Resolution
    try:
        response = lambda_client.invoke(
            FunctionName=ENTITY_RESOLUTION_FUNCTION,
            InvocationType='RequestResponse',
            Payload=payload
        )
        results['entity'] = json.loads(response['Payload'].read())
        logger.info("Entity resolution completed")
    except Exception as e:
        logger.warning(f"Entity resolution failed: {e}")
        results['entity'] = {'entityRiskScore': 0.3, 'error': str(e)}
    
    # Invoke Behavioral Analysis
    try:
        response = lambda_client.invoke(
            FunctionName=BEHAVIORAL_ANALYSIS_FUNCTION,
            InvocationType='RequestResponse',
            Payload=payload
        )
        results['behavioral'] = json.loads(response['Payload'].read())
        logger.info("Behavioral analysis completed")
    except Exception as e:
        logger.warning(f"Behavioral analysis failed: {e}")
        results['behavioral'] = {'behavioralRiskScore': 0.3, 'error': str(e)}
    
    # Invoke Payment History Analysis
    try:
        response = lambda_client.invoke(
            FunctionName=PAYMENT_HISTORY_FUNCTION,
            InvocationType='RequestResponse',
            Payload=payload
        )
        results['payment'] = json.loads(response['Payload'].read())
        logger.info("Payment history analysis completed")
    except Exception as e:
        logger.warning(f"Payment history analysis failed: {e}")
        results['payment'] = {'paymentRiskScore': 0.3, 'error': str(e)}
    
    # Invoke Legal Records Check
    try:
        response = lambda_client.invoke(
            FunctionName=LEGAL_RECORDS_FUNCTION,
            InvocationType='RequestResponse',
            Payload=payload
        )
        results['legal'] = json.loads(response['Payload'].read())
        logger.info("Legal records check completed")
    except Exception as e:
        logger.warning(f"Legal records check failed: {e}")
        results['legal'] = {'legalRiskScore': 0.3, 'error': str(e)}
    
    return results


def calculate_comprehensive_risk(
    network: float, entity: float, behavioral: float, payment: float, legal: float, fraud: float, content: float
) -> float:
    """Calculate weighted comprehensive risk score."""
    comprehensive = (
        network * WEIGHTS['network'] +
        entity * WEIGHTS['entity'] +
        behavioral * WEIGHTS['behavioral'] +
        payment * WEIGHTS['payment'] +
        legal * WEIGHTS['legal'] +
        fraud * WEIGHTS['fraud'] +
        content * WEIGHTS['content']
    )
    
    # If entity risk is critical (sanctions match), override
    if entity >= 0.95:
        comprehensive = max(comprehensive, 0.95)
    
    # If legal risk is critical (criminal/fraud), override
    if legal >= 0.9:
        comprehensive = max(comprehensive, 0.9)
    
    return min(1.0, comprehensive)


def determine_recommendation(risk_score: float, results: Dict) -> str:
    """Determine final recommendation based on comprehensive analysis."""
    # Check for critical blocks
    entity_data = results.get('entity', {})
    if entity_data.get('complianceStatus') == 'BLOCKED':
        return 'BLOCKED'
    
    # Check for sanctions matches
    matched_entities = entity_data.get('matchedEntities', [])
    if any(m.get('severity') == 'CRITICAL' for m in matched_entities):
        return 'BLOCKED'
    
    # Risk-based recommendations
    if risk_score >= 0.7:
        return 'MANUAL_REVIEW'
    elif risk_score >= 0.5:
        return 'ENHANCED_DUE_DILIGENCE'
    elif risk_score >= 0.3:
        return 'STANDARD_REVIEW'
    else:
        return 'AUTO_APPROVE'


def compile_risk_factors(results: Dict) -> List[str]:
    """Compile all risk factors from all analyses."""
    all_factors = []
    
    # Network factors
    network_factors = results.get('network', {}).get('networkRiskFactors', [])
    all_factors.extend([f'network:{f}' for f in network_factors])
    
    # Entity factors
    entity_factors = results.get('entity', {}).get('entityRiskFactors', [])
    all_factors.extend([f'entity:{f}' for f in entity_factors])
    
    # Behavioral factors
    behavioral_factors = results.get('behavioral', {}).get('behavioralRiskFactors', [])
    all_factors.extend([f'behavioral:{f}' for f in behavioral_factors])
    
    # Payment factors
    payment_factors = results.get('payment', {}).get('paymentRiskFactors', [])
    all_factors.extend([f'payment:{f}' for f in payment_factors])
    
    # Legal factors
    legal_factors = results.get('legal', {}).get('legalRiskFactors', [])
    all_factors.extend([f'legal:{f}' for f in legal_factors])
    
    return all_factors


def generate_executive_summary(risk_score: float, recommendation: str, results: Dict) -> Dict:
    """Generate executive summary of the risk assessment."""
    summary = {
        'overall_risk_level': 'CRITICAL' if risk_score >= 0.8 else 
                             'HIGH' if risk_score >= 0.6 else
                             'MEDIUM' if risk_score >= 0.4 else 'LOW',
        'recommendation': recommendation,
        'key_findings': []
    }
    
    # Add key findings from each analysis
    network_data = results.get('network', {})
    if network_data.get('networkRiskScore', 0) >= 0.6:
        summary['key_findings'].append({
            'category': 'Network Analysis',
            'severity': 'HIGH',
            'finding': f"Detected {len(network_data.get('networkRiskFactors', []))} network risk factors"
        })
    
    entity_data = results.get('entity', {})
    matched_entities = entity_data.get('matchedEntities', [])
    if matched_entities:
        summary['key_findings'].append({
            'category': 'Entity Resolution',
            'severity': 'CRITICAL',
            'finding': f"Matched {len(matched_entities)} entities on watchlists"
        })
    
    behavioral_data = results.get('behavioral', {})
    anomalies = behavioral_data.get('detectedAnomalies', [])
    if len(anomalies) >= 3:
        summary['key_findings'].append({
            'category': 'Behavioral Analysis',
            'severity': 'MEDIUM',
            'finding': f"Detected {len(anomalies)} behavioral anomalies"
        })
    
    return summary
