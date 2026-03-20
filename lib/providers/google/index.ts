import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerateContentRequest,
  Content,
  Part, // Ensure Part is imported
} from '@google/generative-ai';
import { GoogleGenerativeAIStream, StreamingTextResponse } from 'ai';
import {
  AIProviderClient,
  AIRequestOptions,
  AIResponse,
  ChatMessage,
} from '../../types';
import { normalizeError, AIProviderError } from '../../utils/error';

// Constants for configuration
const PROVIDER_NAME = 'google';
const DEFAULT_MODEL = 'gemini-pro'; // Or gemini-1.5-pro-latest

// Safety settings - adjust as needed
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/**
 * Creates an instance of the Google Generative AI client.
 * Reads configuration from environment variables.
 */
const createGoogleClient = (): GoogleGenerativeAI => {
  const apiKey = process.env.GOOGLE_API_KEY;
  // Optional: endpoint configuration if needed, though usually handled by SDK
  // const apiEndpoint = process.env.GOOGLE_API_ENDPOINT;

  if (!apiKey) {
    throw new AIProviderError({
      message: 'Google API key (GOOGLE_API_KEY) is not configured.',
      provider: PROVIDER_NAME,
    });
  }

  // Pass API key directly to the constructor
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Maps standard ChatMessage array to Google's Content array format.
 * Google requires specific alternation of 'user' and 'model' roles.
 * It also handles 'system' prompts differently (often not directly supported in older models' chat history).
 */
const buildGoogleMessages = (messages: ChatMessage[]): Content[] => {
  // TODO: Handle system prompts appropriately for Gemini.
  // Gemini's `generateContent` might take system instructions separately or expect them
  // implicitly. For chat, it expects alternating user/model roles.
  // This basic mapping assumes alternating roles are provided correctly.
  // More robust handling might be needed to insert 'model' placeholders if needed.

  return messages
    // Filter out system messages for now, handle separately if model supports it
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user', // Map 'assistant' to 'model'
      parts: [{ text: msg.content }],
    }));
};


/**
 * Maps AIRequestOptions to Google's GenerateContentRequest.
 */
const buildGoogleRequest = (
  options: AIRequestOptions,
): GenerateContentRequest => {
  const { messages, temperature, max_tokens, top_p, providerOptions } = options;

  const generationConfig = {
    // Map standard options to Google's config
    // Note: Google uses 'maxOutputTokens', not 'max_tokens'
    maxOutputTokens: max_tokens,
    temperature: temperature,
    topP: top_p,
    // topK: providerOptions?.topK, // Example of provider-specific option
    // stopSequences: providerOptions?.stopSequences,
    ...providerOptions?.generationConfig, // Allow overriding via providerOptions
  };

  // Remove undefined values from generationConfig
  Object.keys(generationConfig).forEach(key =>
    (generationConfig as any)[key] === undefined && delete (generationConfig as any)[key]
  );


  return {
    contents: buildGoogleMessages(messages),
    safetySettings: safetySettings, // Apply safety settings
    generationConfig: generationConfig,
    // systemInstruction: providerOptions?.systemInstruction // Handle system instruction if provided
    ...providerOptions?.requestParams, // Allow overriding other request params
  };
};

/**
 * Normalizes the non-streaming response from Google Gemini to the standard AIResponse format.
 */
const normalizeGoogleResponse = (
  googleResponse: Awaited<ReturnType<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>>,
  modelUsed: string,
): AIResponse => {
  const response = googleResponse.response;
  const candidate = response.candidates?.[0];
  // Explicitly type the 'part' parameter here
  const content = candidate?.content?.parts?.map((part: Part) => part.text).join('') || '';
  // Note: Google's token counting might be different or unavailable in some responses.
  const usage = {
    // prompt_tokens: response.usageMetadata?.promptTokenCount,
    // completion_tokens: response.usageMetadata?.candidatesTokenCount,
    // total_tokens: response.usageMetadata?.totalTokenCount,
  };

  return {
    // Google doesn't provide a simple ID like OpenAI/Anthropic in this structure
    id: `google-${Date.now()}`, // Generate a temporary ID
    content: content,
    model: modelUsed,
    usage: usage,
    finish_reason: candidate?.finishReason || undefined,
    raw: response, // Include the raw response part
  };
};


/**
 * Google Gemini provider client implementation.
 */
export const GoogleChatClient: AIProviderClient = {
  chat: async (options: AIRequestOptions): Promise<ReadableStream | AIResponse> => {
    let client: GoogleGenerativeAI;
    const modelName = options.model || DEFAULT_MODEL;
    try {
      client = createGoogleClient();
      const model = client.getGenerativeModel({ model: modelName });
      const requestPayload = buildGoogleRequest(options);

      if (options.stream) {
        // Handle streaming response
        const response = await model.generateContentStream(requestPayload);
        // Convert to Vercel AI SDK stream
        const stream = GoogleGenerativeAIStream(response);
        // Return the stream directly
        return stream; // The caller (e.g., API route) will wrap this in StreamingTextResponse
      } else {
        // Handle non-streaming response
        const response = await model.generateContent(requestPayload);
        return normalizeGoogleResponse(response, modelName);
      }
    } catch (error) {
      // Normalize and re-throw the error
      throw normalizeError(error, PROVIDER_NAME);
    }
  },
};

// Export the client
export default GoogleChatClient;