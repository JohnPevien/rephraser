import {
  AIProvider,
  AIClient,
  AIRequestOptions,
  AIResponse,
} from '../../utils/types';
import { config } from '../../utils/config';
import { OpenAIChatClient } from './openai';
import { AnthropicChatClient } from './anthropic';
import { GeminiService } from './gemini/service';
import { GroqService } from './groq/service';
import { OpenRouterService } from './openrouter/service';
import { DeepSeekChatClient } from './deepseek';

/**
 * Adapter to convert service-based implementations to match the AIClient interface
 */
class ServiceAdapter implements AIClient {
  constructor(private service: any) {}

  async chat(options: AIRequestOptions): Promise<ReadableStream | AIResponse> {
    if (options.stream) {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      this.service.generateTextStream(options, {
        onToken: async (token: string) => {
          await writer.write(new TextEncoder().encode(token));
        },
        onComplete: async () => {
          await writer.close();
        },
        onError: async (error: Error) => {
          await writer.abort(error);
        },
      });

      return stream.readable;
    }

    return this.service.generateText(options);
  }
}

/**
 * Creates an AI provider client based on the specified provider.
 * Validates provider configuration before creating the client.
 */
export function createAIClient(provider: AIProvider): AIClient {
  switch (provider) {
    case 'openai':
      if (!config.openai?.apiKey)
        throw new Error('OpenAI configuration not found');
      return OpenAIChatClient;

    case 'anthropic':
      if (!config.anthropic?.apiKey)
        throw new Error('Anthropic configuration not found');
      return AnthropicChatClient;

    case 'gemini':
      if (!config.gemini?.apiKey)
        throw new Error('Gemini configuration not found');
      return new ServiceAdapter(new GeminiService());

    case 'groq':
      if (!config.groq?.apiKey) throw new Error('Groq configuration not found');
      return new ServiceAdapter(new GroqService());

    case 'openrouter':
      if (!config.openrouter?.apiKey)
        throw new Error('OpenRouter configuration not found');
      return new ServiceAdapter(new OpenRouterService());

    case 'deepseek':
      if (!config.deepseek?.apiKey)
        throw new Error('DeepSeek configuration not found');
      return DeepSeekChatClient;

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
