/** Shared environment + HTTP helpers for Supabase Edge Functions (Deno). */

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, 'missing_env', `${name} is not configured`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name);
  return value && value.trim() !== '' ? value : undefined;
}

function allowedOrigins(): string[] {
  const configured = optionalEnv('ALLOWED_ORIGINS')?.split(',').map((item) => item.trim());
  const appUrl = optionalEnv('APP_URL');
  const defaults = ['http://localhost:3000', 'http://localhost:8081'];
  return [...new Set([...(configured ?? []), ...(appUrl ? [appUrl] : []), ...defaults])].filter(
    Boolean,
  );
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

export function assertMethod(req: Request, methods: string[]): void {
  if (!methods.includes(req.method)) {
    throw new HttpError(405, 'method_not_allowed');
  }
}

export async function readJson(req: Request, maxBytes = 32_768): Promise<unknown> {
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > maxBytes) throw new HttpError(413, 'payload_too_large');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'payload_too_large');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function errorResponse(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    return json(req, { error: error.code }, error.status);
  }
  console.error('[edge] unhandled error', error);
  return json(req, { error: 'internal_error' }, 500);
}

/** Length-independent string comparison for shared secrets. */
export function constantTimeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export function parsePositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}
