import Anthropic from '@anthropic-ai/sdk';
import { getProviderConfig } from '../../config';
import { AIMessage, AIRequestOptions, AIResponse, AIStreamCallbacks } from '../../types/ai';
import { AIProviderError, normalizeError } from '../../utils/error';

export class ClaudeService {
  private client: Anthropic;

  constructor() {
    const config = getProviderConfig('claude');
    
    if (!config?.apiKey) {
      throw new AIProviderError({ message: 'API key not configured', provider: 'claude' });
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  // Convert our unified messages format to Claude-specific format
  private formatMessages(messages: AIMessage[]): any {
    let systemPrompt = '';
    const formattedMessages = [];

    // Extract system messages
    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt += message.content + '\n';
      } else {
        formattedMessages.push(message);
      }
    }

    return {
      systemPrompt: systemPrompt.trim(),
      messages: formattedMessages,
    };
  }

  // Calculate cost for Claude API calls
  private calculateCost(promptTokens: number, completionTokens: number, model: string): { 
    promptCost: number;
    completionCost: number;
    totalCost: number;
    currency: string;
  } {
    // Default rates for Claude (these rates should be updated as needed)
    let inputRate = 0;
    let outputRate = 0;
    
    // Set rates based on model
    if (model.includes('claude-3-opus')) {
      inputRate = 15.0; // $15.00 per 1M tokens
      outputRate = 75.0; // $75.00 per 1M tokens
    } else if (model.includes('claude-3-sonnet')) {
      inputRate = 3.0; // $3.00 per 1M tokens
      outputRate = 15.0; // $15.00 per 1M tokens
    } else if (model.includes('claude-3-haiku')) {
      inputRate = 0.25; // $0.25 per 1M tokens
      outputRate = 1.25; // $1.25 per 1M tokens
    } else if (model.includes('claude-2')) {
      inputRate = 8.0; // $8.00 per 1M tokens
      outputRate = 24.0; // $24.00 per 1M tokens
    }
    
    // Calculate costs (convert to dollars)
    const promptCost = (promptTokens / 1000000) * inputRate;
    const completionCost = (completionTokens / 1000000) * outputRate;
    
    return {
      promptCost,
      completionCost,
      totalCost: promptCost + completionCost,
      currency: 'USD',
    };
  }

  // Rough token estimation for Claude models (similar to OpenAI)
  async countTokens(text: string): Promise<number> {
    // Character count / 4 is a rough estimate
    return Math.ceil(text.length / 4);
  }

  async countMessageTokens(messages: AIMessage[]): Promise<number> {
    const { systemPrompt, messages: formattedMessages } = this.formatMessages(messages);
    let totalTokens = 0;

    if (systemPrompt) {
      totalTokens += await this.countTokens(systemPrompt);
    }

    for (const message of formattedMessages) {
      // Add tokens for message structure overhead (approximate)
      totalTokens += 4;
      totalTokens += await this.countTokens(message.content);
    }
    // Add final assistant prompt overhead
    totalTokens += 2;
    return totalTokens;
  }

  async estimateCost(options: AIRequestOptions): Promise<{
    minCost: number;
    maxCost: number;
    currency: string;
  }> {
    try {
      // Get token count for prompt
      const promptTokens = await this.countMessageTokens(options.messages);
      
      // Estimate max output tokens (if not specified)
      const maxOutputTokens = options.maxTokens || 1000;
      
      // Calculate with minimum and maximum expected output
      const minCost = this.calculateCost(promptTokens, 1, options.model);
      const maxCost = this.calculateCost(promptTokens, maxOutputTokens, options.model);
      
      return {
        minCost: minCost.totalCost,
        maxCost: maxCost.totalCost,
        currency: 'USD',
      };
    } catch (error) {
      throw normalizeError(error, 'claude');
    }
  }

