"""
Start Workflow Lambda Function
Validates input, generates request ID, and starts Step Functions execution
"""
import json
import uuid
import os
import logging
import boto3
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
stepfunctions = boto3.client('stepfunctions')

# Environment variables
STATE_MACHINE_ARN = os.environ.get('STATE_MACHINE_ARN', '')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for starting the onboarding workflow
    
    Args:
        event: API Gateway event containing request body and context
        context: Lambda context object
        
    Returns:
        API Gateway response with 202 status and requestId
    """
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Validate required fields
        required_fields = ['vendorName', 'contactEmail', 'businessDescription', 'taxId']
        missing_fields = [field for field in required_fields if not body.get(field)]
        
        if missing_fields:
            logger.warning(f"Missing required fields: {missing_fields}")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'error': 'Missing required fields',
                    'missingFields': missing_fields
                })
            }
        
        # Generate UUID for request
        request_id = str(uuid.uuid4())
        logger.info(f"Generated request ID: {request_id}")
        
        # Extract source IP from API Gateway event context
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        logger.info(f"Source IP: {source_ip}")
        
        # Prepare input for Step Functions
        workflow_input = {
            'requestId': request_id,
            'vendorName': body['vendorName'],
            'contactEmail': body['contactEmail'],
            'businessDescription': body['businessDescription'],
            'taxId': body['taxId'],
            'sourceIp': source_ip,
            'submittedAt': context.get_remaining_time_in_millis() if context else 0
        }
        
        # Start Step Functions execution
        logger.info(f"Starting Step Functions execution with input: {json.dumps(workflow_input)}")
        
        response = stepfunctions.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            name=f"onboarding-{request_id}",
            input=json.dumps(workflow_input)
        )
        
        logger.info(f"Step Functions execution started: {response['executionArn']}")
        
        # Return 202 Accepted with request ID
        return {
            'statusCode': 202,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'requestId': request_id,
                'status': 'SUBMITTED',
                'message': 'Onboarding request submitted successfully',
                'executionArn': response['executionArn']
            })
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in request body: {str(e)}")
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'error': 'Invalid JSON in request body'
            })
        }
        
    except Exception as e:
        logger.error(f"Error starting workflow: {str(e)}", exc_info=True)
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
