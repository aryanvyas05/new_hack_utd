#!/usr/bin/env python3
"""
Test script for Fraud Detector Lambda function
Tests the Lambda with sample data to verify configuration
"""

import json
import sys
import os

# Add lambda directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import the lambda function
from lambda_function import lambda_handler


def test_fraud_detector_lambda():
    """Test the fraud detector Lambda with sample data"""
    
    print("=" * 60)
    print("Testing Fraud Detector Lambda Function")
    print("=" * 60)
    print()
    
    # Test cases
    test_cases = [
        {
            "name": "Low Risk - Legitimate Business",
            "event": {
                "requestId": "test-low-risk-001",
                "email": "contact@legitimatebusiness.com",
                "ipAddress": "192.168.1.100",
                "vendorName": "Legitimate Business Inc"
            },
            "expected_range": (0.0, 0.4)
        },
        {
            "name": "Medium Risk - New Domain",
            "event": {
                "requestId": "test-medium-risk-001",
                "email": "admin@newstartup.io",
                "ipAddress": "10.0.0.50",
                "vendorName": "New Startup LLC"
            },
            "expected_range": (0.3, 0.7)
        },
        {
            "name": "High Risk - Suspicious Email",
            "event": {
                "requestId": "test-high-risk-001",
                "email": "temp123@tempmail.com",
                "ipAddress": "203.0.113.0",
                "vendorName": "Quick Cash Corp"
            },
            "expected_range": (0.6, 1.0)
        },
        {
            "name": "Edge Case - Missing Optional Fields",
            "event": {
                "requestId": "test-edge-001",
                "email": "",
                "ipAddress": "",
                "vendorName": ""
            },
            "expected_range": (0.0, 1.0)  # Should handle gracefully
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['name']}")
        print("-" * 60)
        print(f"Input: {json.dumps(test_case['event'], indent=2)}")
        print()
        
        try:
            # Call the Lambda handler
            result = lambda_handler(test_case['event'], None)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            print()
            
            # Validate result structure
            assert 'fraudScore' in result, "Missing fraudScore in result"
            assert 'modelVersion' in result, "Missing modelVersion in result"
            assert 'riskFactors' in result, "Missing riskFactors in result"
            
            fraud_score = result['fraudScore']
            assert 0.0 <= fraud_score <= 1.0, f"Fraud score {fraud_score} out of range"
            
            # Check if score is in expected range (informational only)
            min_score, max_score = test_case['expected_range']
            in_range = min_score <= fraud_score <= max_score
            
            results.append({
                "test": test_case['name'],
                "passed": True,
                "score": fraud_score,
                "in_expected_range": in_range,
                "model_version": result['modelVersion']
            })
            
            print(f"✓ Test passed")
            if in_range:
                print(f"✓ Score {fraud_score:.2f} is in expected range [{min_score}, {max_score}]")
            else:
                print(f"⚠ Score {fraud_score:.2f} is outside expected range [{min_score}, {max_score}]")
                print("  (This may be normal depending on Fraud Detector configuration)")
            
        except Exception as e:
            print(f"✗ Test failed: {str(e)}")
            results.append({
                "test": test_case['name'],
                "passed": False,
                "error": str(e)
            })
        
        print()
    
    # Summary
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for r in results if r['passed'])
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    print()
    
    for result in results:
        status = "✓ PASS" if result['passed'] else "✗ FAIL"
        print(f"{status}: {result['test']}")
        if result['passed']:
            print(f"  Score: {result['score']:.3f}")
            print(f"  Model: {result['model_version']}")
            if not result['in_expected_range']:
                print(f"  ⚠ Score outside expected range (may be normal)")
        else:
            print(f"  Error: {result['error']}")
        print()
    
    # Exit with appropriate code
    if passed == total:
        print("All tests passed! ✓")
        return 0
    else:
        print(f"Some tests failed ({total - passed} failures)")
        return 1


def test_error_handling():
    """Test error handling with invalid detector configuration"""
    
    print("=" * 60)
    print("Testing Error Handling")
    print("=" * 60)
    print()
    
    # Temporarily set invalid detector name to test error handling
    original_detector = os.environ.get('DETECTOR_NAME')
    os.environ['DETECTOR_NAME'] = 'non_existent_detector'
    
    test_event = {
        "requestId": "test-error-001",
        "email": "test@example.com",
        "ipAddress": "192.168.1.1",
        "vendorName": "Test Company"
    }
    
    print("Testing with non-existent detector...")
    print(f"Input: {json.dumps(test_event, indent=2)}")
    print()
    
    try:
        result = lambda_handler(test_event, None)
        
        print(f"Result: {json.dumps(result, indent=2)}")
        print()
        
        # Should return default score on error
        assert result['fraudScore'] == 0.5, "Expected default score of 0.5 on error"
        assert 'error' in result, "Expected error field in result"
        
        print("✓ Error handling test passed")
        print("  Lambda correctly returned default score on error")
        
        return_code = 0
        
    except Exception as e:
        print(f"✗ Error handling test failed: {str(e)}")
        return_code = 1
    
    finally:
        # Restore original detector name
        if original_detector:
            os.environ['DETECTOR_NAME'] = original_detector
        else:
            os.environ.pop('DETECTOR_NAME', None)
    
    print()
    return return_code


if __name__ == "__main__":
    # Set environment variables for testing
    os.environ.setdefault('DETECTOR_NAME', 'veritas_onboard_detector')
    os.environ.setdefault('EVENT_TYPE_NAME', 'onboarding_request')
    os.environ.setdefault('MODEL_VERSION', '1.0')
    
    print()
    print("Fraud Detector Lambda Test Suite")
    print("=" * 60)
    print()
    print("Configuration:")
    print(f"  Detector: {os.environ.get('DETECTOR_NAME')}")
    print(f"  Event Type: {os.environ.get('EVENT_TYPE_NAME')}")
    print(f"  Model Version: {os.environ.get('MODEL_VERSION')}")
    print()
    print("Note: These tests require:")
    print("  1. AWS credentials configured")
    print("  2. Fraud Detector model deployed")
    print("  3. Detector activated")
    print()
    input("Press Enter to continue...")
    print()
    
    # Run tests
    exit_code = test_fraud_detector_lambda()
    
    if exit_code == 0:
        print()
        exit_code = test_error_handling()
    
    sys.exit(exit_code)
