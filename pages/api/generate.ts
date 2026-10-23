import { OpenAI } from 'openai-streams';
import {
  assertSentence,
  assertVibe,
  checkRateLimit,
  toErrorResponse,
} from '@/lib/api-guard';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI');
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const limited = checkRateLimit(req);
  if (limited) return limited;

  try {
    const body = await req.json();

    if (!body) {
      return new Response('No prompt in the request', { status: 400 });
    }
    const vibe = assertVibe(body.vibe);
    const sentence = assertSentence(body.sentence);

    const systemPrompt = `You're a grammar assistant that will correct grammar and generate 5 rephrased sentence in ${vibe} tone and in a totally correct grammar. You must not provide other text but only provide the rephrased sentence in points using "-". format and never use a numbered format. You will never ask and always rephrased sentences based on the text provided. Separate each number using "/\n/"`;

    const stream = await OpenAI(
      'chat',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Rephrase this sentence and Separate each sentence using "/\n/" "${sentence}"`,
          },
        ],
        max_tokens: 500,
      },
      {}
    );

    return new Response(stream);
  } catch (error) {
    return toErrorResponse(error, 'Generate API error:');
  }
}
