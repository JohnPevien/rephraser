type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'deepseek';

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIRequestOptions {
  provider: AIProvider;
  model: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface AIResponse {
  content: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface AIClient {
  chat(options: AIRequestOptions): Promise<AIResponse | ReadableStream>;
}

export type { AIProvider, AIMessage, AIRequestOptions, AIResponse, AIClient };
