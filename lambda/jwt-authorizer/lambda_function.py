"""
JWT Lambda Authorizer - Validates JWT tokens for API Gateway
Implements RBAC (Role-Based Access Control)
"""

import json
import jwt
import os
import re

JWT_SECRET = os.environ.get('JWT_SECRET', 'CHANGE_THIS_IN_PRODUCTION_USE_SECRETS_MANAGER')
JWT_ALGORITHM = 'HS256'

# Role-based permissions
ROLE_PERMISSIONS = {
    'admin': ['*'],  # Full access
    'analyst': ['read:*', 'write:analysis', 'write:review'],
    'reviewer': ['read:*', 'write:review'],
    'viewer': ['read:*']
}

def lambda_handler(event, context):
    """
    Lambda authorizer for API Gateway
    Returns IAM policy allowing/denying access
    """
    try:
        # Extract token from Authorization header
        token = extract_token(event)
        
        if not token:
            return generate_policy('user', 'Deny', event['methodArn'])
        
        # Verify and decode token
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            print("Token expired")
            return generate_policy('user', 'Deny', event['methodArn'])
        except jwt.InvalidTokenError as e:
            print(f"Invalid token: {e}")
            return generate_policy('user', 'Deny', event['methodArn'])
        
        # Validate token type
        if payload.get('type') != 'access':
            print("Invalid token type")
            return generate_policy('user', 'Deny', event['methodArn'])
        
        email = payload.get('email')
        role = payload.get('role', 'viewer')
        
        # Check if user has permission for this resource
        method_arn = event['methodArn']
        if not has_permission(role, method_arn):
            print(f"User {email} with role {role} denied access to {method_arn}")
            return generate_policy(email, 'Deny', method_arn)
        
        # Generate allow policy with user context
        policy = generate_policy(email, 'Allow', method_arn)
        policy['context'] = {
            'email': email,
            'role': role,
            'tokenIat': str(payload.get('iat', 0))
        }
        
        return policy
        
    except Exception as e:
        print(f"Authorizer error: {e}")
        return generate_policy('user', 'Deny', event['methodArn'])


def extract_token(event):
    """Extract JWT token from event"""
    try:
        # Check Authorization header
        auth_header = event.get('authorizationToken', '')
        if auth_header.startswith('Bearer '):
            return auth_header[7:]
        
        # Check headers (for REST API)
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization', headers.get('authorization', ''))
        if auth_header.startswith('Bearer '):
            return auth_header[7:]
        
        return None
    except:
        return None


def has_permission(role: str, method_arn: str) -> bool:
    """Check if role has permission for the resource"""
    permissions = ROLE_PERMISSIONS.get(role, [])
    
    # Admin has full access
    if '*' in permissions:
        return True
    
    # Extract action from method ARN
    # Format: arn:aws:execute-api:region:account:api-id/stage/method/resource
    try:
        parts = method_arn.split('/')
        method = parts[-2] if len(parts) >= 2 else ''
        resource = parts[-1] if len(parts) >= 1 else ''
        
        # Map HTTP methods to actions
        action_map = {
            'GET': 'read',
            'POST': 'write',
            'PUT': 'write',
            'PATCH': 'write',
            'DELETE': 'delete'
        }
        
        action = action_map.get(method, 'read')
        
        # Check permissions
        for perm in permissions:
            if perm == f'{action}:*':
                return True
            if perm == f'{action}:{resource}':
                return True
            # Check wildcard patterns
            if '*' in perm:
                pattern = perm.replace('*', '.*')
                if re.match(pattern, f'{action}:{resource}'):
                    return True
        
        return False
    except:
        # Default deny on error
        return False


def generate_policy(principal_id, effect, resource):
    """Generate IAM policy for API Gateway"""
    policy = {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource
                }
            ]
        }
    }
    
    return policy
