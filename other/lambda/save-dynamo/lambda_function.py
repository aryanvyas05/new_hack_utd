"""
Lambda function to save onboarding request data to DynamoDB.

This function writes complete onboarding records including vendor information,
risk scores, status, timestamps, and audit trail to the OnboardingRequests table.
"""

import json
import boto3
import logging
import os
import time
from typing import Dict, Any, List
from decimal import Decimal

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb')

# Get table name from environment variable
TABLE_NAME = os.environ.get('TABLE_NAME', 'OnboardingRequests')

# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF = 1  # seconds
BACKOFF_MULTIPLIER = 2


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler to save onboarding request to DynamoDB.
    
    Args:
        event: Input event containing complete onboarding data and status
        context: Lambda context object
    
    Returns:
        Dictionary containing success status and saved item details
    """
    try:
        request_id = event.get('requestId', 'unknown')
        logger.info(f"Saving onboarding request to DynamoDB: {request_id}")
        
        # Build complete DynamoDB item
        item = build_dynamodb_item(event)
        
        # Save to DynamoDB with retry logic
        save_with_retry(item)
        
        logger.info(f"Successfully saved request {request_id} to DynamoDB")
        
        return {
            'statusCode': 200,
            'requestId': request_id,
            'status': item['status']['S'],
            'message': 'Successfully saved to DynamoDB'
        }
        
    except Exception as e:
        request_id = event.get('requestId', 'unknown')
        logger.error(f"Failed to save request {request_id} to DynamoDB: {str(e)}")
        raise


def build_dynamodb_item(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build complete DynamoDB item with all fields.
    
    Args:
        event: Input event containing onboarding data
    
    Returns:
        DynamoDB item in AttributeValue format
    """
    # Extract core fields
    request_id = event.get('requestId', '')
    status = event.get('status', 'SUBMITTED')
    
    # Extract redacted data
    redacted_data = event.get('redactedData', {})
    vendor_name = redacted_data.get('vendorName', event.get('vendorName', ''))
    contact_email = redacted_data.get('contactEmail', event.get('contactEmail', ''))
    business_description = redacted_data.get('businessDescription', event.get('businessDescription', ''))
    tax_id = redacted_data.get('taxId', event.get('taxId', ''))
    source_ip = event.get('sourceIp', '')
    
    # Extract risk scores - handle both old nested format and new flat format
    final_risk = event.get('finalRisk', {})
    combined_risk_score = final_risk.get('combinedRiskScore', event.get('combinedRiskScore', 0.0))
    
    # Try new flat format first
    fraud_score = event.get('fraudScore', 0.0)
    content_risk_score = event.get('contentRiskScore', 0.0)
    network_risk_score = event.get('networkRiskScore', 0.0)
    entity_risk_score = event.get('entityRiskScore', 0.0)
    behavioral_risk_score = event.get('behavioralRiskScore', 0.0)
    payment_risk_score = event.get('paymentRiskScore', 0.0)
    legal_risk_score = event.get('legalRiskScore', 0.0)
    trust_score = event.get('trustScore', 0.0)
    
    # Fallback to old nested format if flat format not found
    if fraud_score == 0.0 and content_risk_score == 0.0:
        risk_assessments = event.get('riskAssessments', [])
        fraud_result = {}
        comprehend_result = {}
        
        if isinstance(risk_assessments, list) and len(risk_assessments) >= 2:
            fraud_result = risk_assessments[0].get('fraudResult', {})
            comprehend_result = risk_assessments[1].get('comprehendResult', {})
        
        fraud_score = fraud_result.get('fraudScore', 0.0)
        content_risk_score = comprehend_result.get('contentRiskScore', 0.0)
    else:
        # Use flat format data
        fraud_result = {
            'fraudScore': fraud_score,
            'modelVersion': event.get('modelVersion', 'trust-calculator-v1'),
            'riskFactors': event.get('riskFactors', [])
        }
        comprehend_result = {
            'contentRiskScore': content_risk_score,
            'sentiment': event.get('sentiment', 'NEUTRAL'),
            'keyPhrases': event.get('keyPhrases', [])
        }
    
    # Get current timestamp
    current_timestamp = int(time.time())
    
    # Build audit trail
    audit_trail = build_audit_trail(event, current_timestamp)
    
    # Build DynamoDB item in AttributeValue format
    item = {
        'requestId': {'S': request_id},
        'status': {'S': status},
        'vendorName': {'S': vendor_name},
        'contactEmail': {'S': contact_email},
        'businessDescription': {'S': business_description},
        'taxId': {'S': tax_id},
        'sourceIp': {'S': source_ip},
        'createdAt': {'N': str(current_timestamp)},
        'updatedAt': {'N': str(current_timestamp)},
        'riskScores': {
            'M': {
                'fraudScore': {'N': str(fraud_score)},
                'contentRiskScore': {'N': str(content_risk_score)},
                'combinedRiskScore': {'N': str(combined_risk_score)},
                'networkRiskScore': {'N': str(network_risk_score)},
                'entityRiskScore': {'N': str(entity_risk_score)},
                'behavioralRiskScore': {'N': str(behavioral_risk_score)},
                'paymentRiskScore': {'N': str(payment_risk_score)},
                'legalRiskScore': {'N': str(legal_risk_score)},
                'trustScore': {'N': str(trust_score)},
                'comprehensiveRiskScore': {'N': str(event.get('comprehensiveRiskScore', combined_risk_score))}
            }
        },
        'fraudDetails': {
            'M': {
                'modelVersion': {'S': fraud_result.get('modelVersion', event.get('modelVersion', 'unknown'))},
                'riskFactors': {
                    'L': [{'S': factor} for factor in (fraud_result.get('riskFactors', event.get('riskFactors', [])))]
                },
                'trustSignals': {'S': json.dumps(event.get('trustSignals', {}))},
                'networkAnalysis': {'S': json.dumps(event.get('networkAnalysis', {}))},
                'entities': {'S': json.dumps(event.get('entities', []))},
                'behavioralIndicators': {'S': json.dumps(event.get('behavioralIndicators', {}))},
                'visualizationData': {'S': json.dumps(event.get('visualizationData', {}))},
                'paymentAnalysis': {'S': json.dumps(event.get('paymentAnalysis', {}))},
                'legalAnalysis': {'S': json.dumps(event.get('legalAnalysis', {}))},
                'paymentInsights': {'S': json.dumps(event.get('paymentInsights', []))},
                'legalIssues': {'S': json.dumps(event.get('legalIssues', []))},
                'reliabilityRating': {'S': event.get('reliabilityRating', 'UNKNOWN')},
                'legalStatus': {'S': event.get('legalStatus', 'UNKNOWN')}
            }
        },
        'sentimentDetails': {
            'M': {
                'sentiment': {'S': comprehend_result.get('sentiment', 'NEUTRAL')},
                'keyPhrases': {
                    'L': [{'S': phrase} for phrase in comprehend_result.get('keyPhrases', [])]
                }
            }
        },
        'auditTrail': {
            'L': audit_trail
        }
    }
    
    return item


