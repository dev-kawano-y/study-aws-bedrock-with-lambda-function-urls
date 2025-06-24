import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';

export class InfrastructuresStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda 実行ロール
    const lambdaRole = new iam.Role(this, 'ResponseStreamingLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream'
              ],
              resources: [
                'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0',
                'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0'
              ]
            })
          ]
        })
      }
    });

    // Lambda 関数
    const responseStreamingFunction = new NodejsFunction(this, 'ResponseStreamingFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: 'lambda/index.ts',
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    });

    // Lambda 関数 URL
    const functionUrl = responseStreamingFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['Content-Type'],
        maxAge: cdk.Duration.days(1)
      },
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM
    });

    // 出力
    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: functionUrl.url,
      description: 'Lambda Function URL'
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: responseStreamingFunction.functionName,
      description: 'Lambda Function Name'
    });
  }
}
