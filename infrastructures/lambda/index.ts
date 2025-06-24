import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommandInput,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

interface ResponseStream {
  write: (chunk: string) => void;
  setContentType: (contentType: string) => void;
  end: () => void;
}

// Bedrock client
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

// Claude 3.7 Sonnet
const MODEL_ID = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream: ResponseStream, context: Context) => {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : { prompt: 'Hello, Claude!' };
      const prompt = requestBody.prompt || 'Hello, Claude!';

      // レスポンスヘッダを設定する
      responseStream.setContentType('text/plain');

      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [
          {
            role: "user", content: prompt,
          }
        ],
      };

      const bedrockRequest: InvokeModelWithResponseStreamCommandInput = {
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      };

      const command = new InvokeModelWithResponseStreamCommand(bedrockRequest);
      const response = await bedrockClient.send(command);

      // ストリーミングレスポンスを処理する
      if (response.body) {
        for await (const chunk of response.body) {
          if (chunk.chunk?.bytes) {
            const chunkData = JSON.parse(Buffer.from(chunk.chunk.bytes).toString('utf-8'));

            if (chunkData.type === 'content_block_delta' && chunkData.delta?.type === 'text_delta' && chunkData.delta?.text) {
              responseStream.write(chunkData.delta.text);
            }
          }
        }
      }

      responseStream.end();
    } catch (error) {
      console.error('Error:', error);

      responseStream.setContentType('application/json');
      responseStream.write(JSON.stringify({
        error: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : String(error)
      }));
      responseStream.end();
    }
  }
);
