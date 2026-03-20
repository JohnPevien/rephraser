// This test requires a test runner (e.g., Jest or Vitest) and its type definitions to be installed.
// Example: npm install --save-dev jest @types/jest ts-jest
// You also need to configure the test runner (e.g., jest.config.js).

import DeepSeekChatClient from './index';
import type { AIRequestOptions, AIResponse, ChatMessage } from '../../types/index'; // Correct import path
import { nanoid } from 'nanoid'; // Assuming nanoid is available or installable for unique IDs

const TEST_PROMPT = 'Hello, DeepSeek!';

describe('DeepSeek API', () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  it('should return a valid response for a simple chat prompt', async () => {
    if (!apiKey) {
      // Skip test if API key is not set
      console.warn('DEEPSEEK_API_KEY not set. Skipping DeepSeek API test.');
      return;
    }

    const options: AIRequestOptions = {
      model: 'deepseek-chat', // Use a valid DeepSeek model
      messages: [
        // ChatMessage requires an id
        { id: nanoid(), role: 'user', content: TEST_PROMPT }
      ],
      stream: false
    };

    const responseRaw = await DeepSeekChatClient.chat(options);

    // Defensive check: Ensure the response is not a stream and is an object
    if (typeof responseRaw !== 'object' || responseRaw === null || responseRaw instanceof ReadableStream) {
      throw new Error('DeepSeekChatClient.chat did not return a valid AIResponse object');
    }

    // Cast to the correct AIResponse type from index.ts
    const response = responseRaw as AIResponse;

    expect(response).toBeDefined();
    expect(typeof response.id).toBe('string'); // AIResponse from index.ts has id
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    expect(typeof response.model).toBe('string');
    expect(response.raw).toBeDefined(); // AIResponse from index.ts has raw

    // Check usage if present
    if (response.usage) {
      expect(typeof response.usage.prompt_tokens).toBe('number');
      expect(typeof response.usage.completion_tokens).toBe('number');
      expect(typeof response.usage.total_tokens).toBe('number');
    }
  });
});