import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
  stateMachine: sfn.StateMachine;
  lambdaFunctions: lambda.Function[];
  alarmEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Create SNS topic for alarm notifications
    this.alarmTopic = new sns.Topic(this, 'AlarmNotificationTopic', {
      displayName: 'Veritas Onboard Monitoring Alarms',
      topicName: 'veritas-onboard-monitoring-alarms',
    });

    // Subscribe email to alarm topic if provided
    if (props.alarmEmail) {
      this.alarmTopic.addSubscription(
        new sns_subscriptions.EmailSubscription(props.alarmEmail)
      );
    }

    // Export alarm topic ARN
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS topic ARN for monitoring alarms',
      exportName: `${id}-alarm-topic-arn`,
    });

    // Create API Gateway alarms
    this.createApiGatewayAlarms(props.api);

    // Create Step Functions alarms
    this.createStepFunctionsAlarms(props.stateMachine);

    // Create Lambda alarms
    this.createLambdaAlarms(props.lambdaFunctions);
  }

  /**
   * Create alarm for API Gateway 5XX error rate > 1% for 5 minutes
   */
  private createApiGatewayAlarms(api: apigateway.RestApi): void {
    // 5XX Error Rate Alarm
    const api5xxErrorMetric = new cloudwatch.MathExpression({
      expression: '(m1/m2)*100',
      usingMetrics: {
        m1: api.metricServerError({
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
        m2: api.metricCount({
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
      },
      label: 'API Gateway 5XX Error Rate (%)',
    });

    const api5xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxErrorAlarm', {
      alarmName: 'veritas-onboard-api-5xx-error-rate',
      alarmDescription: 'Alert when API Gateway 5XX error rate exceeds 1% for 5 minutes',
      metric: api5xxErrorMetric,
      threshold: 1,
      evaluationPeriods: 5,
      datapointsToAlarm: 5,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // 4XX Error Rate Alarm (warning level)
    const api4xxErrorMetric = new cloudwatch.MathExpression({
      expression: '(m1/m2)*100',
      usingMetrics: {
        m1: api.metricClientError({
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
        m2: api.metricCount({
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
      },
      label: 'API Gateway 4XX Error Rate (%)',
    });

    const api4xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway4xxErrorAlarm', {
      alarmName: 'veritas-onboard-api-4xx-error-rate',
      alarmDescription: 'Alert when API Gateway 4XX error rate exceeds 5% for 10 minutes',
      metric: api4xxErrorMetric,
      threshold: 5,
      evaluationPeriods: 10,
      datapointsToAlarm: 8,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api4xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // High Latency Alarm
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: 'veritas-onboard-api-high-latency',
      alarmDescription: 'Alert when API Gateway p99 latency exceeds 2000ms for 10 minutes',
      metric: api.metricLatency({
        statistic: 'p99',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 2000,
      evaluationPeriods: 10,
      datapointsToAlarm: 8,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    apiLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }

  /**
   * Create alarm for Step Functions execution failure rate > 5% for 5 minutes
   */
  private createStepFunctionsAlarms(stateMachine: sfn.StateMachine): void {
    // Execution Failure Rate Alarm
    const sfnFailureRateMetric = new cloudwatch.MathExpression({
      expression: '(m1/m2)*100',
      usingMetrics: {
        m1: stateMachine.metricFailed({
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
        m2: stateMachine.metricStarted({
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
      },
      label: 'Step Functions Failure Rate (%)',
    });

    const sfnFailureAlarm = new cloudwatch.Alarm(this, 'StepFunctionsFailureAlarm', {
      alarmName: 'veritas-onboard-stepfunctions-failure-rate',
      alarmDescription: 'Alert when Step Functions execution failure rate exceeds 5% for 5 minutes',
      metric: sfnFailureRateMetric,
      threshold: 5,
      evaluationPeriods: 5,
      datapointsToAlarm: 5,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    sfnFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Execution Timeout Alarm
    const sfnTimeoutAlarm = new cloudwatch.Alarm(this, 'StepFunctionsTimeoutAlarm', {
      alarmName: 'veritas-onboard-stepfunctions-timeout',
      alarmDescription: 'Alert when Step Functions executions are timing out',
      metric: stateMachine.metricTimedOut({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    sfnTimeoutAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Long Execution Duration Alarm
    const sfnDurationMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionTime',
      dimensionsMap: {
        StateMachineArn: stateMachine.stateMachineArn,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const sfnDurationAlarm = new cloudwatch.Alarm(this, 'StepFunctionsDurationAlarm', {
      alarmName: 'veritas-onboard-stepfunctions-long-duration',
      alarmDescription: 'Alert when Step Functions execution duration exceeds 3 minutes',
      metric: sfnDurationMetric,
      threshold: 180000, // 3 minutes in milliseconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    sfnDurationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }

  /**
   * Create alarm for Lambda error rate > 5% for 5 minutes
   */
  private createLambdaAlarms(lambdaFunctions: lambda.Function[]): void {
    lambdaFunctions.forEach((fn, index) => {
      // Error Rate Alarm
      const lambdaErrorRateMetric = new cloudwatch.MathExpression({
        expression: '(m1/m2)*100',
        usingMetrics: {
          m1: fn.metricErrors({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
          m2: fn.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        },
        label: `${fn.functionName} Error Rate (%)`,
      });

      const lambdaErrorAlarm = new cloudwatch.Alarm(this, `Lambda${index}ErrorAlarm`, {
        alarmName: `${fn.functionName}-error-rate`,
        alarmDescription: `Alert when ${fn.functionName} error rate exceeds 5% for 5 minutes`,
        metric: lambdaErrorRateMetric,
        threshold: 5,
        evaluationPeriods: 5,
        datapointsToAlarm: 5,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      lambdaErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Throttle Alarm
      const lambdaThrottleAlarm = new cloudwatch.Alarm(this, `Lambda${index}ThrottleAlarm`, {
        alarmName: `${fn.functionName}-throttle`,
        alarmDescription: `Alert when ${fn.functionName} is being throttled`,
        metric: fn.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      lambdaThrottleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Duration Alarm (only for functions with timeout > 30s)
      if (fn.timeout && fn.timeout.toSeconds() > 30) {
        const durationThreshold = fn.timeout.toMilliseconds() * 0.8; // 80% of timeout
        const lambdaDurationAlarm = new cloudwatch.Alarm(this, `Lambda${index}DurationAlarm`, {
          alarmName: `${fn.functionName}-long-duration`,
          alarmDescription: `Alert when ${fn.functionName} duration exceeds 80% of timeout`,
          metric: fn.metricDuration({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
          threshold: durationThreshold,
          evaluationPeriods: 2,
          datapointsToAlarm: 2,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

        lambdaDurationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
      }
    });
  }
}
