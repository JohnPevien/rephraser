import { OpenAIStream, StreamingTextResponse } from 'ai';
import {
  AIProviderClient,
  AIRequestOptions,
  AIResponse,
  ChatMessage,
} from '../../types';
import { normalizeError, AIProviderError } from '../../utils/error';
// We can potentially reuse OpenAI's types if the API is compatible
import OpenAI from 'openai'; // Import types, not the client itself

// Constants for configuration
const PROVIDER_NAME = 'deepseek';
const DEFAULT_MODEL = 'deepseek-chat'; // Use the appropriate default DeepSeek model
const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'; // Default DeepSeek API endpoint

interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
}

/**
 * Gets DeepSeek configuration from environment variables.
 */
const getDeepSeekConfig = (): DeepSeekConfig => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    throw new AIProviderError({
      message: 'DeepSeek API key (DEEPSEEK_API_KEY) is not configured.',
      provider: 'deepseek',
    });
  }

  return { apiKey, baseURL };
};

/**
 * Builds the request payload for DeepSeek, assuming OpenAI compatibility.
 */
const buildDeepSeekRequest = (
  options: AIRequestOptions,
): Omit<OpenAI.Chat.ChatCompletionCreateParams, 'model'> & { model: string } => {
  // Reusing the structure from OpenAI's type, ensuring model is always included
  const { messages, model, temperature, max_tokens, top_p, stream, user, providerOptions } = options;

  return {
    model: model || DEFAULT_MODEL,
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[], // Cast needed
    temperature: temperature ?? undefined,
    max_tokens: max_tokens ?? undefined,
    top_p: top_p ?? undefined,
    stream: stream ?? false,
    user: user ?? undefined,
    ...providerOptions,
  };
};

/**
 * Normalizes the non-streaming response from DeepSeek (assuming OpenAI format)
 * to the standard AIResponse format.
 */
const normalizeDeepSeekResponse = (
  deepseekResponse: OpenAI.Chat.ChatCompletion, // Assume OpenAI structure
): AIResponse => {
  // This is identical to normalizeOpenAIResponse if the structure matches
  const choice = deepseekResponse.choices[0];
  return {
    id: deepseekResponse.id,
    content: choice?.message?.content || '',
    model: deepseekResponse.model,
    usage: {
      prompt_tokens: deepseekResponse.usage?.prompt_tokens,
      completion_tokens: deepseekResponse.usage?.completion_tokens,
      total_tokens: deepseekResponse.usage?.total_tokens,
    },
    finish_reason: choice?.finish_reason,
    raw: deepseekResponse,
  };
};


/**
 * DeepSeek provider client implementation using fetch.
 */
export const DeepSeekChatClient: AIProviderClient = {
  chat: async (options: AIRequestOptions): Promise<ReadableStream | AIResponse> => {
    let config: DeepSeekConfig;
    try {
      config = getDeepSeekConfig();
      const requestPayload = buildDeepSeekRequest(options);
      const endpoint = `${config.baseURL.replace(/\/$/, '')}/chat/completions`; // Ensure single slash

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestPayload),
      });

      // Check for HTTP errors
      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch (e) {
          errorBody = await response.text();
        }
        throw new AIProviderError({
          message: `DeepSeek API request failed with status ${response.status}: ${response.statusText}`,
          statusCode: response.status,
          provider: 'deepseek',
          details: errorBody,
        });
      }

      if (options.stream) {
        // Handle streaming response
        if (!response.body) {
          throw new AIProviderError({ message: 'Response body is null for streaming request.', provider: 'deepseek' });
        }
        // Assume OpenAIStream works if the format is compatible
        const stream = OpenAIStream(response);
        // Return the stream directly
        return stream; // The caller (e.g., API route) will wrap this in StreamingTextResponse
      } else {
        // Handle non-streaming response
        const jsonResponse = await response.json();
        // Assume the response JSON matches OpenAI's ChatCompletion structure
        return normalizeDeepSeekResponse(jsonResponse as OpenAI.Chat.ChatCompletion);
      }
    } catch (error) {
      // Normalize and re-throw the error
      throw normalizeError(error, 'deepseek');
    }
  },
};

// Export the client
export default DeepSeekChatClient;