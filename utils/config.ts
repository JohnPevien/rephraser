interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

interface AIConfig {
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  gemini?: ProviderConfig;
  deepseek?: ProviderConfig;
  groq?: ProviderConfig;
  openrouter?: ProviderConfig;
}

export const config: AIConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    baseUrl: process.env.OPENAI_BASE_URL,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
  },
  gemini: {
    apiKey: process.env.GOOGLE_API_KEY!,
    baseUrl: process.env.GOOGLE_API_ENDPOINT,
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseUrl: process.env.DEEPSEEK_BASE_URL,
  },
  // Add other providers as needed
};

export type { ProviderConfig, AIConfig };
