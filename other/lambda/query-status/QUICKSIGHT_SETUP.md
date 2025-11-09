# QuickSight Dashboard Setup Guide

This guide provides step-by-step instructions for setting up Amazon QuickSight dashboards to visualize Veritas Onboard metrics and analytics.

## Prerequisites

- AWS account with QuickSight enabled
- Veritas Onboard infrastructure deployed (DynamoDB table and Lambda functions)
- QuickSight subscription (Standard or Enterprise edition)
- IAM permissions to create QuickSight data sources and datasets

## Overview

The Veritas Onboard QuickSight dashboard provides real-time insights into:
- Onboarding request volume and trends
- Status distribution (Approved, Manual Review, Rejected)
- Risk score analysis and patterns
- Approval rates and processing metrics
- Time-series trends for operational monitoring

## Architecture

QuickSight can connect to the onboarding data through two methods:

1. **Direct DynamoDB Connection** (Recommended for real-time data)
   - QuickSight connects directly to the DynamoDB table
   - Provides real-time data access
   - Requires SPICE refresh for performance

2. **Lambda API Endpoint** (Recommended for aggregated metrics)
   - QuickSight calls the `/analytics` API endpoint
   - Lambda function provides pre-aggregated metrics
   - Reduces DynamoDB scan costs
   - Better performance for large datasets

## Setup Instructions

### Step 1: Enable QuickSight

1. Navigate to the AWS QuickSight console: https://quicksight.aws.amazon.com/
2. If not already enabled, click **Sign up for QuickSight**
3. Choose **Standard** or **Enterprise** edition
4. Configure QuickSight account settings:
   - Account name: `veritas-onboard-analytics`
   - Notification email: Your admin email
   - QuickSight region: Same region as your DynamoDB table
5. Grant QuickSight access to AWS services:
   - ✅ Amazon DynamoDB
   - ✅ AWS Lambda
   - ✅ Amazon S3 (for exports)

### Step 2: Create Data Source - DynamoDB

#### Option A: Direct DynamoDB Connection

1. In QuickSight console, click **Datasets** in the left navigation
2. Click **New dataset**
3. Select **DynamoDB** as the data source
4. Configure the data source:
   - **Data source name**: `OnboardingRequests`
   - **Region**: Select your deployment region
   - **Table**: Select `OnboardingRequests`
5. Click **Create data source**
6. Select **Import to SPICE for quicker analytics** (recommended)
7. Click **Visualize** to create your first analysis

#### Option B: Lambda API Endpoint (Aggregated Metrics)

1. In QuickSight console, click **Datasets** in the left navigation
2. Click **New dataset**
3. Select **API** as the data source (via S3 manifest)
4. First, create a Lambda function URL:
   ```bash
   # Get the Lambda function ARN
   aws lambda get-function --function-name veritas-onboard-quicksight-data
   
   # Create function URL (if not already created)
   aws lambda create-function-url-config \
     --function-name veritas-onboard-quicksight-data \
     --auth-type AWS_IAM
   ```
5. Create an S3 manifest file for QuickSight:
   ```json
   {
     "fileLocations": [
       {
         "URIs": [
           "https://<your-api-gateway-url>/prod/analytics?type=detailed"
         ]
       }
     ],
     "globalUploadSettings": {
       "format": "JSON"
     }
   }
   ```
6. Upload the manifest to S3 and use it as the data source

### Step 3: Create Dataset from DynamoDB

1. After connecting to DynamoDB, QuickSight will show the table schema
2. Select the following fields for your dataset:
   - `requestId` (String)
   - `status` (String)
   - `vendorName` (String)
   - `contactEmail` (String)
   - `createdAt` (Number)
   - `updatedAt` (Number)
   - `riskScores.fraudScore` (Number)
   - `riskScores.contentRiskScore` (Number)
   - `riskScores.combinedRiskScore` (Number)
   - `fraudDetails.modelVersion` (String)
   - `sentimentDetails.sentiment` (String)

3. Configure field types:
   - Convert `createdAt` and `updatedAt` to **Date** type:
     - Click the field → **Change data type** → **Date**
     - Format: Unix timestamp (seconds)
   - Ensure risk scores are **Decimal** type

