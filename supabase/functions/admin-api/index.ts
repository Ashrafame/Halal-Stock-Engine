import { z } from 'zod';

import { requireAdmin } from '../_shared/auth.ts';
import {
  assertMethod,
  errorResponse,
  handleOptions,
  HttpError,
  json,
  optionalEnv,
  parsePositiveInt,
  readJson,
} from '../_shared/http.ts';
import {
  adminClient,
  clientIp,
  enforceRateLimit,
  logError,
  writeAudit,
} from '../_shared/supabase.ts';
import { stripeRequest } from '../_shared/stripe.ts';

const locale = z.enum(['en', 'ar', 'es']);
const role = z.enum(['user', 'support', 'admin', 'owner']);
const status = z.enum(['active', 'suspended', 'pending', 'deleted']);
const tier = z.enum(['free', 'pro', 'enterprise']);
const complianceStatus = z.enum(['halal', 'questionable', 'haram', 'unknown']);

const planLimits = z.object({
  maxAlerts: z.number().int().min(-1),
  maxWatchlistItems: z.number().int().min(-1),
  maxPortfolios: z.number().int().min(-1),
  maxHoldingsPerPortfolio: z.number().int().min(-1),
  apiRequestsPerDay: z.number().int().min(-1),
  alertCooldownMinutes: z.number().int().min(1).max(10_080),
});

const planFeatures = z.object({
  realtimeQuotes: z.boolean(),
  technicalAlerts: z.boolean(),
  emailAlerts: z.boolean(),
  pushAlerts: z.boolean(),
  portfolioTracking: z.boolean(),
  complianceReports: z.boolean(),
  exportData: z.boolean(),
  prioritySupport: z.boolean(),
});

const planInput = z.object({
  id: z.string().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*$/),
  tier,
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  priceMonthlyCents: z.number().int().min(0),
  priceYearlyCents: z.number().int().min(0),
  currency: z.string().length(3),
  trialDays: z.number().int().min(0).max(365),
  limits: planLimits,
  features: planFeatures,
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
  syncStripe: z.boolean().default(false),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_user'),
    userId: z.uuid(),
    role: role.optional(),
    status: status.optional(),
    locale: locale.optional(),
    planId: z.string().min(1).max(64).optional(),
    suspendReason: z.string().max(500).optional(),
  }),  z.object({ action: z.literal('save_plan'), plan: planInput }),
  z.object({
    action: z.literal('set_stock_override'),
    stockId: z.uuid(),
    status: complianceStatus,
    score: z.number().min(0).max(100).optional(),
    reason: z.string().min(10).max(500),
    expiresAt: z.iso.datetime().optional(),
  }),
  z.object({ action: z.literal('clear_stock_override'), stockId: z.uuid() }),
  z.object({
    action: z.literal('upsert_translation'),
    locale,
    namespace: z.string().min(1).max(64),
    key: z.string().min(1).max(200).regex(/^[A-Za-z0-9_.-]+$/),
    value: z.string().min(1).max(5000),
  }),
  z.object({
    action: z.literal('upsert_variable'),
    key: z.string().min(2).max(100).regex(/^[A-Z][A-Z0-9_]*$/),
    value: z.unknown(),
    description: z.string().max(500).default(''),
    category: z.string().min(1).max(64).default('general'),
    isPublic: z.boolean().default(false),
  }),
  z.object({ action: z.literal('delete_variable'), key: z.string().min(2).max(100) }),
  z.object({
    action: z.literal('broadcast'),
    titleKey: z.string().min(1).max(120),
    body: z.string().min(1).max(1000),
    audience: z.enum(['all', 'free', 'pro', 'enterprise']).default('all'),
  }),
]);

type UpdateUserAction = Extract<z.infer<typeof actionSchema>, { action: 'update_user' }>;

interface PlanRow {
  id: string;
  tier: string;
  name: string;
  description: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  currency: string;
  trial_days: number;
  limits: unknown;
  features: unknown;
  stripe_product_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_yearly_id: string | null;
  is_active: boolean;
  sort_order: number;
}

