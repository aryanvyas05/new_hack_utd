"""
Lambda function to combine fraud and content risk scores into a final risk assessment.

This function calculates a weighted average of fraud detection and sentiment analysis
scores to determine if an onboarding request should be auto-approved or sent for
manual review.
"""

import json
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Risk scoring weights
FRAUD_SCORE_WEIGHT = 0.7
CONTENT_RISK_WEIGHT = 0.3

# Decision thresholds
MANUAL_REVIEW_THRESHOLD = 0.5  # 50% or higher requires manual review
AUTO_APPROVE_THRESHOLD = 0.3   # Below 30% is auto-approved


def lambda_handler(event, context):
    """
    Combine fraud score and content risk score to determine approval recommendation.
    
    Args:
        event: Input containing fraudScore and contentRiskScore
        context: Lambda context object
        
    Returns:
        dict: Combined risk score and recommendation
    """
    try:
        logger.info(f"Processing risk score combination for request")
        
        # Extract fraud score and content risk score from input
        fraud_score = event.get('fraudScore')
        content_risk_score = event.get('contentRiskScore')
        
        # Validate inputs
        if fraud_score is None:
            logger.error("Missing fraudScore in input")
            raise ValueError("fraudScore is required")
        
        if content_risk_score is None:
            logger.error("Missing contentRiskScore in input")
            raise ValueError("contentRiskScore is required")
        
        # Validate score ranges
        if not (0.0 <= fraud_score <= 1.0):
            logger.error(f"Invalid fraudScore: {fraud_score}. Must be between 0.0 and 1.0")
            raise ValueError(f"fraudScore must be between 0.0 and 1.0, got {fraud_score}")
        
        if not (0.0 <= content_risk_score <= 1.0):
            logger.error(f"Invalid contentRiskScore: {content_risk_score}. Must be between 0.0 and 1.0")
            raise ValueError(f"contentRiskScore must be between 0.0 and 1.0, got {content_risk_score}")
        
        # Calculate combined risk score using weighted average
        combined_risk_score = (fraud_score * FRAUD_SCORE_WEIGHT) + (content_risk_score * CONTENT_RISK_WEIGHT)
        
        # Round to 2 decimal places for consistency
        combined_risk_score = round(combined_risk_score, 2)
        
        # Determine recommendation based on thresholds
        if combined_risk_score >= MANUAL_REVIEW_THRESHOLD:
            recommendation = "MANUAL_REVIEW"
        else:
            recommendation = "AUTO_APPROVE"
        
        logger.info(
            f"Risk score calculation complete: "
            f"fraudScore={fraud_score}, "
            f"contentRiskScore={content_risk_score}, "
            f"combinedRiskScore={combined_risk_score}, "
            f"recommendation={recommendation}"
        )
        
        # Return combined score and recommendation with all original fields
        return {
            'requestId': event.get('requestId'),
            'vendorName': event.get('vendorName'),
            'contactEmail': event.get('contactEmail'),
            'businessDescription': event.get('businessDescription'),
            'taxId': event.get('taxId'),
            'sourceIp': event.get('sourceIp'),
            'submittedAt': event.get('submittedAt'),
            'fraudScore': fraud_score,
            'contentRiskScore': content_risk_score,
            'combinedRiskScore': combined_risk_score,
            'recommendation': recommendation,
            'details': {
                'fraudWeight': FRAUD_SCORE_WEIGHT,
                'contentWeight': CONTENT_RISK_WEIGHT,
                'threshold': MANUAL_REVIEW_THRESHOLD
            }
        }
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error combining risk scores: {str(e)}")
        raise
