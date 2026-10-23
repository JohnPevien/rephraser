import { OpenAI } from 'openai-streams';
import {
  assertSentence,
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
    const sentence = assertSentence(body.sentence);

    const systemPrompt = `You are a very strict grammar checker. You will check the English grammar and it should be perfectly correct and grammar and you will give 1 suggestion on how to possibly fix it. The format will be
    grammarcheck: (true or false)
    then
    suggestedsentence: (the suggested sentence)
    `;

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
            content: `Check this "${sentence}"`,
          },
        ],
        max_tokens: 200,
      },
      {}
    );

    return new Response(stream);
  } catch (error) {
    return toErrorResponse(error, 'Checkgrammar API error:');
  }
}