async function syncPricesToStripe(plan: {
  id: string;
  name: string;
  description: string;
  currency: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  stripeProductId: string | null;
  stripePriceMonthlyId: string | null;
  stripePriceYearlyId: string | null;
}): Promise<{ productId: string; monthlyPriceId: string | null; yearlyPriceId: string | null }> {
  let productId = plan.stripeProductId;
  if (!productId) {
    const product = await stripeRequest<{ id: string }>('/products', {
      method: 'POST',
      body: {
        name: plan.name,
        description: plan.description,
        'metadata[plan_id]': plan.id,
      },
    });
    productId = product.id;
  } else {
    await stripeRequest(`/products/${productId}`, {
      method: 'POST',
      body: { name: plan.name, description: plan.description },
    });
  }

  const createPrice = async (
    interval: 'month' | 'year',
    amount: number,
    existing: string | null,
  ): Promise<string | null> => {
    if (amount <= 0) return null;
    const price = await stripeRequest<{ id: string }>('/prices', {
      method: 'POST',
      body: {
        product: productId as string,
        currency: plan.currency.toLowerCase(),
        unit_amount: String(amount),
        'recurring[interval]': interval,
        nickname: `${plan.name} ${interval}ly`,
        'metadata[plan_id]': plan.id,
      },
    });
    if (existing) {
      try {
        await stripeRequest(`/prices/${existing}`, {
          method: 'POST',
          body: { active: 'false' },
        });
      } catch (error) {
        console.error('[admin-api] failed to archive old price', error);
      }
    }
    return price.id;
  };

  const monthlyPriceId = await createPrice(
    'month',
    plan.priceMonthlyCents,
    plan.stripePriceMonthlyId,
  );
  const yearlyPriceId = await createPrice('year', plan.priceYearlyCents, plan.stripePriceYearlyId);

  return { productId, monthlyPriceId, yearlyPriceId };
}

async function countOwners(): Promise<number> {
  const admin = adminClient();
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'owner');
  return count ?? 0;
}

