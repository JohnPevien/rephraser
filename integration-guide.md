# Direct Integration Guide

This guide explains how to integrate the AI API client functionality directly into your project without using it as a package.

## Required Dependencies

Install these dependencies based on which providers you plan to use:

```bash
# Core dependencies
npm install zod                 # For runtime type validation

# Provider-specific SDKs
npm install openai              # For OpenAI integration
npm install @anthropic-ai/sdk   # For Anthropic/Claude integration
npm install @google/generative-ai # For Google Gemini integration
npm install groq-sdk           # For Groq integration
npm install ai                 # For utility functions and streaming support
```

## Core Components to Copy

### 1. Type Definitions

Create a `types.ts` file with these core types:

```typescript
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
```

### 2. Provider-Specific Configuration

Create a `config.ts` file:

```typescript
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
```

### 3. Provider-Specific Clients

Create separate files for each provider you want to support. Example structure:

```
lib/
  providers/
    openai.ts
    anthropic.ts
    gemini.ts
    groq.ts
    openrouter.ts
    deepseek.ts
```

### 4. Error Handling

Create an `errors.ts` file for normalized error handling:

```typescript
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}
```

## Environment Setup

1. Create a `.env` file with your API keys and optional configurations:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional

# Anthropic Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # Optional

# Google Gemini Configuration
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_API_ENDPOINT=...  # Optional, usually handled by SDK

# DeepSeek Configuration
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1  # Optional

# Add other provider configurations as needed
```

2. Create client factory:

```typescript
function createAIClient(provider: AIProvider) {
  switch (provider) {
    case 'openai':
      return new OpenAIClient(config.openai);
    case 'anthropic':
      return new AnthropicClient(config.anthropic);
    case 'gemini':
      return new GeminiClient(config.gemini);
    case 'deepseek':
      return new DeepSeekClient(config.deepseek);
    // Add other providers as needed
  }
}
```

## Usage Example

```typescript
async function main() {
  try {
    const client = createAIClient('openai');
    const response = await client.chat({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: false,
    });
    console.log(response.content);
  } catch (error) {
    console.error('Error:', normalizeError(error));
  }
}
```

## Streaming Support

For streaming responses:

```typescript
async function streamExample() {
  const client = createAIClient('openai');
  const stream = await client.chat({
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Write a story.' }],
    stream: true,
  });

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    process.stdout.write(chunk);
  }
}
```

## Benefits of Direct Integration

1. **Customization**: Full control over the implementation
2. **Dependency Reduction**: No extra package dependencies
3. **Size Optimization**: Include only the providers you need
4. **Direct Updates**: Easier to modify and maintain your own copy
5. **Base URL Configuration**: Support for custom API endpoints and proxies
