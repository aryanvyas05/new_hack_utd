"""
Authentication Handler - JWT-based auth with MFA support
Handles login, token generation, and validation
"""

import json
import jwt
import hashlib
import hmac
import time
import os
import re
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import boto3

dynamodb = boto3.resource('dynamodb')
users_table = dynamodb.Table(os.environ.get('USERS_TABLE', 'veritas-users'))

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'CHANGE_THIS_IN_PRODUCTION_USE_SECRETS_MANAGER')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRY = 900  # 15 minutes
REFRESH_TOKEN_EXPIRY = 604800  # 7 days

# Password policy
MIN_PASSWORD_LENGTH = 12
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_DIGIT = True
REQUIRE_SPECIAL = True

def lambda_handler(event, context):
    """Main auth handler - routes to appropriate auth function"""
    try:
        path = event.get('path', '')
        method = event.get('httpMethod', 'POST')
        
        if path == '/auth/register' and method == 'POST':
            return handle_register(event)
        elif path == '/auth/login' and method == 'POST':
            return handle_login(event)
        elif path == '/auth/verify-mfa' and method == 'POST':
            return handle_verify_mfa(event)
        elif path == '/auth/refresh' and method == 'POST':
            return handle_refresh_token(event)
        elif path == '/auth/validate' and method == 'POST':
            return handle_validate_token(event)
        else:
            return response(404, {'error': 'Not found'})
            
    except Exception as e:
        return response(500, {'error': str(e)})


def handle_register(event):
    """Register new user with strong password policy"""
    try:
        body = json.loads(event.get('body', '{}'))
        email = body.get('email', '').lower().strip()
        password = body.get('password', '')
        full_name = body.get('fullName', '')
        role = body.get('role', 'viewer')  # viewer, analyst, admin
        
        # Validate email
        if not is_valid_email(email):
            return response(400, {'error': 'Invalid email format'})
        
        # Validate password strength
        password_valid, password_error = validate_password(password)
        if not password_valid:
            return response(400, {'error': password_error})
        
        # Check if user exists
        try:
            existing = users_table.get_item(Key={'email': email})
            if 'Item' in existing:
                return response(409, {'error': 'User already exists'})
        except:
            pass
        
        # Hash password with salt
        password_hash, salt = hash_password(password)
        
        # Generate MFA secret
        mfa_secret = generate_mfa_secret()
        
        # Create user
        user_data = {
            'email': email,
            'passwordHash': password_hash,
            'salt': salt,
            'fullName': full_name,
            'role': role,
            'mfaSecret': mfa_secret,
            'mfaEnabled': False,
            'emailVerified': False,
            'accountLocked': False,
            'failedLoginAttempts': 0,
            'createdAt': datetime.utcnow().isoformat(),
            'lastLogin': None
        }
        
        users_table.put_item(Item=user_data)
        
        return response(201, {
            'message': 'User registered successfully',
            'email': email,
            'mfaSecret': mfa_secret,
            'mfaQrCode': generate_mfa_qr_url(email, mfa_secret)
        })
        
    except Exception as e:
        return response(500, {'error': f'Registration failed: {str(e)}'})


