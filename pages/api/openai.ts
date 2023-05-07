import { OpenAIStream, OpenAIStreamPayload } from '@/utils/OpenAIStream';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI');
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'POST') {
    const body = await req.json();
    const vibe = body.vibe;
    const sentence = body.sentence;

    const systemPrompt = `generate 3 ${vibe} rephrased sentences based on this sentence 
    "${sentence}" and label the results clearly as 1., 2., and 3. You must always provide 3 sentences no matter what the sentence is.`;

    if (!body) {
      return new Response('No prompt in the request', { status: 400 });
    }

    const payload: OpenAIStreamPayload = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.8,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: 500,
      stream: true,
      n: 1,
    };

    const stream = await OpenAIStream(payload);
    return new Response(stream);
  }

  return new Response('Method not allowed', { status: 405 });
}
