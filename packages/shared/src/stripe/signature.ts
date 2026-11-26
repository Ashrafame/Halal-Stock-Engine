/**
 * Stripe webhook signature verification (v1 scheme), implemented with Web
 * Crypto so it runs unchanged in Supabase Edge Functions (Deno), Node and the
 * browser. Never trust a webhook body before `valid === true`.
 *
 * https://docs.stripe.com/webhooks/signature
 */

export type StripeSignatureFailure =
  | 'missing_header'
  | 'malformed_header'
  | 'missing_timestamp'
  | 'timestamp_out_of_tolerance'
  | 'missing_signature'
  | 'signature_mismatch';

export interface StripeSignatureResult {
  valid: boolean;
  reason?: StripeSignatureFailure;
  timestamp?: number;
}

export interface VerifyStripeSignatureInput {
  payload: string;
  header: string | null | undefined;
  secret: string;
  toleranceSeconds?: number;
  /** Injectable clock for deterministic tests. */
  nowSeconds?: number;
}

function toHex(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) output += byte.toString(16).padStart(2, '0');
  return output;
}

/** Length-independent, byte-wise comparison to avoid timing side channels. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function computeStripeSignature(
  payload: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  return toHex(new Uint8Array(signature));
}

export async function verifyStripeSignature(
  input: VerifyStripeSignatureInput,
): Promise<StripeSignatureResult> {
  if (!input.header) return { valid: false, reason: 'missing_header' };

  const parts = input.header.split(',');
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 't') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) {
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === null) return { valid: false, reason: 'missing_timestamp' };
  if (signatures.length === 0) return { valid: false, reason: 'missing_signature' };

  const tolerance = input.toleranceSeconds ?? 300;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp_out_of_tolerance', timestamp };
  }

  if (!input.secret) return { valid: false, reason: 'signature_mismatch', timestamp };

  const expected = await computeStripeSignature(input.payload, input.secret, timestamp);
  const matched = signatures.some((candidate) => timingSafeEqualHex(candidate, expected));

  return matched
    ? { valid: true, timestamp }
    : { valid: false, reason: 'signature_mismatch', timestamp };
}
