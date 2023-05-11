import { OpenAI } from 'openai-streams';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI');
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'POST') {
    const body = await req.json();

    if (!body) {
      return new Response('No prompt in the request', { status: 400 });
    }
    const vibe = body.vibe;
    const sentence = body.sentence;

    const systemPrompt = `You are a helpful assistant that will generate 3 rephrased sentence in ${vibe} tone`;

    console.log(vibe);
    console.log(sentence);
    console.log(systemPrompt);

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
            content: `${sentence}`,
          },
        ],
        max_tokens: 500,
      },
      {
        apiKey: process.env.OPENAI_API_KEY,
        mode: 'tokens',
      }
    );

    return new Response(stream);
  }

  return new Response('Method not allowed', { status: 405 });
}
