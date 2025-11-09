#!/bin/bash

# Veritas Onboard Deployment Script
# This script automates the deployment of the Veritas Onboard platform

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate prerequisites
validate_prerequisites() {
    print_header "Validating Prerequisites"
    
    local all_valid=true
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
        
        # Extract major version number
        NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
        if [ "$NODE_MAJOR" -lt 18 ]; then
            print_error "Node.js version must be 18.x or higher (found: $NODE_VERSION)"
            all_valid=false
        fi
    else
        print_error "Node.js is not installed"
        all_valid=false
    fi
    
    # Check Python
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python is installed: $PYTHON_VERSION"
        
        # Extract version numbers
        PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
        PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
        
        if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 12 ]); then
            print_warning "Python version should be 3.12 or higher (found: $PYTHON_VERSION)"
        fi
    else
        print_error "Python 3 is not installed"
        all_valid=false
    fi
    
    # Check AWS CLI
    if command_exists aws; then
        AWS_VERSION=$(aws --version 2>&1)
        print_success "AWS CLI is installed: $AWS_VERSION"
        
        # Check AWS credentials
        if aws sts get-caller-identity >/dev/null 2>&1; then
            AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
            AWS_REGION=$(aws configure get region)
            print_success "AWS credentials are configured"
            print_info "  Account: $AWS_ACCOUNT"
            print_info "  Region: ${AWS_REGION:-us-east-1 (default)}"
        else
            print_error "AWS credentials are not configured. Run 'aws configure'"
            all_valid=false
        fi
    else
        print_error "AWS CLI is not installed"
        all_valid=false
    fi
    
    # Check CDK CLI
    if command_exists cdk; then
        CDK_VERSION=$(cdk --version)
        print_success "AWS CDK is installed: $CDK_VERSION"
    else
        print_error "AWS CDK is not installed. Run 'npm install -g aws-cdk'"
        all_valid=false
    fi
    
    # Check for jq (optional but helpful)
    if command_exists jq; then
        print_success "jq is installed (for JSON parsing)"
    else
        print_warning "jq is not installed (optional, but recommended for output parsing)"
    fi
    
    if [ "$all_valid" = false ]; then
        print_error "Prerequisites validation failed. Please install missing dependencies."
        exit 1
    fi
    
    print_success "All prerequisites validated successfully"
}

# Function to validate environment variables
validate_environment() {
    print_header "Validating Environment"
    
    # Check if CDK is bootstrapped
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=${AWS_REGION:-$(aws configure get region)}
    AWS_REGION=${AWS_REGION:-us-east-1}
    
    print_info "Target AWS Account: $AWS_ACCOUNT"
    print_info "Target AWS Region: $AWS_REGION"
    
    # Check if bootstrap stack exists
    if aws cloudformation describe-stacks --stack-name CDKToolkit --region "$AWS_REGION" >/dev/null 2>&1; then
        print_success "CDK is bootstrapped in this account/region"
    else
        print_warning "CDK is not bootstrapped in this account/region"
        print_info "Run: cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION"
        
        read -p "Would you like to bootstrap now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Bootstrapping CDK..."
            cdk bootstrap "aws://$AWS_ACCOUNT/$AWS_REGION"
            print_success "CDK bootstrapped successfully"
        else
            print_error "CDK bootstrap is required for deployment"
            exit 1
        fi
    fi
}

# Function to build the project
build_project() {
    print_header "Building Project"
    
    print_info "Installing Node.js dependencies..."
    npm install
    
    print_info "Compiling TypeScript code..."
    npm run build
    
    print_success "Project built successfully"
}

# Function to check Fraud Detector setup
check_fraud_detector() {
    print_header "Checking Fraud Detector Setup"
    
    # Check if detector exists
    if aws frauddetector get-detectors --detector-id veritas_onboard_detector --region "$AWS_REGION" >/dev/null 2>&1; then
        print_success "Fraud Detector is configured"
    else
        print_warning "Fraud Detector is not configured"
        print_info "You need to set up Fraud Detector before deployment"
        print_info "Run: cd lambda/fraud-detector && ./setup-fraud-detector.sh"
        
        read -p "Would you like to set up Fraud Detector now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Setting up Fraud Detector..."
            cd lambda/fraud-detector
            chmod +x setup-fraud-detector.sh
            ./setup-fraud-detector.sh
            cd ../..
            print_success "Fraud Detector configured successfully"
        else
            print_warning "Continuing without Fraud Detector setup (deployment may fail)"
        fi
    fi
}

# Function to deploy CDK stacks
deploy_stacks() {
    print_header "Deploying CDK Stacks"
    
    # Get environment parameter if provided
    ENVIRONMENT=${1:-dev}
    
    print_info "Deploying to environment: $ENVIRONMENT"
    
    # Deploy all stacks
    if [ "$ENVIRONMENT" = "dev" ]; then
        print_info "Running: cdk deploy --all --require-approval never"
        cdk deploy --all --require-approval never
    else
        print_info "Running: cdk deploy --all --context environment=$ENVIRONMENT --require-approval never"
        cdk deploy --all --context environment="$ENVIRONMENT" --require-approval never
    fi
    
    print_success "All stacks deployed successfully"
}

