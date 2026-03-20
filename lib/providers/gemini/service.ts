import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { getProviderConfig } from '../../config';
import { AIMessage, AIRequestOptions, AIResponse, AIStreamCallbacks } from '../../types/ai';
import { AIProviderError, normalizeError } from '../../utils/error';

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const config = getProviderConfig('gemini');
    
    if (!config?.apiKey) {
      throw new AIProviderError({ message: 'API key not configured', provider: 'gemini' });
    }

    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  private formatMessages(messages: AIMessage[]) {
    // Gemini doesn't support system messages directly, so we need to handle them
    // by prepending them to the first user message
    let systemContent = '';
    const formattedMessages = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemContent += message.content + '\n';
      } else {
        formattedMessages.push(message);
      }
    }

    // If we have system content and user messages, prepend to first user message
    if (systemContent && formattedMessages.length > 0) {
      const firstUserIndex = formattedMessages.findIndex(m => m.role === 'user');
      if (firstUserIndex >= 0) {
        formattedMessages[firstUserIndex] = {
          ...formattedMessages[firstUserIndex],
          content: systemContent + '\n' + formattedMessages[firstUserIndex].content
        };
      }
    }

    return formattedMessages;
  }

  private createChatHistory(messages: AIMessage[]) {
    const formattedMessages = this.formatMessages(messages);
    const history = [];
    
    for (const message of formattedMessages) {
      if (message.role === 'user') {
        history.push({ role: 'user', parts: [{ text: message.content }] });
      } else if (message.role === 'assistant') {
        history.push({ role: 'model', parts: [{ text: message.content }] });
      }
    }
    
    return history;
  }

  async generateText(options: AIRequestOptions): Promise<AIResponse> {
    try {
      const model = this.genAI.getGenerativeModel({ model: options.model });
      const chat = model.startChat({
        history: this.createChatHistory(options.messages.slice(0, -1)),
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
        },
      });

      const lastMessage = options.messages[options.messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      const text = response.text();

      return {
        content: text,
        usage: {
          promptTokens: 0, // Gemini doesn't provide token usage
          completionTokens: 0,
          totalTokens: 0,
        },
        model: options.model,
        provider: 'gemini',
      };
    } catch (error) {
      throw normalizeError(error, 'gemini');
    }
  }

  async generateTextStream(
    options: AIRequestOptions,
    callbacks: AIStreamCallbacks
  ): Promise<void> {
    try {
      callbacks.onStart?.();

      const model = this.genAI.getGenerativeModel({ model: options.model });
      const chat = model.startChat({
        history: this.createChatHistory(options.messages.slice(0, -1)),
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
        },
      });

      const lastMessage = options.messages[options.messages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.content);

      let contentAccumulator = '';

      for await (const chunk of result.stream) {
        const content = chunk.text();
        contentAccumulator += content;
        callbacks.onToken?.(content);
      }

      callbacks.onComplete?.({
        content: contentAccumulator,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        model: options.model,
        provider: 'gemini',
      });
    } catch (error) {
      callbacks.onError?.(normalizeError(error, 'gemini'));
    }
  }
}
