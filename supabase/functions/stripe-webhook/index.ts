import type { SupabaseClient } from '@supabase/supabase-js';

import {
  normalizeSubscription,
  stripeRequest,
  verifyStripeSignature,
  type StripeEvent,
  type StripeSubscriptionObject,
} from '../_shared/stripe.ts';
import {
  errorResponse,
  handleOptions,
  HttpError,
  json,
  requireEnv,
} from '../_shared/http.ts';
import { adminClient, logError, writeAudit } from '../_shared/supabase.ts';

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
]);

async function planExists(admin: SupabaseClient, planId: string): Promise<boolean> {
  const { data } = await admin.from('plans').select('id').eq('id', planId).maybeSingle();
  return Boolean(data);
}

async function planByPriceId(
  admin: SupabaseClient,
  priceId: string | null,
): Promise<string | null> {
  if (!priceId) return null;
  const { data } = await admin
    .from('plans')
    .select('id')
    .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_yearly_id.eq.${priceId}`)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveUserId(
  admin: SupabaseClient,
  candidate: string | null | undefined,
  customerId: string | null,
): Promise<string | null> {
  if (candidate) return candidate;
  if (customerId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (profile?.id) return profile.id as string;

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (subscription?.user_id) return subscription.user_id as string;
  }
  return null;
}

async function syncSubscription(
  admin: SupabaseClient,
  subscription: StripeSubscriptionObject,
  fallbackUserId?: string | null,
): Promise<void> {
  const normalized = normalizeSubscription(subscription);
  const userId = await resolveUserId(
    admin,
    subscription.metadata?.user_id ?? fallbackUserId,
    normalized.stripeCustomerId,
  );
  if (!userId) throw new HttpError(400, 'subscription_without_user');

  let planId = normalized.planId;
  if (!planId || !(await planExists(admin, planId))) {
    planId = await planByPriceId(admin, normalized.stripePriceId);
  }
  if (!planId) throw new HttpError(400, 'subscription_without_plan');

  const row = {
    user_id: userId,
    plan_id: planId,
    stripe_customer_id: normalized.stripeCustomerId,
    stripe_subscription_id: normalized.stripeSubscriptionId,
    status: normalized.status,
    billing_interval: normalized.interval,
    current_period_start: normalized.currentPeriodStart,
    current_period_end: normalized.currentPeriodEnd,
    cancel_at_period_end: normalized.cancelAtPeriodEnd,
    trial_end: normalized.trialEnd,
    canceled_at: normalized.status === 'canceled' ? new Date().toISOString() : null,
  };

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from('subscriptions').update(row).eq('id', existing.id);
    if (error) throw new HttpError(500, 'subscription_update_failed', error.message);
  } else {
    const { error } = await admin.from('subscriptions').insert(row);
    if (error) throw new HttpError(500, 'subscription_insert_failed', error.message);
  }

  await admin.from('profiles').update({ stripe_customer_id: normalized.stripeCustomerId }).eq('id', userId);

  await writeAudit({
    actorId: null,
    actorEmail: 'stripe-webhook',
    action: 'stripe.subscription_synced',
    entityType: 'subscription',
    entityId: normalized.stripeSubscriptionId,
    after: { userId, planId, status: normalized.status, interval: normalized.interval },
  });
}

async function notifyUser(
  admin: SupabaseClient,
  userId: string,
  titleKey: string,
  body: string,
): Promise<void> {
  await admin.from('notifications').insert({
    user_id: userId,
    type: 'billing',
    title_key: titleKey,
    body,
    data: {},
  });
}

async function handleEvent(admin: SupabaseClient, event: StripeEvent): Promise<boolean> {
  if (!HANDLED.has(event.type)) return false;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        mode?: string;
        subscription?: string | null;
        customer?: string | null;
        client_reference_id?: string | null;
        metadata?: Record<string, string> | null;
      };
      if (session.mode !== 'subscription' || !session.subscription) return false;

      const subscription = await stripeRequest<StripeSubscriptionObject>(
        `/subscriptions/${session.subscription}`,
      );
      await syncSubscription(
        admin,
        {
          ...subscription,
          metadata: { ...(subscription.metadata ?? {}), ...(session.metadata ?? {}) },
        },
        session.client_reference_id ?? session.metadata?.user_id,
      );
      return true;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(admin, event.data.object as unknown as StripeSubscriptionObject);
      return true;
    }

    case 'customer.subscription.trial_will_end': {
      const subscription = event.data.object as unknown as StripeSubscriptionObject;
      const userId = await resolveUserId(admin, subscription.metadata?.user_id, subscription.customer);
      if (userId) {
        await notifyUser(
          admin,
          userId,
          'settings.billing',
          'Your Pro trial ends in 3 days. Manage billing to keep real-time data and technical alerts.',
        );
      }
      return true;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as { subscription?: string | null };
      if (!invoice.subscription) return true;
      const subscription = await stripeRequest<StripeSubscriptionObject>(
        `/subscriptions/${invoice.subscription}`,
      );
      await syncSubscription(admin, subscription);
      return true;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as {
        subscription?: string | null;
        hosted_invoice_url?: string | null;
      };
      if (!invoice.subscription) return true;

      const { data: row } = await admin
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', invoice.subscription)
        .maybeSingle();

      await admin
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_subscription_id', invoice.subscription);

      if (row?.user_id) {
        await notifyUser(
          admin,
          row.user_id as string,
          'settings.manageBilling',
          'Your latest payment failed. Update your card to keep Pro features active.',
        );
      }
      return true;
    }

    default:
      return false;
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  try {
    const rawBody = await req.text();
    if (rawBody.length > 512_000) return json(req, { error: 'payload_too_large' }, 413);

    const signature = req.headers.get('stripe-signature');
    const valid = await verifyStripeSignature(
      rawBody,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );
    if (!valid) return json(req, { error: 'invalid_signature' }, 400);

    let event: StripeEvent;
    try {
      event = JSON.parse(rawBody) as StripeEvent;
    } catch {
      return json(req, { error: 'invalid_json' }, 400);
    }
    if (!event?.id || !event?.type) return json(req, { error: 'invalid_event' }, 400);

    const admin = adminClient();

    // Idempotency: Stripe retries aggressively; the PK is the event id.
    const { error: insertError } = await admin
      .from('stripe_events')
      .insert({ id: event.id, type: event.type, payload: event, status: 'received' });

    if (insertError && insertError.code !== '23505') {
      throw new HttpError(500, 'event_persist_failed', insertError.message);
    }

    if (insertError?.code === '23505') {
      const { data: existing } = await admin
        .from('stripe_events')
        .select('status')
        .eq('id', event.id)
        .maybeSingle();
      if (existing?.status === 'processed' || existing?.status === 'ignored') {
        return json(req, { received: true, duplicate: true });
      }
    }

    try {
      const handled = await handleEvent(admin, event);
      await admin
        .from('stripe_events')
        .update({
          status: handled ? 'processed' : 'ignored',
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id);
      return json(req, { received: true, handled });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      await admin
        .from('stripe_events')
        .update({ status: 'failed', error: message.slice(0, 500) })
        .eq('id', event.id);
      await logError({
        message: 'stripe_webhook_failed',
        stack: error instanceof Error ? error.stack : undefined,
        context: { eventId: event.id, type: event.type },
      });
      // 500 lets Stripe retry with exponential backoff.
      return json(req, { error: 'processing_failed' }, 500);
    }
  } catch (error) {
    return errorResponse(req, error);
  }
});
