"""
QuickSight Data Source Lambda Function
Provides aggregated metrics from DynamoDB for QuickSight dashboards
"""
import json
import os
import logging
import boto3
from typing import Dict, Any, List
from decimal import Decimal
from datetime import datetime, timedelta

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


def scan_all_requests() -> List[Dict[str, Any]]:
    """
    Scan all onboarding requests from DynamoDB
    
    Returns:
        List of all onboarding request items
    """
    items = []
    scan_kwargs = {}
    
    try:
        # Paginate through all items
        while True:
            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
            
            # Check if there are more items to scan
            if 'LastEvaluatedKey' not in response:
                break
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        logger.info(f"Scanned {len(items)} total requests")
        return items
        
    except Exception as e:
        logger.error(f"Error scanning DynamoDB: {str(e)}", exc_info=True)
        raise


def query_by_status(status: str) -> List[Dict[str, Any]]:
    """
    Query requests by status using StatusIndex GSI
    
    Args:
        status: Status value to query (SUBMITTED, APPROVED, MANUAL_REVIEW, REJECTED)
        
    Returns:
        List of items with the specified status
    """
    items = []
    query_kwargs = {
        'IndexName': 'StatusIndex',
        'KeyConditionExpression': '#status = :status',
        'ExpressionAttributeNames': {
            '#status': 'status'
        },
        'ExpressionAttributeValues': {
            ':status': status
        }
    }
    
    try:
        # Paginate through all items
        while True:
            response = table.query(**query_kwargs)
            items.extend(response.get('Items', []))
            
            # Check if there are more items to query
            if 'LastEvaluatedKey' not in response:
                break
            query_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        logger.info(f"Found {len(items)} requests with status: {status}")
        return items
        
    except Exception as e:
        logger.error(f"Error querying by status: {str(e)}", exc_info=True)
        raise


