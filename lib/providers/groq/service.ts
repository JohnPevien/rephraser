import Groq from 'groq-sdk';
import { getProviderConfig } from '../../config';
import { AIRequestOptions, AIResponse, AIStreamCallbacks } from '../../types/ai';
import { AIProviderError, normalizeError } from '../../utils/error';

export class GroqService {
  private client: Groq;

  constructor() {
    const config = getProviderConfig('groq');
    
    if (!config?.apiKey) {
      throw new AIProviderError({ message: 'API key not configured', provider: 'groq' });
    }

    this.client = new Groq({
      apiKey: config.apiKey,
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
        provider: 'groq',
      };
    } catch (error) {
      throw normalizeError(error, 'groq');
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
        
        // Update token usage if available in final chunk
        // Usage data is typically not available in delta chunks for OpenAI-compatible APIs
        // It usually arrives in a final non-delta chunk or needs to be calculated separately.
        // Removing attempt to access chunk.usage here.
        // End of chunk processing
      }

      callbacks.onComplete?.({
        content: contentAccumulator,
        usage,
        model: options.model,
        provider: 'groq',
      });
    } catch (error) {
      callbacks.onError?.(normalizeError(error, 'groq'));
    }
  }
}