def build_audit_trail(event: Dict[str, Any], current_timestamp: int) -> List[Dict[str, Any]]:
    """
    Build audit trail array with submission and processing events.
    
    Args:
        event: Input event containing onboarding data
        current_timestamp: Current Unix timestamp
    
    Returns:
        List of audit trail entries in DynamoDB AttributeValue format
    """
    audit_trail = []
    
    # Add submission event
    contact_email = event.get('redactedData', {}).get('contactEmail', event.get('contactEmail', 'unknown'))
    submission_event = {
        'M': {
            'timestamp': {'N': str(current_timestamp - 60)},  # Approximate submission time
            'action': {'S': 'SUBMITTED'},
            'actor': {'S': contact_email}
        }
    }
    audit_trail.append(submission_event)
    
    # Add PII redaction event
    pii_redaction_event = {
        'M': {
            'timestamp': {'N': str(current_timestamp - 50)},
            'action': {'S': 'PII_REDACTED'},
            'actor': {'S': 'system'}
        }
    }
    audit_trail.append(pii_redaction_event)
    
    # Add risk assessment event
    risk_assessment_event = {
        'M': {
            'timestamp': {'N': str(current_timestamp - 30)},
            'action': {'S': 'RISK_ASSESSED'},
            'actor': {'S': 'system'}
        }
    }
    audit_trail.append(risk_assessment_event)
    
    # Add status update event
    status = event.get('status', 'SUBMITTED')
    status_event = {
        'M': {
            'timestamp': {'N': str(current_timestamp)},
            'action': {'S': f'STATUS_UPDATED_{status}'},
            'actor': {'S': 'system'}
        }
    }
    audit_trail.append(status_event)
    
    return audit_trail


def save_with_retry(item: Dict[str, Any]) -> None:
    """
    Save item to DynamoDB with exponential backoff retry logic.
    
    Args:
        item: DynamoDB item to save
    
    Raises:
        Exception: If all retry attempts fail
    """
    backoff = INITIAL_BACKOFF
    last_error = None
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"Attempting to save to DynamoDB (attempt {attempt}/{MAX_RETRIES})")
            
            # Execute put_item
            dynamodb.put_item(
                TableName=TABLE_NAME,
                Item=item
            )
            
            logger.info(f"Successfully saved item on attempt {attempt}")
            return
            
        except dynamodb.exceptions.ProvisionedThroughputExceededException as e:
            last_error = e
            logger.warning(
                f"DynamoDB throughput exceeded on attempt {attempt}/{MAX_RETRIES}. "
                f"Retrying in {backoff} seconds..."
            )
            
            if attempt < MAX_RETRIES:
                time.sleep(backoff)
                backoff *= BACKOFF_MULTIPLIER
            
        except dynamodb.exceptions.ResourceNotFoundException as e:
            # Table doesn't exist - don't retry
            logger.error(f"DynamoDB table {TABLE_NAME} not found")
            raise
            
        except dynamodb.exceptions.ConditionalCheckFailedException as e:
            # Conditional check failed - don't retry
            logger.error(f"Conditional check failed for DynamoDB put_item")
            raise
            
        except Exception as e:
            last_error = e
            logger.warning(
                f"Error saving to DynamoDB on attempt {attempt}/{MAX_RETRIES}: {str(e)}"
            )
            
            if attempt < MAX_RETRIES:
                time.sleep(backoff)
                backoff *= BACKOFF_MULTIPLIER
    
    # All retries exhausted
    logger.error(
        f"Failed to save to DynamoDB after {MAX_RETRIES} attempts. "
        f"Last error: {str(last_error)}"
    )
    raise last_error
