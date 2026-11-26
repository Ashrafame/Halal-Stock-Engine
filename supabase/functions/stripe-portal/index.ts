import { requireUser } from '../_shared/auth.ts';
import {
  assertMethod,
  errorResponse,
  handleOptions,
  HttpError,
  json,
  requireEnv,
} from '../_shared/http.ts';
import { adminClient, enforceRateLimit } from '../_shared/supabase.ts';
import { stripeRequest } from '../_shared/stripe.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    assertMethod(req, ['POST']);
    const user = await requireUser(req);
    await enforceRateLimit({ key: `portal:${user.id}`, limit: 10, windowSeconds: 3_600 });

    const admin = adminClient();
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!subscription?.stripe_customer_id) {
      throw new HttpError(404, 'no_billing_account');
    }

    const appUrl = requireEnv('APP_URL');
    const portal = await stripeRequest<{ url: string }>('/billing_portal/sessions', {
      method: 'POST',
      body: {
        customer: subscription.stripe_customer_id as string,
        return_url: `${appUrl.replace(/\/$/, '')}/settings`,
      },
    });

    return json(req, { url: portal.url });
  } catch (error) {
    return errorResponse(req, error);
  }
});