4. Create calculated fields:
   
   **Approval Rate**:
   ```
   ifelse(
     {status} = 'APPROVED', 1,
     {status} = 'MANUAL_REVIEW' OR {status} = 'REJECTED', 0,
     NULL
   )
   ```
   
   **High Risk Flag**:
   ```
   ifelse({riskScores.combinedRiskScore} > 0.8, 'High Risk', 'Low Risk')
   ```
   
   **Processing Time** (if you have both timestamps):
   ```
   dateDiff({createdAt}, {updatedAt}, 'MI')
   ```
   
   **Created Date** (for grouping):
   ```
   truncDate('DD', {createdAt})
   ```

5. Click **Save & publish** to save the dataset

### Step 4: Create Visualizations

#### Visualization 1: Status Distribution (Pie Chart)

1. Click **New analysis** → Select your dataset
2. Click **Add** → **Add visual**
3. Select **Pie chart** from visual types
4. Configure:
   - **Group/Color**: `status`
   - **Value**: Count of `requestId`
5. Format:
   - Title: "Onboarding Status Distribution"
   - Show data labels: Yes
   - Show legend: Yes
6. Apply color scheme:
   - APPROVED: Green (#2ECC71)
   - MANUAL_REVIEW: Orange (#F39C12)
   - REJECTED: Red (#E74C3C)
   - SUBMITTED: Blue (#3498DB)

#### Visualization 2: Risk Score Distribution (Histogram)

1. Click **Add** → **Add visual**
2. Select **Histogram** from visual types
3. Configure:
   - **Value**: `riskScores.combinedRiskScore`
   - **Bins**: 10
4. Format:
   - Title: "Combined Risk Score Distribution"
   - X-axis label: "Risk Score"
   - Y-axis label: "Number of Requests"

#### Visualization 3: Time-Series Trends (Line Chart)

1. Click **Add** → **Add visual**
2. Select **Line chart** from visual types
3. Configure:
   - **X-axis**: `createdAt` (grouped by day)
   - **Value**: Count of `requestId`
   - **Color**: `status`
4. Format:
   - Title: "Daily Onboarding Request Volume"
   - X-axis label: "Date"
   - Y-axis label: "Number of Requests"
   - Show data markers: Yes

#### Visualization 4: Average Risk Scores Over Time (Line Chart)

1. Click **Add** → **Add visual**
2. Select **Line chart** from visual types
3. Configure:
   - **X-axis**: `createdAt` (grouped by day)
   - **Value**: Average of `riskScores.combinedRiskScore`
   - Add second line: Average of `riskScores.fraudScore`
   - Add third line: Average of `riskScores.contentRiskScore`
4. Format:
   - Title: "Average Risk Scores Trend"
   - X-axis label: "Date"
   - Y-axis label: "Average Risk Score"
   - Y-axis range: 0 to 1

#### Visualization 5: Approval Rate KPI

1. Click **Add** → **Add visual**
2. Select **KPI** from visual types
3. Configure:
   - **Value**: Average of `Approval Rate` (calculated field)
   - **Comparison**: Previous period
4. Format:
   - Title: "Approval Rate"
   - Primary value format: Percentage
   - Show comparison: Yes

#### Visualization 6: High Risk Requests Table

1. Click **Add** → **Add visual**
2. Select **Table** from visual types
3. Configure columns:
   - `requestId`
   - `vendorName`
   - `status`
   - `riskScores.combinedRiskScore`
   - `createdAt`
4. Add filter: `riskScores.combinedRiskScore` > 0.8
5. Format:
   - Title: "High Risk Requests (Score > 0.8)"
   - Sort by: `riskScores.combinedRiskScore` descending
   - Conditional formatting: Highlight scores > 0.8 in red

#### Visualization 7: Sentiment Analysis Breakdown (Bar Chart)

1. Click **Add** → **Add visual**
2. Select **Horizontal bar chart** from visual types
3. Configure:
   - **Y-axis**: `sentimentDetails.sentiment`
   - **Value**: Count of `requestId`
4. Format:
   - Title: "Business Description Sentiment Distribution"
   - Show data labels: Yes

### Step 5: Create Dashboard Layout

1. Arrange visuals in a logical layout:
   ```
   ┌─────────────────────────────────────────────────────┐
   │  Dashboard Title: Veritas Onboard Analytics         │
   ├──────────────────┬──────────────────┬───────────────┤
   │  Approval Rate   │  Total Requests  │  Avg Risk     │
   │      KPI         │      KPI         │  Score KPI    │
   ├──────────────────┴──────────────────┴───────────────┤
   │  Daily Onboarding Request Volume (Line Chart)       │
   │                                                      │
   ├──────────────────┬───────────────────────────────────┤
   │  Status          │  Risk Score Distribution         │
   │  Distribution    │  (Histogram)                     │
   │  (Pie Chart)     │                                  │
   ├──────────────────┴───────────────────────────────────┤
   │  Average Risk Scores Trend (Line Chart)             │
   │                                                      │
   ├──────────────────┬───────────────────────────────────┤
   │  Sentiment       │  High Risk Requests Table        │
   │  Breakdown       │                                  │
   │  (Bar Chart)     │                                  │
   └──────────────────┴───────────────────────────────────┘
   ```

2. Add filters to the dashboard:
   - Date range filter (last 7 days, 30 days, 90 days, custom)
   - Status filter (multi-select)
   - Risk score range filter

3. Click **Share** → **Publish dashboard**
4. Name: "Veritas Onboard Executive Dashboard"
5. Set permissions for users who should access the dashboard

### Step 6: Configure SPICE Refresh Schedule

1. Go to **Datasets** in QuickSight
2. Select your `OnboardingRequests` dataset
3. Click **Schedule refresh**
4. Configure refresh schedule:
   - **Frequency**: Daily
   - **Time**: 6:00 AM (or your preferred time)
   - **Time zone**: Your local time zone
5. For real-time updates, you can also trigger manual refreshes via API:
   ```bash
   aws quicksight create-ingestion \
     --aws-account-id <account-id> \
     --data-set-id <dataset-id> \
     --ingestion-id $(date +%s)
   ```

### Step 7: Set Up Alerts (Optional)

1. In your dashboard, select a visual (e.g., Approval Rate KPI)
2. Click the visual menu → **Create alert**
3. Configure alert conditions:
   - **Metric**: Approval Rate
   - **Condition**: Less than 80%
   - **Notification**: Email to admin team
4. Click **Create alert**

## Using the Lambda API Endpoint

The `/analytics` endpoint provides three types of data:

### 1. Summary Metrics (Default)

```bash
curl -H "Authorization: Bearer <jwt-token>" \
  https://<api-gateway-url>/prod/analytics
```

Response:
```json
{
  "type": "summary",
  "metrics": {
    "totalRequests": 1250,
    "statusCounts": {
      "SUBMITTED": 45,
      "APPROVED": 980,
      "MANUAL_REVIEW": 200,
      "REJECTED": 25
    },
    "averageScores": {
      "fraudScore": 0.342,
      "contentRiskScore": 0.156,
      "combinedRiskScore": 0.286
    },
    "approvalRate": 81.33,
    "manualReviewRate": 16.60
  },
  "timestamp": 1699564800
}
```

### 2. Time-Series Data

```bash
curl -H "Authorization: Bearer <jwt-token>" \
  "https://<api-gateway-url>/prod/analytics?type=timeseries&days=30"
```

Response:
```json
{
  "type": "timeseries",
  "data": [
    {
      "date": "2024-11-01",
      "totalRequests": 42,
      "approved": 35,
      "manualReview": 6,
      "rejected": 1,
      "averageRiskScore": 0.312
    },
    ...
  ]
}
```

### 3. Detailed Data (For Custom Analysis)

```bash
curl -H "Authorization: Bearer <jwt-token>" \
  "https://<api-gateway-url>/prod/analytics?type=detailed"
```

Response:
```json
{
  "type": "detailed",
  "data": [
    {
      "requestId": "uuid-1",
      "status": "APPROVED",
      "vendorName": "Acme Corp",
      "createdAt": 1699564800,
      "fraudScore": 0.25,
      "contentRiskScore": 0.10,
      "combinedRiskScore": 0.205
    },
    ...
  ]
}
```

## Best Practices

### Performance Optimization

1. **Use SPICE**: Always import data to SPICE for faster query performance
2. **Incremental Refresh**: Configure incremental refresh for large datasets
3. **Aggregations**: Pre-aggregate data in Lambda for better performance
4. **Filters**: Apply filters at the dataset level when possible

### Cost Optimization

1. **SPICE Capacity**: Monitor SPICE usage and purchase additional capacity if needed
2. **Refresh Schedule**: Balance freshness needs with refresh costs
3. **Lambda Aggregation**: Use Lambda endpoint to reduce DynamoDB scan costs
4. **Data Retention**: Archive old data to S3 and use Athena for historical analysis

### Security

1. **IAM Permissions**: Use least-privilege IAM roles for QuickSight
2. **Row-Level Security**: Implement RLS if multiple teams access the dashboard
3. **VPC Connection**: Use VPC connection for private data sources
4. **Encryption**: Enable encryption at rest for SPICE datasets

### Monitoring

1. **Dashboard Usage**: Monitor dashboard views and user engagement
2. **Refresh Failures**: Set up alerts for failed SPICE refreshes
3. **Query Performance**: Monitor query execution times
4. **Data Freshness**: Display last refresh timestamp on dashboard

## Troubleshooting

### Issue: QuickSight Cannot Access DynamoDB

**Solution**:
1. Verify QuickSight has DynamoDB permissions in IAM
2. Check that QuickSight is enabled in the same region as DynamoDB
3. Verify the table name is correct

### Issue: SPICE Refresh Fails

**Solution**:
1. Check CloudWatch logs for the refresh job
2. Verify DynamoDB table is accessible
3. Check SPICE capacity limits
4. Verify data types are compatible

### Issue: Visualizations Show No Data

**Solution**:
1. Verify dataset has data (check preview)
2. Check filters are not excluding all data
3. Verify field mappings are correct
4. Refresh the dataset manually

### Issue: Lambda API Returns 500 Error

**Solution**:
1. Check Lambda CloudWatch logs
2. Verify TABLE_NAME environment variable is set
3. Check Lambda has DynamoDB read permissions
4. Verify DynamoDB table exists and has data

## Advanced Features

### Custom Metrics

Create calculated fields for advanced metrics:

**Fraud Detection Accuracy** (requires manual review outcomes):
```
ifelse(
  {status} = 'APPROVED' AND {riskScores.combinedRiskScore} < 0.8, 1,
  {status} = 'MANUAL_REVIEW' AND {riskScores.combinedRiskScore} > 0.8, 1,
  0
)
```

**Risk Category**:
```
ifelse(
  {riskScores.combinedRiskScore} < 0.3, 'Low',
  {riskScores.combinedRiskScore} < 0.6, 'Medium',
  {riskScores.combinedRiskScore} < 0.8, 'High',
  'Critical'
)
```

### Embedding Dashboards

To embed QuickSight dashboards in your application:

1. Enable anonymous embedding in QuickSight settings
2. Use QuickSight SDK to generate embed URLs:
   ```python
   import boto3
   
   quicksight = boto3.client('quicksight')
   
   response = quicksight.generate_embed_url_for_anonymous_user(
       AwsAccountId='<account-id>',
       Namespace='default',
       AuthorizedResourceArns=[
           'arn:aws:quicksight:region:account-id:dashboard/dashboard-id'
       ],
       ExperienceConfiguration={
           'Dashboard': {
               'InitialDashboardId': 'dashboard-id'
           }
       }
   )
   
   embed_url = response['EmbedUrl']
   ```

3. Embed the URL in an iframe in your React application

## Sample Dashboard Screenshots

### Executive Summary View
- KPIs showing approval rate, total requests, and average risk score
- Status distribution pie chart
- Daily volume trend line

### Risk Analysis View
- Risk score distribution histogram
- High-risk requests table
- Fraud vs content risk scatter plot

### Operational Metrics View
- Processing time analysis
- Sentiment breakdown
- Time-series trends with filters

## Additional Resources

- [Amazon QuickSight Documentation](https://docs.aws.amazon.com/quicksight/)
- [QuickSight API Reference](https://docs.aws.amazon.com/quicksight/latest/APIReference/)
- [SPICE Best Practices](https://docs.aws.amazon.com/quicksight/latest/user/spice-best-practices.html)
- [QuickSight Pricing](https://aws.amazon.com/quicksight/pricing/)

## Support

For issues or questions:
1. Check CloudWatch logs for Lambda and QuickSight
2. Review AWS Service Health Dashboard
3. Contact AWS Support for QuickSight-specific issues
4. Refer to the Veritas Onboard documentation for system-specific questions
