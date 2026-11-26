import { z } from 'zod';

/**
 * Single source of truth for input validation across web server actions, Edge
 * Functions and mobile forms. Every external boundary must parse its input.
 */

export const localeSchema = z.enum(['en', 'ar', 'es']);
export const planTierSchema = z.enum(['free', 'pro', 'enterprise']);
export const billingIntervalSchema = z.enum(['month', 'year']);
export const userRoleSchema = z.enum(['user', 'support', 'admin', 'owner']);
export const userStatusSchema = z.enum(['active', 'suspended', 'pending', 'deleted']);
export const complianceStatusSchema = z.enum(['halal', 'questionable', 'haram', 'unknown']);
export const alertTypeSchema = z.enum(['price', 'indicator', 'compliance']);
export const alertOperatorSchema = z.enum(['above', 'below', 'crosses_above', 'crosses_below']);
export const indicatorSchema = z.enum([
  'rsi_14',
  'sma_20',
  'sma_50',
  'sma_200',
  'macd',
  'volume_spike',
]);

export const emailSchema = z.email().max(254);
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(80).optional(),
  locale: localeSchema.default('en'),
  acceptedTerms: z.literal(true),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const alertInputSchema = z
  .object({
    stockId: z.uuid(),
    alertType: alertTypeSchema.default('price'),
    operator: alertOperatorSchema.default('above'),
    targetPrice: z.number().positive().max(10_000_000).optional(),
    indicator: indicatorSchema.optional(),
    threshold: z.number().min(0).max(10_000_000).optional(),
    cooldownMinutes: z.number().int().min(1).max(10_080).optional(),
    notifyEmail: z.boolean().default(true),
    notifyPush: z.boolean().default(true),
    expiresAt: z.iso.datetime().optional(),
  })
  .superRefine((value, context) => {
    if (value.alertType === 'price' && value.targetPrice === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['targetPrice'],
        message: 'A price alert requires a target price',
      });
    }
    if (value.alertType === 'indicator' && value.indicator === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['indicator'],
        message: 'An indicator alert requires an indicator',
      });
    }
    if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now()) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Expiry must be in the future',
      });
    }
  });

/** Payload for the dashboard "Create alert" one-click button. */
export const oneClickAlertSchema = z.object({
  stockId: z.uuid(),
  targetPrice: z.number().positive().max(10_000_000).optional(),
  operator: alertOperatorSchema.default('above'),
});

export const portfolioInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  baseCurrency: z.string().trim().length(3).toUpperCase().default('USD'),
  isSimulated: z.boolean().default(true),
});

export const holdingInputSchema = z.object({
  portfolioId: z.uuid(),
  stockId: z.uuid(),
  shares: z.number().positive().max(1_000_000_000),
  averageCost: z.number().min(0).max(10_000_000),
});

export const transactionInputSchema = z.object({
  portfolioId: z.uuid(),
  stockId: z.uuid(),
  type: z.enum(['buy', 'sell', 'dividend', 'fee']),
  shares: z.number().min(0).max(1_000_000_000),
  price: z.number().min(0).max(10_000_000),
  fees: z.number().min(0).max(1_000_000).default(0),
  executedAt: z.iso.datetime(),
  notes: z.string().max(500).optional(),
});

const httpUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Only http(s) URLs are allowed');

export const checkoutRequestSchema = z.object({
  planId: z.string().trim().min(1).max(64),
  interval: billingIntervalSchema.default('month'),
  successUrl: httpUrlSchema,
  cancelUrl: httpUrlSchema,
});

export const planLimitsSchema = z.object({
  maxAlerts: z.number().int().min(-1).max(1_000_000),
  maxWatchlistItems: z.number().int().min(-1).max(1_000_000),
  maxPortfolios: z.number().int().min(-1).max(1_000_000),
  maxHoldingsPerPortfolio: z.number().int().min(-1).max(1_000_000),
  apiRequestsPerDay: z.number().int().min(-1).max(100_000_000),
  alertCooldownMinutes: z.number().int().min(1).max(10_080),
});

export const planFeaturesSchema = z.object({
  realtimeQuotes: z.boolean(),
  technicalAlerts: z.boolean(),
  emailAlerts: z.boolean(),
  pushAlerts: z.boolean(),
  portfolioTracking: z.boolean(),
  complianceReports: z.boolean(),
  exportData: z.boolean(),
  prioritySupport: z.boolean(),
});

export const adminPlanSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes'),
  tier: planTierSchema,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(300),
  priceMonthlyCents: z.number().int().min(0).max(10_000_000),
  priceYearlyCents: z.number().int().min(0).max(100_000_000),
  currency: z.string().trim().length(3).toUpperCase(),
  trialDays: z.number().int().min(0).max(365),
  limits: planLimitsSchema,
  features: planFeaturesSchema,
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  syncStripe: z.boolean().default(false),
});

export const adminUserUpdateSchema = z
  .object({
    userId: z.uuid(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    locale: localeSchema.optional(),
    planId: z.string().trim().min(1).max(64).optional(),
    suspendReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (value) =>
      value.role !== undefined ||
      value.status !== undefined ||
      value.locale !== undefined ||
      value.planId !== undefined,
    { message: 'No changes supplied' },
  );

export const translationUpsertSchema = z.object({
  locale: localeSchema,
  namespace: z.string().trim().min(1).max(64),
  key: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid translation key'),
  value: z.string().trim().min(1).max(5000),
});

export const systemVariableSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Use UPPER_SNAKE_CASE'),
  value: z.unknown(),
  description: z.string().trim().max(500).default(''),
  category: z.string().trim().min(1).max(64).default('general'),
  isPublic: z.boolean().default(false),
});

export const stockComplianceOverrideSchema = z.object({
  stockId: z.uuid(),
  status: complianceStatusSchema,
  score: z.number().min(0).max(100).optional(),
  reason: z.string().trim().min(10).max(500),
  expiresAt: z.iso.datetime().optional(),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  audience: z.enum(['all', 'free', 'pro', 'enterprise']).default('all'),
  locale: localeSchema.optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AlertInput = z.infer<typeof alertInputSchema>;
export type OneClickAlertInput = z.infer<typeof oneClickAlertSchema>;
export type HoldingInput = z.infer<typeof holdingInputSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type AdminPlanInput = z.infer<typeof adminPlanSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
export type TranslationUpsertInput = z.infer<typeof translationUpsertSchema>;
export type SystemVariableInput = z.infer<typeof systemVariableSchema>;
export type StockComplianceOverrideInput = z.infer<typeof stockComplianceOverrideSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;

/** Flatten a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.') || '_form';
    output[path] ??= issue.message;
  }
  return output;
}