def handle_login(event):
    """Handle user login - returns temp token if MFA required"""
    try:
        body = json.loads(event.get('body', '{}'))
        email = body.get('email', '').lower().strip()
        password = body.get('password', '')
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        
        # Get user
        user_response = users_table.get_item(Key={'email': email})
        if 'Item' not in user_response:
            return response(401, {'error': 'Invalid credentials'})
        
        user = user_response['Item']
        
        # Check if account is locked
        if user.get('accountLocked', False):
            return response(403, {'error': 'Account locked due to suspicious activity'})
        
        # Verify password
        if not verify_password(password, user['passwordHash'], user['salt']):
            # Increment failed attempts
            failed_attempts = user.get('failedLoginAttempts', 0) + 1
            users_table.update_item(
                Key={'email': email},
                UpdateExpression='SET failedLoginAttempts = :attempts, accountLocked = :locked',
                ExpressionAttributeValues={
                    ':attempts': failed_attempts,
                    ':locked': failed_attempts >= 5
                }
            )
            return response(401, {'error': 'Invalid credentials'})
        
        # Reset failed attempts on successful password verification
        users_table.update_item(
            Key={'email': email},
            UpdateExpression='SET failedLoginAttempts = :zero',
            ExpressionAttributeValues={':zero': 0}
        )
        
        # If MFA enabled, return temp token
        if user.get('mfaEnabled', False):
            temp_token = generate_temp_token(email)
            return response(200, {
                'requiresMfa': True,
                'tempToken': temp_token
            })
        
        # Generate tokens
        access_token = generate_access_token(email, user['role'])
        refresh_token = generate_refresh_token(email)
        
        # Update last login
        users_table.update_item(
            Key={'email': email},
            UpdateExpression='SET lastLogin = :now, lastLoginIp = :ip',
            ExpressionAttributeValues={
                ':now': datetime.utcnow().isoformat(),
                ':ip': source_ip
            }
        )
        
        return response(200, {
            'accessToken': access_token,
            'refreshToken': refresh_token,
            'expiresIn': ACCESS_TOKEN_EXPIRY,
            'user': {
                'email': email,
                'fullName': user.get('fullName'),
                'role': user.get('role')
            }
        })
        
    except Exception as e:
        return response(500, {'error': f'Login failed: {str(e)}'})


def handle_verify_mfa(event):
    """Verify MFA code and issue tokens"""
    try:
        body = json.loads(event.get('body', '{}'))
        temp_token = body.get('tempToken', '')
        mfa_code = body.get('mfaCode', '')
        
        # Verify temp token
        try:
            payload = jwt.decode(temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get('type') != 'temp':
                return response(401, {'error': 'Invalid token'})
            email = payload.get('email')
        except:
            return response(401, {'error': 'Invalid or expired token'})
        
        # Get user
        user_response = users_table.get_item(Key={'email': email})
        if 'Item' not in user_response:
            return response(401, {'error': 'User not found'})
        
        user = user_response['Item']
        
        # Verify MFA code
        if not verify_totp(user['mfaSecret'], mfa_code):
            return response(401, {'error': 'Invalid MFA code'})
        
        # Generate tokens
        access_token = generate_access_token(email, user['role'])
        refresh_token = generate_refresh_token(email)
        
        # Update last login
        users_table.update_item(
            Key={'email': email},
            UpdateExpression='SET lastLogin = :now',
            ExpressionAttributeValues={':now': datetime.utcnow().isoformat()}
        )
        
        return response(200, {
            'accessToken': access_token,
            'refreshToken': refresh_token,
            'expiresIn': ACCESS_TOKEN_EXPIRY,
            'user': {
                'email': email,
                'fullName': user.get('fullName'),
                'role': user.get('role')
            }
        })
        
    except Exception as e:
        return response(500, {'error': f'MFA verification failed: {str(e)}'})


def handle_refresh_token(event):
    """Refresh access token using refresh token"""
    try:
        body = json.loads(event.get('body', '{}'))
        refresh_token = body.get('refreshToken', '')
        
        # Verify refresh token
        try:
            payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get('type') != 'refresh':
                return response(401, {'error': 'Invalid token type'})
            email = payload.get('email')
        except jwt.ExpiredSignatureError:
            return response(401, {'error': 'Token expired'})
        except:
            return response(401, {'error': 'Invalid token'})
        
        # Get user role
        user_response = users_table.get_item(Key={'email': email})
        if 'Item' not in user_response:
            return response(401, {'error': 'User not found'})
        
        user = user_response['Item']
        
        # Generate new access token
        access_token = generate_access_token(email, user['role'])
        
        return response(200, {
            'accessToken': access_token,
            'expiresIn': ACCESS_TOKEN_EXPIRY
        })
        
    except Exception as e:
        return response(500, {'error': f'Token refresh failed: {str(e)}'})


def handle_validate_token(event):
    """Validate access token and return user info"""
    try:
        auth_header = event.get('headers', {}).get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return response(401, {'error': 'Missing or invalid authorization header'})
        
        token = auth_header[7:]
        
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get('type') != 'access':
                return response(401, {'error': 'Invalid token type'})
            
            return response(200, {
                'valid': True,
                'email': payload.get('email'),
                'role': payload.get('role'),
                'expiresAt': payload.get('exp')
            })
        except jwt.ExpiredSignatureError:
            return response(401, {'error': 'Token expired', 'valid': False})
        except:
            return response(401, {'error': 'Invalid token', 'valid': False})
            
    except Exception as e:
        return response(500, {'error': f'Validation failed: {str(e)}'})


# Helper functions

def is_valid_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password: str) -> Tuple[bool, Optional[str]]:
    """Validate password against security policy"""
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f'Password must be at least {MIN_PASSWORD_LENGTH} characters'
    
    if REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
        return False, 'Password must contain at least one uppercase letter'
    
    if REQUIRE_LOWERCASE and not any(c.islower() for c in password):
        return False, 'Password must contain at least one lowercase letter'
    
    if REQUIRE_DIGIT and not any(c.isdigit() for c in password):
        return False, 'Password must contain at least one digit'
    
    if REQUIRE_SPECIAL and not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in password):
        return False, 'Password must contain at least one special character'
    
    return True, None


