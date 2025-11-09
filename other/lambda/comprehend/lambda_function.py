import json
import boto3
import logging
from typing import Dict, Any, List

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize Comprehend client
comprehend = boto3.client('comprehend')

# Define risky key phrases that increase content risk score
RISKY_PHRASES = [
    'money laundering',
    'offshore',
    'shell company',
    'tax evasion',
    'fraud',
    'ponzi',
    'pyramid scheme',
    'illegal',
    'laundering',
    'black market'
]


def calculate_sentiment_risk(sentiment: str) -> float:
    """
    Calculate risk score based on sentiment.
    
    Args:
        sentiment: Sentiment value (POSITIVE, NEGATIVE, MIXED, NEUTRAL)
    
    Returns:
        Risk score contribution from sentiment
    """
    sentiment_risk_map = {
        'NEGATIVE': 0.4,
        'MIXED': 0.2,
        'POSITIVE': 0.0,
        'NEUTRAL': 0.0
    }
    return sentiment_risk_map.get(sentiment, 0.0)


def calculate_key_phrase_risk(key_phrases: List[str]) -> float:
    """
    Calculate risk score based on presence of risky key phrases.
    
    Args:
        key_phrases: List of key phrases extracted from text
    
    Returns:
        Risk score contribution from key phrases (max 0.3)
    """
    risk_score = 0.0
    detected_risky_phrases = []
    
    for phrase in key_phrases:
        phrase_lower = phrase.lower()
        for risky_phrase in RISKY_PHRASES:
            if risky_phrase in phrase_lower:
                risk_score += 0.1
                detected_risky_phrases.append(risky_phrase)
                break  # Only count each phrase once
    
    # Cap key phrase risk at 0.3
    risk_score = min(0.3, risk_score)
    
    if detected_risky_phrases:
        logger.warning(f"Detected risky phrases: {detected_risky_phrases}")
    
    return risk_score


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for Comprehend sentiment analysis.
    
    Args:
        event: Input event containing requestId and businessDescription
        context: Lambda context object
    
    Returns:
        Dictionary containing sentiment analysis results and content risk score
    """
    try:
        request_id = event.get('requestId', 'unknown')
        business_description = event.get('businessDescription', '')
        
        logger.info(f"Processing sentiment analysis for request: {request_id}")
        
        # Validate input
        if not business_description or not business_description.strip():
            logger.warning(f"Empty business description for request: {request_id}")
            return {
                'requestId': request_id,
                'sentimentScore': 0.0,
                'sentiment': 'NEUTRAL',
                'keyPhrases': [],
                'contentRiskScore': 0.0
            }
        
        # Detect sentiment
        logger.info(f"Calling Comprehend detect_sentiment for request: {request_id}")
        sentiment_response = comprehend.detect_sentiment(
            Text=business_description,
            LanguageCode='en'
        )
        
        sentiment = sentiment_response['Sentiment']
        sentiment_scores = sentiment_response['SentimentScore']
        
        logger.info(f"Sentiment detected: {sentiment} for request: {request_id}")
        
        # Detect key phrases
        logger.info(f"Calling Comprehend detect_key_phrases for request: {request_id}")
        key_phrases_response = comprehend.detect_key_phrases(
            Text=business_description,
            LanguageCode='en'
        )
        
        key_phrases = [phrase['Text'] for phrase in key_phrases_response['KeyPhrases']]
        
        logger.info(f"Extracted {len(key_phrases)} key phrases for request: {request_id}")
        
        # Calculate content risk score
        sentiment_risk = calculate_sentiment_risk(sentiment)
        key_phrase_risk = calculate_key_phrase_risk(key_phrases)
        
        # Combine risks and cap at 1.0
        content_risk_score = min(1.0, sentiment_risk + key_phrase_risk)
        
        logger.info(
            f"Content risk calculated for request {request_id}: "
            f"sentiment_risk={sentiment_risk}, key_phrase_risk={key_phrase_risk}, "
            f"total={content_risk_score}"
        )
        
        return {
            'requestId': request_id,
            'sentimentScore': sentiment_scores.get(sentiment, 0.0),
            'sentiment': sentiment,
            'keyPhrases': key_phrases,
            'contentRiskScore': content_risk_score,
            'sentimentRiskContribution': sentiment_risk,
            'keyPhraseRiskContribution': key_phrase_risk
        }
        
    except comprehend.exceptions.TextSizeLimitExceededException as e:
        logger.warning(f"Text size limit exceeded for request {request_id}: {str(e)}")
        return {
            'requestId': request_id,
            'sentimentScore': 0.0,
            'sentiment': 'NEUTRAL',
            'keyPhrases': [],
            'contentRiskScore': 0.0,
            'error': 'Text size limit exceeded'
        }
        
    except comprehend.exceptions.InvalidRequestException as e:
        logger.warning(f"Invalid request for Comprehend API for request {request_id}: {str(e)}")
        return {
            'requestId': request_id,
            'sentimentScore': 0.0,
            'sentiment': 'NEUTRAL',
            'keyPhrases': [],
            'contentRiskScore': 0.0,
            'error': 'Invalid request'
        }
        
    except Exception as e:
        logger.error(f"Error processing sentiment analysis for request {request_id}: {str(e)}")
        # Return default content risk score of 0.0 on error
        return {
            'requestId': request_id,
            'sentimentScore': 0.0,
            'sentiment': 'NEUTRAL',
            'keyPhrases': [],
            'contentRiskScore': 0.0,
            'error': str(e)
        }