def calculate_aggregated_metrics(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate aggregated metrics from onboarding requests
    
    Args:
        items: List of DynamoDB items
        
    Returns:
        Dictionary containing aggregated metrics
    """
    # Initialize counters
    status_counts = {
        'SUBMITTED': 0,
        'APPROVED': 0,
        'MANUAL_REVIEW': 0,
        'REJECTED': 0
    }
    
    fraud_scores = []
    content_risk_scores = []
    combined_risk_scores = []
    
    # Process each item
    for item in items:
        # Count by status
        status = item.get('status', 'UNKNOWN')
        if status in status_counts:
            status_counts[status] += 1
        
        # Collect risk scores
        risk_scores = item.get('riskScores', {})
        if 'fraudScore' in risk_scores:
            fraud_scores.append(float(risk_scores['fraudScore']))
        if 'contentRiskScore' in risk_scores:
            content_risk_scores.append(float(risk_scores['contentRiskScore']))
        if 'combinedRiskScore' in risk_scores:
            combined_risk_scores.append(float(risk_scores['combinedRiskScore']))
    
    # Calculate averages
    avg_fraud_score = sum(fraud_scores) / len(fraud_scores) if fraud_scores else 0.0
    avg_content_risk_score = sum(content_risk_scores) / len(content_risk_scores) if content_risk_scores else 0.0
    avg_combined_risk_score = sum(combined_risk_scores) / len(combined_risk_scores) if combined_risk_scores else 0.0
    
    # Calculate approval rate
    total_processed = status_counts['APPROVED'] + status_counts['MANUAL_REVIEW'] + status_counts['REJECTED']
    approval_rate = (status_counts['APPROVED'] / total_processed * 100) if total_processed > 0 else 0.0
    
    return {
        'totalRequests': len(items),
        'statusCounts': status_counts,
        'averageScores': {
            'fraudScore': round(avg_fraud_score, 3),
            'contentRiskScore': round(avg_content_risk_score, 3),
            'combinedRiskScore': round(avg_combined_risk_score, 3)
        },
        'approvalRate': round(approval_rate, 2),
        'manualReviewRate': round((status_counts['MANUAL_REVIEW'] / total_processed * 100) if total_processed > 0 else 0.0, 2)
    }


def get_time_series_data(items: List[Dict[str, Any]], days: int = 30) -> List[Dict[str, Any]]:
    """
    Generate time-series data for the last N days
    
    Args:
        items: List of DynamoDB items
        days: Number of days to include in time series
        
    Returns:
        List of daily metrics
    """
    # Calculate cutoff timestamp (N days ago)
    cutoff_date = datetime.now() - timedelta(days=days)
    cutoff_timestamp = int(cutoff_date.timestamp())
    
    # Group items by date
    daily_data = {}
    
    for item in items:
        created_at = item.get('createdAt')
        if not created_at or created_at < cutoff_timestamp:
            continue
        
        # Convert timestamp to date string
        date_str = datetime.fromtimestamp(created_at).strftime('%Y-%m-%d')
        
        if date_str not in daily_data:
            daily_data[date_str] = {
                'date': date_str,
                'count': 0,
                'approved': 0,
                'manualReview': 0,
                'rejected': 0,
                'riskScores': []
            }
        
        daily_data[date_str]['count'] += 1
        
        status = item.get('status')
        if status == 'APPROVED':
            daily_data[date_str]['approved'] += 1
        elif status == 'MANUAL_REVIEW':
            daily_data[date_str]['manualReview'] += 1
        elif status == 'REJECTED':
            daily_data[date_str]['rejected'] += 1
        
        # Collect risk score
        risk_scores = item.get('riskScores', {})
        if 'combinedRiskScore' in risk_scores:
            daily_data[date_str]['riskScores'].append(float(risk_scores['combinedRiskScore']))
    
    # Calculate average risk score per day and format output
    time_series = []
    for date_str in sorted(daily_data.keys()):
        day_data = daily_data[date_str]
        avg_risk = sum(day_data['riskScores']) / len(day_data['riskScores']) if day_data['riskScores'] else 0.0
        
        time_series.append({
            'date': date_str,
            'totalRequests': day_data['count'],
            'approved': day_data['approved'],
            'manualReview': day_data['manualReview'],
            'rejected': day_data['rejected'],
            'averageRiskScore': round(avg_risk, 3)
        })
    
    return time_series


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for QuickSight data source
    
    Args:
        event: Lambda event (can include query parameters for filtering)
        context: Lambda context object
        
    Returns:
        Aggregated metrics formatted for QuickSight consumption
    """
    try:
        logger.info(f"QuickSight data query started")
        
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        metric_type = query_params.get('type', 'summary')  # summary, timeseries, or detailed
        
        # Scan all requests
        all_items = scan_all_requests()
        
        if metric_type == 'timeseries':
            # Return time-series data
            days = int(query_params.get('days', 30))
            time_series = get_time_series_data(all_items, days)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'type': 'timeseries',
                    'data': time_series
                }, cls=DecimalEncoder)
            }
        
        elif metric_type == 'detailed':
            # Return detailed list of all requests (for QuickSight dataset)
            detailed_data = []
            for item in all_items:
                risk_scores = item.get('riskScores', {})
                detailed_data.append({
                    'requestId': item.get('requestId'),
                    'status': item.get('status'),
                    'vendorName': item.get('vendorName'),
                    'createdAt': item.get('createdAt'),
                    'fraudScore': float(risk_scores.get('fraudScore', 0)),
                    'contentRiskScore': float(risk_scores.get('contentRiskScore', 0)),
                    'combinedRiskScore': float(risk_scores.get('combinedRiskScore', 0))
                })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'type': 'detailed',
                    'data': detailed_data
                }, cls=DecimalEncoder)
            }
        
        else:
            # Return summary metrics (default)
            metrics = calculate_aggregated_metrics(all_items)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'type': 'summary',
                    'metrics': metrics,
                    'timestamp': int(datetime.now().timestamp())
                }, cls=DecimalEncoder)
            }
        
    except Exception as e:
        logger.error(f"Error generating QuickSight data: {str(e)}", exc_info=True)
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