# Function to extract and display outputs
display_outputs() {
    print_header "Deployment Outputs"
    
    AWS_REGION=${AWS_REGION:-$(aws configure get region)}
    AWS_REGION=${AWS_REGION:-us-east-1}
    
    print_info "Extracting CloudFormation outputs..."
    echo ""
    
    # Function to get stack output
    get_output() {
        local stack_name=$1
        local output_key=$2
        aws cloudformation describe-stacks \
            --stack-name "$stack_name" \
            --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
            --output text \
            --region "$AWS_REGION" 2>/dev/null || echo "N/A"
    }
    
    # Extract outputs from each stack
    print_info "API Stack Outputs:"
    API_ENDPOINT=$(get_output "VeritasOnboardApiStack" "ApiEndpoint")
    echo "  API Endpoint: $API_ENDPOINT"
    
    print_info "Amplify Stack Outputs:"
    USER_POOL_ID=$(get_output "VeritasOnboardAmplifyStack" "UserPoolId")
    USER_POOL_CLIENT_ID=$(get_output "VeritasOnboardAmplifyStack" "UserPoolClientId")
    echo "  User Pool ID: $USER_POOL_ID"
    echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
    
    print_info "Database Stack Outputs:"
    TABLE_NAME=$(get_output "VeritasOnboardDatabaseStack" "TableName")
    echo "  DynamoDB Table: $TABLE_NAME"
    
    print_info "Workflow Stack Outputs:"
    STATE_MACHINE_ARN=$(get_output "VeritasOnboardWorkflowStack" "StateMachineArn")
    SNS_TOPIC_ARN=$(get_output "VeritasOnboardWorkflowStack" "AdminNotificationTopicArn")
    echo "  State Machine ARN: $STATE_MACHINE_ARN"
    echo "  SNS Topic ARN: $SNS_TOPIC_ARN"
    
    echo ""
    print_success "Deployment completed successfully!"
    echo ""
    
    # Save outputs to file
    OUTPUT_FILE="deployment-outputs.txt"
    cat > "$OUTPUT_FILE" <<EOF
Veritas Onboard Deployment Outputs
Generated: $(date)
Region: $AWS_REGION

API Endpoint: $API_ENDPOINT
User Pool ID: $USER_POOL_ID
User Pool Client ID: $USER_POOL_CLIENT_ID
DynamoDB Table: $TABLE_NAME
State Machine ARN: $STATE_MACHINE_ARN
SNS Topic ARN: $SNS_TOPIC_ARN
EOF
    
    print_info "Outputs saved to: $OUTPUT_FILE"
}

# Function to display next steps
display_next_steps() {
    print_header "Next Steps"
    
    echo "1. Subscribe to Admin Notifications:"
    echo "   aws sns subscribe \\"
    echo "     --topic-arn $SNS_TOPIC_ARN \\"
    echo "     --protocol email \\"
    echo "     --notification-endpoint admin@example.com"
    echo ""
    
    echo "2. Configure Frontend Environment Variables:"
    echo "   Run: ./scripts/configure-frontend.sh"
    echo "   Or manually create frontend/.env.local with:"
    echo "   NEXT_PUBLIC_API_ENDPOINT=$API_ENDPOINT"
    echo "   NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID"
    echo "   NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"
    echo "   NEXT_PUBLIC_AWS_REGION=$AWS_REGION"
    echo ""
    
    # Optionally run the configure script automatically
    if [ -f "scripts/configure-frontend.sh" ]; then
        read -p "Would you like to configure the frontend automatically now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Configuring frontend..."
            chmod +x scripts/configure-frontend.sh
            ./scripts/configure-frontend.sh "$ENVIRONMENT"
            print_success "Frontend configured successfully"
        fi
    fi
    echo ""
    
    echo "3. Create a Test User:"
    echo "   aws cognito-idp admin-create-user \\"
    echo "     --user-pool-id $USER_POOL_ID \\"
    echo "     --username testuser@example.com \\"
    echo "     --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \\"
    echo "     --temporary-password TempPassword123!"
    echo ""
    
    echo "4. Set Up QuickSight Dashboard (Optional):"
    echo "   See: lambda/query-status/QUICKSIGHT_SETUP.md"
    echo ""
    
    echo "5. Test the System:"
    echo "   - Access the frontend and sign in"
    echo "   - Submit a test onboarding request"
    echo "   - Verify workflow execution in Step Functions console"
    echo "   - Check DynamoDB for the saved record"
    echo ""
    
    print_info "For more information, see README.md"
}

# Main execution
main() {
    print_header "Veritas Onboard Deployment Script"
    
    # Parse command line arguments
    ENVIRONMENT=${1:-dev}
    SKIP_VALIDATION=${2:-false}
    
    if [ "$SKIP_VALIDATION" != "--skip-validation" ]; then
        validate_prerequisites
        validate_environment
    fi
    
    build_project
    check_fraud_detector
    deploy_stacks "$ENVIRONMENT"
    display_outputs
    display_next_steps
    
    print_success "Deployment script completed successfully!"
}

# Run main function
main "$@"