def hash_password(password: str) -> Tuple[str, str]:
    """Hash password with salt using PBKDF2"""
    salt = os.urandom(32).hex()
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return pwd_hash, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verify password against stored hash"""
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return hmac.compare_digest(pwd_hash, stored_hash)


def generate_mfa_secret() -> str:
    """Generate base32 MFA secret"""
    import base64
    secret = os.urandom(20)
    return base64.b32encode(secret).decode('utf-8')


def generate_mfa_qr_url(email: str, secret: str) -> str:
    """Generate Google Authenticator QR code URL"""
    from urllib.parse import quote
    issuer = "Veritas Onboard"
    return f"otpauth://totp/{quote(issuer)}:{quote(email)}?secret={secret}&issuer={quote(issuer)}"


def verify_totp(secret: str, code: str) -> bool:
    """Verify TOTP code (Google Authenticator compatible)"""
    import base64
    import struct
    
    try:
        # Decode secret
        key = base64.b32decode(secret)
        
        # Get current time window (30 second intervals)
        current_time = int(time.time() // 30)
        
        # Check current window and ±1 window for clock drift
        for time_window in [current_time - 1, current_time, current_time + 1]:
            # Generate TOTP
            msg = struct.pack('>Q', time_window)
            hmac_hash = hmac.new(key, msg, hashlib.sha1).digest()
            offset = hmac_hash[-1] & 0x0F
            truncated = struct.unpack('>I', hmac_hash[offset:offset + 4])[0] & 0x7FFFFFFF
            totp = str(truncated % 1000000).zfill(6)
            
            if hmac.compare_digest(totp, code):
                return True
        
        return False
    except:
        return False


def generate_access_token(email: str, role: str) -> str:
    """Generate short-lived access token"""
    payload = {
        'email': email,
        'role': role,
        'type': 'access',
        'iat': int(time.time()),
        'exp': int(time.time()) + ACCESS_TOKEN_EXPIRY
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def generate_refresh_token(email: str) -> str:
    """Generate long-lived refresh token"""
    payload = {
        'email': email,
        'type': 'refresh',
        'iat': int(time.time()),
        'exp': int(time.time()) + REFRESH_TOKEN_EXPIRY
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def generate_temp_token(email: str) -> str:
    """Generate temporary token for MFA flow"""
    payload = {
        'email': email,
        'type': 'temp',
        'iat': int(time.time()),
        'exp': int(time.time()) + 300  # 5 minutes
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def response(status_code: int, body: dict) -> dict:
    """Generate API Gateway response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': True
        },
        'body': json.dumps(body)
    }
