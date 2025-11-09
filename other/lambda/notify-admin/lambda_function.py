"""
Lambda function to send admin notifications for high-risk onboarding requests.

This function publishes SNS notifications to administrators when onboarding
requests require manual review due to high risk scores.
"""

import json
import boto3
import logging
import os
from datetime import datetime
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize SNS client
sns = boto3.client('sns')

# Get SNS topic ARN from environment variable
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler to send admin notification via SNS.
    
    Args:
        event: Input event containing onboarding request details
        context: Lambda context object
    
    Returns:
        Dictionary containing notification status
    """
    try:
        request_id = event.get('requestId', 'unknown')
        logger.info(f"Sending admin notification for request: {request_id}")
        
        # Build notification message
        message = build_notification_message(event)
        subject = build_notification_subject(event)
        
        # Publish to SNS
        publish_notification(message, subject)
        
        logger.info(f"Successfully sent notification for request {request_id}")
        
        return {
            'statusCode': 200,
            'requestId': request_id,
            'notificationSent': True,
            'message': 'Admin notification sent successfully'
        }
        
    except Exception as e:
        request_id = event.get('requestId', 'unknown')
        logger.error(f"Failed to send notification for request {request_id}: {str(e)}")
        
        # Do not fail workflow on notification error
        return {
            'statusCode': 200,
            'requestId': request_id,
            'notificationSent': False,
            'message': f'Notification failed but workflow continues: {str(e)}'
        }


def build_notification_message(event: Dict[str, Any]) -> str:
    """
    Build formatted notification message for email readability.
    
    Args:
        event: Input event containing onboarding request details
    
    Returns:
        Formatted notification message string
    """
    # Extract key information
    request_id = event.get('requestId', 'N/A')
    
    # Extract vendor information from redacted data
    redacted_data = event.get('redactedData', {})
    vendor_name = redacted_data.get('vendorName', event.get('vendorName', 'N/A'))
    contact_email = redacted_data.get('contactEmail', event.get('contactEmail', 'N/A'))
    
    # Extract risk score
    final_risk = event.get('finalRisk', {})
    combined_risk_score = final_risk.get('combinedRiskScore', 0.0)
    
    # Extract individual risk scores
    risk_assessments = event.get('riskAssessments', [])
    fraud_score = 0.0
    content_risk_score = 0.0
    
    if isinstance(risk_assessments, list) and len(risk_assessments) >= 2:
        fraud_result = risk_assessments[0].get('fraudResult', {})
        comprehend_result = risk_assessments[1].get('comprehendResult', {})
        fraud_score = fraud_result.get('fraudScore', 0.0)
        content_risk_score = comprehend_result.get('contentRiskScore', 0.0)
    
    # Get current timestamp
    timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    # Build formatted message
    message = f"""
MANUAL REVIEW REQUIRED - High Risk Onboarding Request
{'=' * 60}

A new onboarding request has been flagged for manual review due to 
elevated risk indicators.

REQUEST DETAILS:
  Request ID:       {request_id}
  Vendor Name:      {vendor_name}
  Contact Email:    {contact_email}
  Timestamp:        {timestamp}

RISK ASSESSMENT:
  Combined Risk Score:    {combined_risk_score:.2f} (Threshold: 0.80)
  Fraud Score:            {fraud_score:.2f}
  Content Risk Score:     {content_risk_score:.2f}

ACTION REQUIRED:
Please review this onboarding request in the admin dashboard and make
an approval decision. High risk scores may indicate:
  - Suspicious email domain or IP address
  - Negative sentiment in business description
  - Risky key phrases detected
  - Known fraud patterns

NEXT STEPS:
1. Log into the Veritas Onboard admin dashboard
2. Review the complete request details
3. Investigate risk factors and supporting evidence
4. Approve or reject the onboarding request

{'=' * 60}
This is an automated notification from Veritas Onboard System.
"""
    
    return message.strip()


def build_notification_subject(event: Dict[str, Any]) -> str:
    """
    Build notification subject line.
    
    Args:
        event: Input event containing onboarding request details
    
    Returns:
        Subject line string
    """
    request_id = event.get('requestId', 'unknown')
    redacted_data = event.get('redactedData', {})
    vendor_name = redacted_data.get('vendorName', event.get('vendorName', 'Unknown'))
    
    # Truncate vendor name if too long
    if len(vendor_name) > 30:
        vendor_name = vendor_name[:27] + '...'
    
    return f"[MANUAL REVIEW] Onboarding Request {request_id[:8]} - {vendor_name}"


def publish_notification(message: str, subject: str) -> None:
    """
    Publish notification message to SNS topic.
    
    Args:
        message: Formatted notification message
        subject: Email subject line
    
    Raises:
        Exception: If SNS publish fails (caught by handler)
    """
    if not SNS_TOPIC_ARN:
        logger.error("SNS_TOPIC_ARN environment variable not set")
        raise ValueError("SNS_TOPIC_ARN not configured")
    
    logger.info(f"Publishing notification to SNS topic: {SNS_TOPIC_ARN}")
    
    response = sns.publish(
        TopicArn=SNS_TOPIC_ARN,
        Message=message,
        Subject=subject
    )
    
    message_id = response.get('MessageId', 'unknown')
    logger.info(f"SNS message published successfully. MessageId: {message_id}")
