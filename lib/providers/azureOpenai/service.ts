import OpenAI from 'openai';
import { getProviderConfig } from '../../config';
import { AIMessage, AIRequestOptions, AIResponse, AIStreamCallbacks } from '../../types/ai';
import { AIProviderError, normalizeError } from '../../utils/error';

export class AzureOpenAIService {
  private client: OpenAI;
  private apiVersion: string;

  constructor() {
    const config = getProviderConfig('azureOpenai');
    
    if (!config?.apiKey || !config?.endpoint) {
      throw new AIProviderError({
        message: !config?.apiKey ? 'API key not configured' : 'Azure endpoint not configured',
        provider: 'azureOpenai'
      });
    }

    // Azure OpenAI uses API key for apiKey
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
      defaultQuery: { 'api-version': config.apiVersion || '2023-12-01-preview' },
      defaultHeaders: { 'api-key': config.apiKey },
    });

    this.apiVersion = config.apiVersion || '2023-12-01-preview';
  }

  // Helper to extract deployment name from model identifier
  private getDeploymentName(model: string): string {
    // If model contains a slash, assume it's in format deploymentName/modelName
    if (model.includes('/')) {
      return model.split('/')[0];
    }
    // Otherwise use the model name as the deployment name
    return model;
  }

  // Calculate cost for Azure OpenAI API calls
  private calculateCost(promptTokens: number, completionTokens: number, model: string): { 
    promptCost: number;
    completionCost: number;
    totalCost: number;
    currency: string;
  } {
    // Default rates for Azure OpenAI (these may vary based on region and agreement)
    let inputRate = 0;
    let outputRate = 0;
    
    // Set rates based on model
    if (model.includes('gpt-4') && model.includes('turbo')) {
      inputRate = 10.0; // $10.00 per 1M tokens
      outputRate = 30.0; // $30.00 per 1M tokens
    } else if (model.includes('gpt-4-32k')) {
      inputRate = 60.0; // $60.00 per 1M tokens
      outputRate = 120.0; // $120.00 per 1M tokens
    } else if (model.includes('gpt-4')) {
      inputRate = 30.0; // $30.00 per 1M tokens
      outputRate = 60.0; // $60.00 per 1M tokens
    } else if (model.includes('gpt-3.5-turbo-16k')) {
      inputRate = 3.0; // $3.00 per 1M tokens
      outputRate = 4.0; // $4.00 per 1M tokens
    } else if (model.includes('gpt-3.5-turbo')) {
      inputRate = 1.5; // $1.50 per 1M tokens
      outputRate = 2.0; // $2.00 per 1M tokens
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

  // Token counting through the Azure OpenAI API
  async countTokens(text: string): Promise<number> {
    // Azure doesn't have a dedicated token counting endpoint
    // Use tiktoken (OpenAI's tokenizer) internally
    // This is an approximation only
    // Characters / 4 is a rough estimate
    return Math.ceil(text.length / 4);
  }

  async countMessageTokens(messages: AIMessage[]): Promise<number> {
    // Sum token counts for each message
    let total = 0;
    for (const message of messages) {
      const tokens = await this.countTokens(message.content);
      total += tokens;
    }
    // Add overhead for message formatting
    total += 4 * messages.length;
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
      throw normalizeError(error, 'azureOpenai');
    }
  }

  async generateText(options: AIRequestOptions): Promise<AIResponse> {
    try {
      // Apply retry settings for rate limiting
      const maxRetries = options.retry?.attempts || 0;
      let retryCount = 0;
      
      // Implement exponential backoff for retries
      const doRequest = async () => {
        try {
          const deploymentName = this.getDeploymentName(options.model);
          
          const response = await this.client.chat.completions.create({
            model: deploymentName, // Use 'model' for deployment name with Azure
            messages: options.messages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            temperature: options.temperature,
            max_tokens: options.maxTokens,
            // Azure OpenAI specific content filters
            ...(options.safetySettings?.enabled && {
              content_filter: {
                hate: options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
                'hate/threatening': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
                'self-harm': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
                sexual: options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
                'sexual/minors': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
                violence: options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
                'violence/graphic': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
              }
            }),
          });

          // Calculate cost if tracking is enabled
          let cost;
          if (options.trackCost) {
            cost = this.calculateCost(
              response.usage?.prompt_tokens || 0,
              response.usage?.completion_tokens || 0,
              options.model
            );
          }

          // Check for content filter results
          // Access content filter results safely (structure might vary)
          const promptFilterResults = (response as any).prompt_filter_results?.[0]?.content_filter_results;
          const choiceFilterResults = (response.choices[0] as any)?.content_filter_results; // Use 'any' cast for now
          
          const isFlagged = (promptFilterResults && Object.values(promptFilterResults).some((r: any) => r.filtered || r.severity === 'high')) ||
                            (choiceFilterResults && Object.values(choiceFilterResults).some((r: any) => r.filtered || r.severity === 'high'));
          
          const flaggedCategories = [
            ...(promptFilterResults ? Object.entries(promptFilterResults).filter(([_, v]: [string, any]) => v.filtered || v.severity === 'high').map(([k]) => `prompt:${k}`) : []),
            ...(choiceFilterResults ? Object.entries(choiceFilterResults).filter(([_, v]: [string, any]) => v.filtered || v.severity === 'high').map(([k]) => `choice:${k}`) : [])
          ];

          return {
            content: response.choices[0]?.message?.content || '',
            usage: {
              promptTokens: response.usage?.prompt_tokens || 0,
              completionTokens: response.usage?.completion_tokens || 0,
              totalTokens: response.usage?.total_tokens || 0,
            },
            model: options.model, // Azure doesn't return model info in the same way
            provider: 'azureOpenai',
            cost,
            // Add safety flags if available
            flagged: isFlagged
              ? { 
                  isFlagged: true,
                  categories: flaggedCategories,
                }
              : undefined,
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
      throw normalizeError(error, 'azureOpenai');
    }
  }

  async generateTextStream(
    options: AIRequestOptions,
    callbacks: AIStreamCallbacks
  ): Promise<void> {
    try {
      callbacks.onStart?.();

      const deploymentName = this.getDeploymentName(options.model);
      
      const stream = await this.client.chat.completions.create({
        model: deploymentName, // Use 'model' for deployment name with Azure
        messages: options.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
        // Azure OpenAI specific content filters
        ...(options.safetySettings?.enabled && {
          content_filter: {
            hate: options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
            'hate/threatening': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
            'self-harm': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
            sexual: options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
            'sexual/minors': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
            violence: options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
            'violence/graphic': options.safetySettings.blockUnsafeContent ? 'high' : 'medium',
          }
        }),
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

      // Calculate cost if tracking is enabled
      let cost;
      if (options.trackCost) {
        cost = this.calculateCost(
          usage.promptTokens,
          usage.completionTokens,
          options.model
        );
      }

      callbacks.onComplete?.({
        content: contentAccumulator,
        usage,
        model: options.model,
        provider: 'azureOpenai',
        cost,
      });
    } catch (error) {
      callbacks.onError?.(normalizeError(error, 'azureOpenai'));
    }
  }
}
