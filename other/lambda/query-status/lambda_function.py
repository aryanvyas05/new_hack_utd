"""
Query Status Lambda Function
Retrieves onboarding request status from DynamoDB
"""
import json
import os
import logging
import boto3
from typing import Dict, Any
from decimal import Decimal

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME', '')
table = dynamodb.Table(TABLE_NAME)


class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert DynamoDB Decimal types to JSON"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def parse_fraud_details(fraud_details: Dict) -> Dict:
    """Parse fraud details and extract visualization data."""
    try:
        result = {
            'modelVersion': fraud_details.get('modelVersion', 'unknown'),
            'riskFactors': fraud_details.get('riskFactors', [])
        }
        
        # Parse JSON strings if they exist
        if 'trustSignals' in fraud_details:
            try:
                result['trustSignals'] = json.loads(fraud_details['trustSignals'])
            except:
                result['trustSignals'] = {}
        
        if 'networkAnalysis' in fraud_details:
            try:
                result['networkAnalysis'] = json.loads(fraud_details['networkAnalysis'])
            except:
                result['networkAnalysis'] = {}
        
        if 'entities' in fraud_details:
            try:
                result['entities'] = json.loads(fraud_details['entities'])
            except:
                result['entities'] = []
        
        if 'behavioralIndicators' in fraud_details:
            try:
                result['behavioralIndicators'] = json.loads(fraud_details['behavioralIndicators'])
            except:
                result['behavioralIndicators'] = {}
        
        if 'visualizationData' in fraud_details:
            try:
                result['visualizationData'] = json.loads(fraud_details['visualizationData'])
            except:
                result['visualizationData'] = {}
        
        return result
    except Exception as e:
        logger.warning(f"Error parsing fraud details: {e}")
        return {}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for querying onboarding request status
    
    Args:
        event: API Gateway event containing requestId path parameter
        context: Lambda context object
        
    Returns:
        API Gateway response with request status and details
    """
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Extract requestId from path parameters
        request_id = event.get('pathParameters', {}).get('requestId')
        
        if not request_id:
            logger.warning("Missing requestId in path parameters")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'error': 'Missing requestId parameter'
                })
            }
        
        logger.info(f"Querying status for request ID: {request_id}")
        
        # Query DynamoDB for the request
        response = table.get_item(
            Key={'requestId': request_id}
        )
        
        if 'Item' not in response:
            logger.warning(f"Request not found: {request_id}")
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'error': 'Request not found',
                    'requestId': request_id
                })
            }
        
        item = response['Item']
        logger.info(f"Found request: {request_id} with status: {item.get('status')}")
        
        # Return request details
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'requestId': item.get('requestId'),
                'status': item.get('status'),
                'vendorName': item.get('vendorName'),
                'contactEmail': item.get('contactEmail'),
                'createdAt': item.get('createdAt'),
                'updatedAt': item.get('updatedAt'),
                'riskScores': item.get('riskScores', {}),
                'auditTrail': item.get('auditTrail', []),
                # Add visualization data
                'fraudDetails': parse_fraud_details(item.get('fraudDetails', {}))
            }, cls=DecimalEncoder)
        }
        
    except Exception as e:
        logger.error(f"Error querying status: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
