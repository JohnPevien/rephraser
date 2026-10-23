// Shared guard for the paid-LLM API routes: per-IP rate limit plus input
// validation. Buckets live in memory, so they are per server instance.
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_BUCKETS_BEFORE_SWEEP = 10_000;

export const MAX_SENTENCE_CHARS = 500;

// Tones offered by components/ToneSelector.tsx ('casual' is the page default).
const ALLOWED_VIBES: Record<string, true> = {
  professional: true,
  conversational: true,
  humorous: true,
  empathic: true,
  academic: true,
  simple: true,
  creative: true,
  casual: true,
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export class ValidationError extends Error {}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

/** 429 response when the caller IP is over budget, else null. */
export function checkRateLimit(req: Request): Response | null {
  const now = Date.now();
  const ip = clientIp(req);
  if (buckets.size > MAX_BUCKETS_BEFORE_SWEEP) {
    buckets.forEach((bucket, key) => {
      if (now >= bucket.resetAt) buckets.delete(key);
    });
  }
  const bucket = buckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return new Response('Too many requests, please try again later', {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    });
  }
  return null;
}

/** Throw ValidationError unless the sentence is a non-empty string within the cap. */
export function assertSentence(sentence: unknown): string {
  if (typeof sentence !== 'string' || !sentence.trim()) {
    throw new ValidationError('No sentence in the request');
  }
  if (sentence.length > MAX_SENTENCE_CHARS) {
    throw new ValidationError(`Sentence must be at most ${MAX_SENTENCE_CHARS} characters`);
  }
  return sentence.trim();
}

/** Throw ValidationError unless the vibe is one the UI offers. */
export function assertVibe(vibe: unknown): string {
  if (typeof vibe !== 'string' || ALLOWED_VIBES[vibe.toLowerCase()] !== true) {
    throw new ValidationError('Invalid vibe');
  }
  return vibe;
}
/**
 * Map a caught handler error to a safe client response: 400 for client
 * mistakes, generic 500 for upstream failures (logged server-side).
 */
export function toErrorResponse(error: unknown, logPrefix: string): Response {
  if (error instanceof ValidationError) {
    return new Response(error.message, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return new Response('Invalid request body', { status: 400 });
  }
  console.error(logPrefix, error);
  return new Response('Internal server error', { status: 500 });
}
