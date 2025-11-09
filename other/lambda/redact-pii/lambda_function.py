import re
import json
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def mask_value(value, preserve_last=4):
    """
    Mask a value with asterisks while preserving the last N characters.
    
    Args:
        value: The string value to mask
        preserve_last: Number of characters to preserve at the end (default: 4)
    
    Returns:
        Masked string with asterisks
    """
    if not value or len(value) <= preserve_last:
        return '*' * len(value) if value else value
    
    mask_length = len(value) - preserve_last
    return ('*' * mask_length) + value[-preserve_last:]


def redact_ssn(text):
    """
    Detect and redact Social Security Numbers in XXX-XX-XXXX format.
    
    Args:
        text: Input text that may contain SSNs
    
    Returns:
        Tuple of (redacted_text, detection_count)
    """
    # Pattern for SSN: XXX-XX-XXXX
    ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
    
    matches = re.findall(ssn_pattern, text)
    count = len(matches)
    
    def replace_ssn(match):
        ssn = match.group(0)
        # Mask all but last 4 digits: ***-**-1234
        return '***-**-' + ssn[-4:]
    
    redacted_text = re.sub(ssn_pattern, replace_ssn, text)
    return redacted_text, count


def redact_credit_card(text):
    """
    Detect and redact credit card numbers (13-19 consecutive digits).
    
    Args:
        text: Input text that may contain credit card numbers
    
    Returns:
        Tuple of (redacted_text, detection_count)
    """
    # Pattern for credit card: 13-19 consecutive digits
    # Using word boundaries and negative lookahead/lookbehind to avoid matching parts of longer numbers
    cc_pattern = r'\b\d{13,19}\b'
    
    matches = re.findall(cc_pattern, text)
    count = len(matches)
    
    def replace_cc(match):
        cc = match.group(0)
        # Mask all but last 4 digits
        return mask_value(cc, preserve_last=4)
    
    redacted_text = re.sub(cc_pattern, replace_cc, text)
    return redacted_text, count


def redact_phone(text):
    """
    Detect and redact phone numbers in North American formats.
    Supports formats like:
    - (123) 456-7890
    - 123-456-7890
    - 123.456.7890
    - 1234567890
    
    Args:
        text: Input text that may contain phone numbers
    
    Returns:
        Tuple of (redacted_text, detection_count)
    """
    # Pattern for North American phone numbers with various formats
    phone_pattern = r'\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'
    
    matches = re.findall(phone_pattern, text)
    count = len(matches)
    
    def replace_phone(match):
        phone = match.group(0)
        # Always return format: ***-***-1234 (last 4 digits preserved)
        digits_only = re.sub(r'\D', '', phone)
        return '***-***-' + digits_only[-4:]
    
    redacted_text = re.sub(phone_pattern, replace_phone, text)
    return redacted_text, count


def redact_email(text):
    """
    Detect and mask email addresses while preserving the domain.
    Example: john.doe@example.com -> j***@example.com
    
    Args:
        text: Input text that may contain email addresses
    
    Returns:
        Tuple of (redacted_text, detection_count)
    """
    # Pattern for email addresses
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    
    matches = re.findall(email_pattern, text)
    count = len(matches)
    
    def replace_email(match):
        email = match.group(0)
        local, domain = email.split('@', 1)
        
        # Mask local part: preserve first character, mask rest
        if len(local) > 1:
            masked_local = local[0] + '***'
        else:
            masked_local = '***'
        
        return f"{masked_local}@{domain}"
    
    redacted_text = re.sub(email_pattern, replace_email, text)
    return redacted_text, count


def redact_pii_in_text(text):
    """
    Apply all PII redaction patterns to a text string.
    
    Args:
        text: Input text to redact
    
    Returns:
        Tuple of (redacted_text, detection_summary)
    """
    if not isinstance(text, str):
        return text, {}
    
    detection_summary = {}
    redacted = text
    
    # Apply each redaction pattern in sequence
    redacted, ssn_count = redact_ssn(redacted)
    if ssn_count > 0:
        detection_summary['ssn'] = ssn_count
    
    redacted, cc_count = redact_credit_card(redacted)
    if cc_count > 0:
        detection_summary['credit_card'] = cc_count
    
    redacted, phone_count = redact_phone(redacted)
    if phone_count > 0:
        detection_summary['phone'] = phone_count
    
    redacted, email_count = redact_email(redacted)
    if email_count > 0:
        detection_summary['email'] = email_count
    
    return redacted, detection_summary


def redact_pii_in_object(obj, path=""):
    """
    Recursively redact PII in a dictionary or list object.
    
    Args:
        obj: Object to redact (dict, list, or primitive)
        path: Current path in object (for logging)
    
    Returns:
        Tuple of (redacted_object, overall_detection_summary)
    """
    overall_detections = {}
    
    if isinstance(obj, dict):
        redacted_dict = {}
        for key, value in obj.items():
            current_path = f"{path}.{key}" if path else key
            redacted_value, detections = redact_pii_in_object(value, current_path)
            redacted_dict[key] = redacted_value
            
            # Merge detection summaries
            for pii_type, count in detections.items():
                overall_detections[pii_type] = overall_detections.get(pii_type, 0) + count
        
        return redacted_dict, overall_detections
    
    elif isinstance(obj, list):
        redacted_list = []
        for idx, item in enumerate(obj):
            current_path = f"{path}[{idx}]"
            redacted_item, detections = redact_pii_in_object(item, current_path)
            redacted_list.append(redacted_item)
            
            # Merge detection summaries
            for pii_type, count in detections.items():
                overall_detections[pii_type] = overall_detections.get(pii_type, 0) + count
        
        return redacted_list, overall_detections
    
    elif isinstance(obj, str):
        redacted_text, detections = redact_pii_in_text(obj)
        return redacted_text, detections
    
    else:
        # Return primitive types as-is
        return obj, {}


def lambda_handler(event, context):
    """
    AWS Lambda handler for PII redaction.
    
    Args:
        event: Input event containing onboarding request data
        context: Lambda context object
    
    Returns:
        Redacted event data with PII masked
    """
    try:
        logger.info("Starting PII redaction process")
        
        # Redact PII from the entire event object
        redacted_event, detection_summary = redact_pii_in_object(event)
        
        # Log detected PII types (without logging actual values)
        if detection_summary:
            logger.info(f"PII detected and redacted: {json.dumps(detection_summary)}")
        else:
            logger.info("No PII detected in input")
        
        # Add metadata about redaction
        redacted_event['piiRedactionMetadata'] = {
            'redacted': True,
            'detectionSummary': detection_summary,
            'timestamp': context.aws_request_id if context else 'local'
        }
        
        logger.info("PII redaction completed successfully")
        return redacted_event
    
    except Exception as e:
        # Log error without exposing sensitive data
        logger.error(f"Error during PII redaction: {str(e)}", exc_info=True)
        
        # Return original data with error flag
        return {
            **event,
            'piiRedactionMetadata': {
                'redacted': False,
                'error': str(e),
                'timestamp': context.aws_request_id if context else 'local'
            }
        }