  async generateText(options: AIRequestOptions): Promise<AIResponse> {
    try {
      // Apply safety settings if provided
      const safetySettings = options.safetySettings?.enabled 
        ? {
            // Claude-specific safety settings
            safety_filtering_level: options.safetySettings.blockUnsafeContent 
              ? 'medium' // or 'high' for stricter filtering
              : 'low',
          }
        : undefined;

      // Apply retry settings for rate limiting
      const maxRetries = options.retry?.attempts || 0;
      let retryCount = 0;
      let lastError: any;

      // Implement exponential backoff for retries
      const doRequest = async () => {
        try {
          const { systemPrompt, messages: formattedMessages } = this.formatMessages(options.messages);
          
          const lastUserMessage = formattedMessages
            .filter((m: AIMessage) => m.role === 'user') // Add type AIMessage
            .pop()?.content || '';
          
          const response = await this.client.messages.create({
            model: options.model,
            system: systemPrompt,
            messages: formattedMessages.map((m: AIMessage) => ({ // Add type AIMessage
              role: m.role,
              content: m.content,
            })),
            temperature: options.temperature,
            max_tokens: options.maxTokens ?? 4096, // Provide default if undefined
            // Add Claude-specific parameters
            ...safetySettings,
          });

          // Calculate cost if tracking is enabled
          let cost;
          if (options.trackCost) {
            cost = this.calculateCost(
              response.usage?.input_tokens || 0,
              response.usage?.output_tokens || 0,
              options.model
            );
          }

          return {
            content: response.content[0]?.text || '',
            usage: {
              promptTokens: response.usage?.input_tokens || 0,
              completionTokens: response.usage?.output_tokens || 0,
              totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            },
            model: response.model,
            provider: 'claude',
            cost,
            // Note: Anthropic SDK might throw specific errors for safety filtering
            // rather than using stop_reason === 'safety' in the main response.
            // The 'flagged' property might need adjustment based on error handling.
            flagged: undefined,
          };
        } catch (error) {
          // Check if error is due to rate limiting
          // Check if error is an object with status property before accessing
          const isRateLimit = typeof error === 'object' && error !== null && 'status' in error && error.status === 429;
          
          if (isRateLimit && retryCount < maxRetries) {
            retryCount++;
            const delay = Math.min(
              (options.retry?.initialDelay || 1000) * Math.pow(2, retryCount - 1),
              options.retry?.maxDelay || 32000
            );
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            return doRequest();
          }
          
          throw error;
        }
      };

      return await doRequest();
    } catch (error) {
      throw normalizeError(error, 'claude');
    }
  }

  async generateTextStream(
    options: AIRequestOptions,
    callbacks: AIStreamCallbacks
  ): Promise<void> {
    try {
      callbacks.onStart?.();

      // Apply safety settings if provided
      const safetySettings = options.safetySettings?.enabled 
        ? {
            // Claude-specific safety settings
            safety_filtering_level: options.safetySettings.blockUnsafeContent 
              ? 'medium' // or 'high' for stricter filtering
              : 'low',
          }
        : undefined;

      const { systemPrompt, messages: formattedMessages } = this.formatMessages(options.messages);
      
      const stream = await this.client.messages.create({
        model: options.model,
        system: systemPrompt,
        messages: formattedMessages.map((m: AIMessage) => ({ // Add type AIMessage
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens ?? 4096, // Provide default if undefined
        stream: true,
        ...safetySettings,
      });

      let contentAccumulator = '';
      // Calculate prompt tokens before starting stream
      const promptTokens = await this.countMessageTokens(options.messages);
      let completionTokens = 0;

      // Claude's stream is an async iterable of events
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const content = chunk.delta?.text || '';
          if (content) {
            contentAccumulator += content;
            callbacks.onToken?.(content);
          }
        }
        
        // Update token usage if available in the final message
        // input_tokens are not available in delta, only output_tokens
        if (chunk.type === 'message_delta' && chunk.usage) {
           completionTokens = chunk.usage.output_tokens || 0; // Update completion tokens from delta
        }

        // Check for safety flags in content blocks
        // Check for message stop event and safety reason
        if (chunk.type === 'message_stop') {
          const message = (chunk as any).message; // Cast to access nested message property
          if (message?.stop_reason === 'error' || message?.stop_reason?.includes('error')) { // Check if stop reason indicates an error (like safety)
             callbacks.onError?.(new AIProviderError({ message: `Stream stopped due to an error: ${message.stop_reason}`, provider: 'claude', details: message }));
             return; // Stop processing on error
          }
        }
      }

      // Calculate cost if tracking is enabled
      let cost;
      if (options.trackCost) {
        cost = this.calculateCost(
          promptTokens,
          completionTokens,
          options.model
        );
      }

      callbacks.onComplete?.({
        content: contentAccumulator,
        usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
        model: options.model,
        provider: 'claude',
        cost,
      });
    } catch (error) {
      callbacks.onError?.(normalizeError(error, 'claude'));
    }
  }
}
