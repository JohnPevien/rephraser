import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import {
  AIProviderClient,
  AIRequestOptions,
  AIResponse,
  ChatMessage,
} from '../../types';
import { normalizeError, AIProviderError } from '../../utils/error';

// Constants for configuration
const PROVIDER_NAME = 'openai';
const DEFAULT_MODEL = 'gpt-3.5-turbo'; // Or a sensible default

/**
 * Creates an instance of the OpenAI API client.
 * Reads configuration from environment variables.
 */
const createOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL; // Optional

  if (!apiKey) {
    throw new AIProviderError({
      message: 'OpenAI API key (OPENAI_API_KEY) is not configured.',
      provider: PROVIDER_NAME,
    });
  }

  return new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL, // Will be undefined if not set, which is fine for the SDK
  });
};

/**
 * Maps OpenAI API chat completion parameters from the standard AIRequestOptions.
 */
const buildOpenAIRequest = (
  options: AIRequestOptions,
): OpenAI.Chat.ChatCompletionCreateParams => {
  const { messages, model, temperature, max_tokens, top_p, stream, user, providerOptions } = options;

  // Filter out system messages if the first message is system, as OpenAI API expects it differently sometimes
  // Or handle according to specific OpenAI best practices if needed.
  // For simplicity here, we pass them as is, assuming Vercel AI SDK handles roles correctly.

  return {
    model: model || DEFAULT_MODEL,
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[], // Cast needed
    temperature: temperature ?? undefined, // Use nullish coalescing
    max_tokens: max_tokens ?? undefined,
    top_p: top_p ?? undefined,
    stream: stream ?? false,
    user: user ?? undefined,
    ...providerOptions, // Spread any additional provider-specific options
  };
};

/**
 * Normalizes the non-streaming response from OpenAI to the standard AIResponse format.
 */
const normalizeOpenAIResponse = (
  openaiResponse: OpenAI.Chat.ChatCompletion,
): AIResponse => {
  const choice = openaiResponse.choices[0];
  return {
    id: openaiResponse.id,
    content: choice?.message?.content || '',
    model: openaiResponse.model,
    usage: {
      prompt_tokens: openaiResponse.usage?.prompt_tokens,
      completion_tokens: openaiResponse.usage?.completion_tokens,
      total_tokens: openaiResponse.usage?.total_tokens,
    },
    finish_reason: choice?.finish_reason,
    raw: openaiResponse, // Include the raw response
  };
};

/**
 * OpenAI provider client implementation.
 */
export const OpenAIChatClient: AIProviderClient = {
  chat: async (options: AIRequestOptions): Promise<ReadableStream | AIResponse> => {
    let openai: OpenAI;
    try {
      openai = createOpenAIClient();
      const requestPayload = buildOpenAIRequest(options);

      if (options.stream) {
        // Handle streaming response
        const response = await openai.chat.completions.create({
          ...requestPayload,
          stream: true, // Ensure stream is true for the API call
        });
        // Convert to Vercel AI SDK stream
        const stream = OpenAIStream(response as any); // Cast to any as workaround for type mismatch
        // Return a StreamingTextResponse (Next.js Edge compatible)
        // Note: In a real App Router handler, you'd return new StreamingTextResponse(stream);
        // Here, we return the stream directly as per the interface. The handler will wrap it.
        return stream; // The caller (e.g., API route) will wrap this in StreamingTextResponse
      } else {
        // Handle non-streaming response
        const response = await openai.chat.completions.create({
          ...requestPayload,
          stream: false, // Ensure stream is false
        });
        return normalizeOpenAIResponse(response);
      }
    } catch (error) {
      // Normalize and re-throw the error
      throw normalizeError(error, PROVIDER_NAME);
    }
  },
};

// Export the client
export default OpenAIChatClient;