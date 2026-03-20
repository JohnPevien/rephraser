import { getProviderConfig } from '../../config';
import { AIMessage, AIRequestOptions, AIResponse, AIStreamCallbacks } from '../../types/ai';
import { AIProviderError, normalizeError } from '../../utils/error';

// Basic interface for expected Hugging Face response structure
interface HuggingFaceResponse {
  generated_text?: string;
  filtered?: boolean;
  filter_reasons?: string[];
  error?: string; // For error responses
}

export class HuggingFaceService {
  private apiKey: string;
  private defaultEndpoint: string;

  constructor() {
    const config = getProviderConfig('huggingface');
    
    if (!config?.apiKey) {
      throw new AIProviderError({ message: 'API key not configured', provider: 'huggingface' });
    }

    this.apiKey = config.apiKey;
    this.defaultEndpoint = config.defaultEndpoint || 'https://api-inference.huggingface.co/models';
  }

  // Calculate cost for Hugging Face API calls (note: Hugging Face has various pricing models)
  // This is a simplified version based on the Inference API pricing
  private calculateCost(promptTokens: number, completionTokens: number, model: string): { 
    promptCost: number;
    completionCost: number;
    totalCost: number;
    currency: string;
  } {
    // Default rates for Hugging Face Inference API
    // These are approximations and may vary based on model and usage tier
    let rate = 0;
    
    // Set rates based on model size (approximate)
    if (model.includes('llama') && model.includes('70b')) {
      rate = 8.0; // $8.00 per 1M tokens (approximation)
    } else if (model.includes('llama') && model.includes('13b')) {
      rate = 2.0; // $2.00 per 1M tokens (approximation)
    } else if (model.includes('mistral') && model.includes('7b')) {
      rate = 1.0; // $1.00 per 1M tokens (approximation)
    } else {
      // Default rate for smaller models
      rate = 0.5; // $0.50 per 1M tokens (approximation)
    }
    
    // Calculate costs (convert to dollars)
    // Hugging Face typically charges based on total tokens
    const totalTokens = promptTokens + completionTokens;
    const totalCost = (totalTokens / 1000000) * rate;
    
    return {
      promptCost: (promptTokens / 1000000) * rate, // Approximate split
      completionCost: (completionTokens / 1000000) * rate, // Approximate split
      totalCost,
      currency: 'USD',
    };
  }

  // Roughly estimate tokens for Hugging Face models
  async countTokens(text: string): Promise<number> {
    // Most Hugging Face models use a BPE-based tokenizer
    // Character count / 4 is a rough estimate
    return Math.ceil(text.length / 4);
  }

  async countMessageTokens(messages: AIMessage[]): Promise<number> {
    let total = 0;
    for (const message of messages) {
      total += await this.countTokens(message.content);
    }
    // Add some overhead for message formatting
    total += messages.length * 4;
    return total;
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
      throw normalizeError(error, 'huggingface');
    }
  }

  // Convert our messages format to Hugging Face input format
  private formatMessages(messages: AIMessage[]): string {
    // Different Hugging Face models expect different formats
    // This is a simplified version that works for many models
    let formattedPrompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        formattedPrompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        formattedPrompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        formattedPrompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    // Add final user prompt indicator if the last message was from a user
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      formattedPrompt += 'Assistant: ';
    }
    
    return formattedPrompt;
  }

  async generateText(options: AIRequestOptions): Promise<AIResponse> {
    try {
      // Apply retry settings for rate limiting
      const maxRetries = options.retry?.attempts || 0;
      let retryCount = 0;
      
      // Convert the model option to a Hugging Face model ID if it doesn't include a slash
      const modelId = options.model.includes('/') ? options.model : `huggingface/${options.model}`;
      
      // Get API endpoint URL
      const apiUrl = `${this.defaultEndpoint}/${modelId}`;
      
      // Format messages for Hugging Face
      const prompt = this.formatMessages(options.messages);
      
      // Estimate input tokens (for cost tracking)
      const inputTokenCount = await this.countTokens(prompt);
      
      // Implement exponential backoff for retries
      const doRequest = async () => {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                temperature: options.temperature,
                max_new_tokens: options.maxTokens,
                return_full_text: false,
                // Add safety if enabled
                ...(options.safetySettings?.enabled && {
                  safety_settings: {
                    filter_profanity: options.safetySettings.filterProfanity,
                    filter_blocked_words: options.safetySettings.filterSensitiveContent,
                  }
                }),
              },
            }),
          });
          
          if (!response.ok) {
            // Assuming error response structure { error: string }
            const errorData = await response.json().catch(() => ({})) as { error?: string };
            throw {
              status: response.status,
              message: errorData?.error || `Hugging Face API returned ${response.status}`,
              response: errorData,
            };
          }
          
          const result = await response.json() as HuggingFaceResponse;
          
          // Extract the generated text
          // The response format can vary between models
          let generatedText = '';
          
          if (Array.isArray(result)) {
            // Some endpoints return an array of generation results
            const firstResult = result[0] as HuggingFaceResponse | string | undefined;
            if (typeof firstResult === 'object' && firstResult?.generated_text) {
              generatedText = firstResult.generated_text;
            } else if (typeof firstResult === 'string') {
              generatedText = firstResult;
            }
          } else if (result?.generated_text) {
            // Some endpoints return an object with the generated text
            generatedText = result.generated_text;
          } else if (typeof result === 'string') {
            // Some endpoints return the text directly
            generatedText = result;
          }
          
          // Estimate output tokens (for cost tracking)
          const outputTokenCount = await this.countTokens(generatedText);
          
          // Calculate cost if tracking is enabled
          let cost;
          if (options.trackCost) {
            cost = this.calculateCost(
              inputTokenCount,
              outputTokenCount,
              options.model
            );
          }

          // Check for filtered content
          const isFlagged = result?.filtered ?? false;

          return {
            content: generatedText,
            usage: {
              promptTokens: inputTokenCount,
              completionTokens: outputTokenCount,
              totalTokens: inputTokenCount + outputTokenCount,
            },
            model: options.model,
            provider: 'huggingface',
            cost,
            flagged: isFlagged
              ? { 
                  isFlagged: true,
                  categories: result?.filter_reasons ?? ['unknown'],
                }
              : undefined,
          };
        } catch (error: unknown) { // Add type annotation
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
      throw normalizeError(error, 'huggingface');
    }
  }

  // Hugging Face doesn't natively support streaming, but we can implement a basic version
  async generateTextStream(
    options: AIRequestOptions,
    callbacks: AIStreamCallbacks
  ): Promise<void> {
    try {
      callbacks.onStart?.();

      // Get the full response
      const response = await this.generateText(options);
      
      // Simulate streaming by sending chunks of the content
      const content = response.content;
      const chunkSize = 10; // Characters per chunk
      
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        callbacks.onToken?.(chunk);
        
        // Add a small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      callbacks.onComplete?.(response);
    } catch (error) {
      callbacks.onError?.(normalizeError(error, 'huggingface'));
    }
  }
}