async function updateUser(
  admin: ReturnType<typeof adminClient>,
  actor: { id: string; email: string | null },
  input: UpdateUserAction,
  request: Request,
): Promise<Response> {
  const { data: target, error } = await admin
    .from('profiles')
    .select('id, email, role, status, locale')
    .eq('id', input.userId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'user_lookup_failed');
  if (!target) throw new HttpError(404, 'user_not_found');

  if (input.userId === actor.id && input.status === 'suspended') {
    throw new HttpError(400, 'cannot_suspend_self');
  }
  if (
    target.role === 'owner' &&
    input.role !== undefined &&
    input.role !== 'owner' &&
    (await countOwners()) <= 1
  ) {
    throw new HttpError(400, 'cannot_remove_last_owner');
  }

  const patch = {
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.locale !== undefined ? { locale: input.locale } : {}),
    ...(input.status === 'suspended' ? { suspended_reason: input.suspendReason ?? null } : {}),
    ...(input.status === 'active' ? { suspended_reason: null } : {}),
  };
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'no_changes');

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', input.userId)
    .select('id, email, role, status, locale')
    .single();
  if (updateError) throw new HttpError(500, 'user_update_failed');

  if (input.planId) {
    const { data: plan } = await admin
      .from('plans')
      .select('id, tier, stripe_price_monthly_id, stripe_price_yearly_id')
      .eq('id', input.planId)
      .maybeSingle();
    if (!plan) throw new HttpError(404, 'plan_not_found');

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id, billing_interval, plan_id')
      .eq('user_id', input.userId)
      .maybeSingle();

    if (subscription && subscription.plan_id !== plan.id) {
      if (!optionalEnv('STRIPE_SECRET_KEY')) {
        throw new HttpError(503, 'stripe_not_configured');
      }
      if (plan.tier === 'free') {
        await stripeRequest(`/subscriptions/${subscription.stripe_subscription_id}`, {
          method: 'POST',
          body: { cancel_at_period_end: 'true' },
        });
        await admin
          .from('subscriptions')
          .update({ cancel_at_period_end: true })
          .eq('user_id', input.userId);
      } else {
        const priceId =
          subscription.billing_interval === 'year'
            ? plan.stripe_price_yearly_id
            : plan.stripe_price_monthly_id;
        if (!priceId) throw new HttpError(400, 'plan_price_not_configured');
        await stripeRequest(`/subscriptions/${subscription.stripe_subscription_id}`, {
          method: 'POST',
          body: {
            'items[0][price]': priceId,
            proration_behavior: 'create_prorations',
            'metadata[plan_id]': plan.id,
          },
        });
        await admin
          .from('subscriptions')
          .update({ plan_id: plan.id })
          .eq('user_id', input.userId);
      }
    } else if (!subscription && plan.tier !== 'free') {
      // Paid access must originate from Stripe Checkout, never a local toggle.
      throw new HttpError(400, 'no_subscription_to_change');
    }
  }

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'user.updated',
    entityType: 'profile',
    entityId: input.userId,
    before: target,
    after: updated,
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  return json(request, { ok: true, user: updated });
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    assertMethod(req, ['GET', 'POST', 'PATCH']);
    const actor = await requireAdmin(req);
    await enforceRateLimit({ key: `admin:${actor.id}`, limit: 120, windowSeconds: 60 });

    const admin = adminClient();
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const resource = url.searchParams.get('resource') ?? 'metrics';

      if (resource === 'metrics') {
        const { data, error } = await admin
          .from('v_admin_metrics')
          .select('metrics')
          .single();
        if (error) throw new HttpError(500, 'metrics_failed');
        return json(req, data?.metrics ?? {});
      }

      if (resource === 'users') {
        const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000);
        const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), 25, 100);
        const search = (url.searchParams.get('search') ?? '').replace(/[%,()]/g, '').slice(0, 120);
        let query = admin
          .from('v_admin_users')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);
        if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
        const { data, error, count } = await query;
        if (error) throw new HttpError(500, 'users_failed');
        return json(req, { users: data ?? [], total: count ?? 0, page, pageSize });
      }

      if (resource === 'audit') {
        const { data, error } = await admin
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw new HttpError(500, 'audit_failed');
        return json(req, { entries: data ?? [] });
      }

      if (resource === 'plans') {
        const { data, error } = await admin.from('plans').select('*').order('sort_order');
        if (error) throw new HttpError(500, 'plans_failed');
        return json(req, { plans: data ?? [] });
      }

      if (resource === 'variables') {
        const { data, error } = await admin
          .from('system_variables')
          .select('*')
          .order('category')
          .order('key');
        if (error) throw new HttpError(500, 'variables_failed');
        return json(req, { variables: data ?? [] });
      }

      if (resource === 'errors') {
        const { data, error } = await admin
          .from('app_errors')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw new HttpError(500, 'errors_failed');
        return json(req, { errors: data ?? [] });
      }

      throw new HttpError(400, 'unknown_resource');
    }

    const parsed = actionSchema.safeParse(await readJson(req, 64_000));
    if (!parsed.success) throw new HttpError(400, 'invalid_payload');
    const action = parsed.data;

    switch (action.action) {
      case 'update_user':
        return await updateUser(admin, actor, action, req);

      case 'save_plan': {
        const plan = action.plan;
        const { data: existing } = await admin
          .from('plans')
          .select('*')
          .eq('id', plan.id)
          .maybeSingle<PlanRow>();

        const row = {
          id: plan.id,
          tier: plan.tier,
          name: plan.name,
          description: plan.description,
          price_monthly_cents: plan.priceMonthlyCents,
          price_yearly_cents: plan.priceYearlyCents,
          currency: plan.currency.toUpperCase(),
          trial_days: plan.trialDays,
          limits: plan.limits,
          features: plan.features,
          is_active: plan.isActive,
          sort_order: plan.sortOrder,
        };

        const { error } = await admin.from('plans').upsert(row, { onConflict: 'id' });
        if (error) {
          if (error.code === '23505') throw new HttpError(409, 'tier_already_exists');
          throw new HttpError(500, 'plan_save_failed', error.message);
        }

        let warning: string | null = null;
        if (plan.syncStripe && plan.tier !== 'free') {
          if (!optionalEnv('STRIPE_SECRET_KEY')) {
            warning = 'stripe_not_configured';
          } else {
            try {
              const synced = await syncPricesToStripe({
                id: plan.id,
                name: plan.name,
                description: plan.description,
                currency: plan.currency,
                priceMonthlyCents: plan.priceMonthlyCents,
                priceYearlyCents: plan.priceYearlyCents,
                stripeProductId: existing?.stripe_product_id ?? null,
                stripePriceMonthlyId: existing?.stripe_price_monthly_id ?? null,
                stripePriceYearlyId: existing?.stripe_price_yearly_id ?? null,
              });
              await admin
                .from('plans')
                .update({
                  stripe_product_id: synced.productId,
                  stripe_price_monthly_id: synced.monthlyPriceId,
                  stripe_price_yearly_id: synced.yearlyPriceId,
                })
                .eq('id', plan.id);
            } catch (stripeError) {
              warning = 'stripe_sync_failed';
              await logError({
                message: 'plan_stripe_sync_failed',
                context: { planId: plan.id },
                stack: stripeError instanceof Error ? stripeError.stack : undefined,
              });
            }
          }
        }

        await writeAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: existing ? 'plan.updated' : 'plan.created',
          entityType: 'plan',
          entityId: plan.id,
          before: existing,
          after: row,
          ip: clientIp(req),
          userAgent: req.headers.get('user-agent'),
        });

        return json(req, { ok: true, warning });
      }

      case 'set_stock_override': {
        const { data: stock } = await admin
          .from('stocks')
          .select('id, symbol, compliance_status')
          .eq('id', action.stockId)
          .maybeSingle();
        if (!stock) throw new HttpError(404, 'stock_not_found');

        const { error: reportError } = await admin.from('compliance_reports').insert({
          stock_id: action.stockId,
          provider: 'manual',
          status: action.status,
          score: action.score ?? null,
          reasons: [action.reason],
          reviewed_by: actor.id,
          effective_at: new Date().toISOString(),
          expires_at: action.expiresAt ?? null,
        });
        if (reportError) throw new HttpError(500, 'override_failed', reportError.message);

        await admin
          .from('stocks')
          .update({
            compliance_override: action.status,
            override_reason: action.reason,
            override_expires_at: action.expiresAt ?? null,
          })
          .eq('id', action.stockId);

        await writeAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'stock.compliance_override',
          entityType: 'stock',
          entityId: action.stockId,
          before: { status: stock.compliance_status },
          after: { status: action.status, reason: action.reason, expiresAt: action.expiresAt },
          ip: clientIp(req),
          userAgent: req.headers.get('user-agent'),
        });

        return json(req, { ok: true });
      }

      case 'clear_stock_override': {
        await admin
          .from('stocks')
          .update({
            compliance_override: null,
            override_reason: null,
            override_expires_at: null,
          })
          .eq('id', action.stockId);

        await writeAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'stock.compliance_override_cleared',
          entityType: 'stock',
          entityId: action.stockId,
          ip: clientIp(req),
          userAgent: req.headers.get('user-agent'),
        });
        return json(req, { ok: true });
      }

      case 'upsert_translation': {
        const { error } = await admin.from('translations').upsert(
          {
            locale: action.locale,
            namespace: action.namespace,
            key: action.key,
            value: action.value,
            updated_by: actor.id,
          },
          { onConflict: 'locale,namespace,key' },
        );
        if (error) throw new HttpError(500, 'translation_save_failed');
        await writeAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'translation.upserted',
          entityType: 'translation',
          entityId: `${action.locale}:${action.namespace}.${action.key}`,
          after: { value: action.value },
          ip: clientIp(req),
          userAgent: req.headers.get('user-agent'),
        });
        return json(req, { ok: true });
      }

      case 'upsert_variable': {
        const { error } = await admin.from('system_variables').upsert(
          {
            key: action.key,
            value: action.value,
            description: action.description,
            category: action.category,
            is_public: action.isPublic,
            updated_by: actor.id,
          },
          { onConflict: 'key' },
        );
        if (error) throw new HttpError(500, 'variable_save_failed');
        await writeAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'system_variable.upserted',
          entityType: 'system_variable',
          entityId: action.key,
          after: { value: action.value, isPublic: action.isPublic },
          ip: clientIp(req),
          userAgent: req.headers.get('user-agent'),
        });
        return json(req, { ok: true });
      }

      case 'delete_variable': {
        const { error } = await admin.from('system_variables').delete().eq('key', action.key);
        if (error) throw new HttpError(500, 'variable_delete_failed');
        await writeAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'system_variable.deleted',
          entityType: 'system_variable',
          entityId: action.key,
          ip: clientIp(req),
          userAgent: req.headers.get('user-agent'),
        });
        return json(req, { ok: true });
      }

      case 'broadcast': {
        let userIds: string[] = [];
        if (action.audience === 'all') {
          const { data } = await admin
            .from('profiles')
            .select('id')
            .eq('status', 'active')
            .limit(5_000);
          userIds = (data ?? []).map((row) => row.id as string);
        } else {
          const { data } = await admin
            .from('subscriptions')
            .select('user_id, plans!inner(tier), profiles!inner(status)')
            .eq('status', 'active')
            .eq('plans.tier', action.audience)
            .limit(5_000);
          userIds = (data ?? [])
            .filter((row) => (row.profiles as { status?: string } | null)?.status === 'active')
            .map((row) => row.user_id as string);
        }

        for (let index = 0; index < userIds.length; index += 500) {
          const batch = userIds.slice(index, index + 500);
          if (batch.length === 0) continue;
          await admin.from('notifications').insert(
            batch.map((userId) => ({
              user_id: userId,
              type: 'broadcast',
              title_key: action.titleKey,
              body: action.body,
              data: {},
            })),
          );
        }

        await writeAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'notification.broadcast',
          entityType: 'notification',
          entityId: null,
          after: { audience: action.audience, recipients: userIds.length },
          ip: clientIp(req),
          userAgent: req.headers.get('user-agent'),
        });

        return json(req, { ok: true, recipients: userIds.length });
      }

      default:
        throw new HttpError(400, 'unknown_action');
    }
  } catch (error) {
    return errorResponse(req, error);
  }
});
