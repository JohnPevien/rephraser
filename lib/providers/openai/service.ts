import OpenAI from 'openai';
import { getProviderConfig } from '../../config';
import { AIMessage, AIRequestOptions, AIResponse, AIStreamCallbacks } from '../../types/ai';
import { AIProviderError, normalizeError } from '../../utils/error';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    const config = getProviderConfig('openai');
    
    if (!config?.apiKey) {
      throw new AIProviderError({ message: 'API key not configured', provider: 'openai' });
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async generateText(options: AIRequestOptions): Promise<AIResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        provider: 'openai',
      };
    } catch (error) {
      throw normalizeError(error, 'openai');
    }
  }

  async generateTextStream(
    options: AIRequestOptions,
    callbacks: AIStreamCallbacks
  ): Promise<void> {
    try {
      callbacks.onStart?.();

      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
      });

      let contentAccumulator = '';
      let usage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          contentAccumulator += content;
          callbacks.onToken?.(content);
        }
        
        // Update token usage if available
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
          };
        }
      }

      callbacks.onComplete?.({
        content: contentAccumulator,
        usage,
        model: options.model,
        provider: 'openai',
      });
    } catch (error) {
      callbacks.onError?.(normalizeError(error, 'openai'));
    }
  }
}
