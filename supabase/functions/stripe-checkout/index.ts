import { z } from 'zod';

import { requireUser } from '../_shared/auth.ts';
import {
  assertMethod,
  errorResponse,
  handleOptions,
  HttpError,
  json,
  readJson,
  requireEnv,
} from '../_shared/http.ts';
import { adminClient, enforceRateLimit, writeAudit } from '../_shared/supabase.ts';
import { stripeRequest } from '../_shared/stripe.ts';

const bodySchema = z.strictObject({
  planId: z.string().trim().min(1).max(64),
  interval: z.enum(['month', 'year']).default('month'),
  successUrl: z.url().max(2048),
  cancelUrl: z.url().max(2048),
});

interface PlanRow {
  id: string;
  tier: string;
  trial_days: number;
  price_monthly_cents: number;
  price_yearly_cents: number;
  stripe_price_monthly_id: string | null;
  stripe_price_yearly_id: string | null;
  is_active: boolean;
}

function allowedOrigins(): Set<string> {
  const values = [requireEnv('APP_URL')];
  const extra = Deno.env.get('ALLOWED_ORIGINS');
  if (extra) values.push(...extra.split(',').map((origin) => origin.trim()));
  const origins = new Set<string>();
  for (const value of values) {
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore malformed configuration; APP_URL is validated below.
    }
  }
  return origins;
}

function assertRedirect(url: string, allowed: Set<string>): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, 'invalid_redirect');
  }
  if (!allowed.has(parsed.origin)) throw new HttpError(400, 'invalid_redirect');
}

function withSessionId(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    assertMethod(req, ['POST']);
    const user = await requireUser(req);
    const parsed = bodySchema.safeParse(await readJson(req, 8_192));
    if (!parsed.success) throw new HttpError(400, 'invalid_payload');

    const { planId, interval, successUrl, cancelUrl } = parsed.data;
    const origins = allowedOrigins();
    assertRedirect(successUrl, origins);
    assertRedirect(cancelUrl, origins);

    await enforceRateLimit({ key: `checkout:${user.id}`, limit: 10, windowSeconds: 3_600 });

    const admin = adminClient();
    const { data: plan, error: planError } = await admin
      .from('plans')
      .select(
        'id, tier, trial_days, price_monthly_cents, price_yearly_cents, stripe_price_monthly_id, stripe_price_yearly_id, is_active',
      )
      .eq('id', planId)
      .eq('is_active', true)
      .maybeSingle<PlanRow>();

    if (planError) throw new HttpError(500, 'plan_lookup_failed');
    if (!plan) throw new HttpError(404, 'plan_not_found');
    if (plan.tier === 'free' || plan.price_monthly_cents === 0) {
      throw new HttpError(400, 'free_plan_needs_no_checkout');
    }

    const priceId =
      interval === 'year' ? plan.stripe_price_yearly_id : plan.stripe_price_monthly_id;
    if (!priceId) throw new HttpError(503, 'stripe_price_not_configured');

    const { data: profile } = await admin
      .from('profiles')
      .select('email, stripe_customer_id, locale')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) throw new HttpError(403, 'forbidden');

    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>('/customers', {
        method: 'POST',
        body: {
          email: (profile.email as string | null) ?? user.email ?? '',
          'metadata[user_id]': user.id,
        },
        idempotencyKey: `customer-create-${user.id}`,
      });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const { data: existingSubscription } = await admin
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    const body: Record<string, string> = {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: withSessionId(successUrl),
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      allow_promotion_codes: 'true',
      billing_address_collection: 'auto',
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan_id]': plan.id,
      locale: 'auto',
    };

    // Trial only for first-time subscribers.
    if (plan.trial_days > 0 && !existingSubscription) {
      body['subscription_data[trial_period_days]'] = String(plan.trial_days);
    }

    const session = await stripeRequest<{ id: string; url: string | null }>(
      '/checkout/sessions',
      {
        method: 'POST',
        body,
        idempotencyKey: `checkout-${user.id}-${plan.id}-${interval}-${Date.now()}`,
      },
    );

    if (!session.url) throw new HttpError(502, 'stripe_session_missing_url');

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'billing.checkout_created',
      entityType: 'subscription',
      entityId: session.id,
      after: { planId, interval },
    });

    return json(req, { url: session.url });
  } catch (error) {
    return errorResponse(req, error);
  }
});
