import type {
  ComplianceAssessment,
  ComplianceCheck,
  ComplianceStatus,
  FinancialRatios,
  RevenueSegment,
} from '../types';

/**
 * Screening thresholds derived from the widely used AAOIFI / Dow Jones Islamic
 * Market Index methodology. They are intentionally conservative defaults; the
 * admin dashboard can override an individual stock's status manually.
 */
export const SHARIA_THRESHOLDS = {
  /** Interest-bearing debt / total assets. */
  maxDebtToAssets: 0.33,
  /** Interest income / total revenue. */
  maxInterestIncomeRatio: 0.05,
  /** Revenue from prohibited activities / total revenue. */
  maxNonCompliantRevenueRatio: 0.05,
  /** Accounts receivable / total assets. */
  maxReceivablesToAssets: 0.49,
  /** Relative margin around a threshold that produces a "questionable" verdict. */
  borderlineMargin: 0.15,
  /** A prohibited segment above this revenue share means the core business is impermissible. */
  coreProhibitedShare: 0.5,
} as const;

/** Sectors whose core business is impermissible regardless of ratios. */
export const PROHIBITED_SECTORS = [
  'alcohol',
  'breweries',
  'distilleries',
  'tobacco',
  'gambling',
  'casino',
  'adult entertainment',
  'pornography',
  'pork',
  'conventional banking',
  'conventional insurance',
  'interest-based finance',
  'payday lending',
] as const;

/** Sectors that are disputed or mixed; flagged questionable for human review. */
export const QUESTIONABLE_SECTORS = [
  'defense',
  'weapons',
  'aerospace & defense',
  'media & entertainment',
  'hotels',
  'conventional asset management',
] as const;

export interface BusinessActivityScreen {
  status: ComplianceStatus;
  checks: ComplianceCheck[];
  reasons: string[];
  nonCompliantRevenueRatio: number;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isFiniteRatio(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function matchesAny(haystack: string, needles: readonly string[]): string | null {
  for (const needle of needles) {
    if (haystack.includes(needle)) return needle;
  }
  return null;
}

export function isSectorProhibited(sector: string, industry?: string | null): boolean {
  const haystack = `${normalize(sector)} ${normalize(industry)}`;
  return matchesAny(haystack, PROHIBITED_SECTORS) !== null;
}

export function isSectorQuestionable(sector: string, industry?: string | null): boolean {
  const haystack = `${normalize(sector)} ${normalize(industry)}`;
  return matchesAny(haystack, QUESTIONABLE_SECTORS) !== null;
}

export function aggregateRevenueSegments(segments: readonly RevenueSegment[]): {
  nonCompliantShare: number;
  prohibitedShare: number;
} {
  const total = segments.reduce((sum, segment) => {
    const share = isFiniteRatio(segment.share) ? segment.share : 0;
    return sum + share;
  }, 0);

  if (total <= 0) return { nonCompliantShare: 0, prohibitedShare: 0 };

  const prohibited = segments
    .filter((segment) => segment.prohibited)
    .reduce((sum, segment) => sum + (isFiniteRatio(segment.share) ? segment.share : 0), 0);

  // Normalise in case the provider returns weights instead of clean fractions.
  const nonCompliantShare = Math.min(1, prohibited / total);
  return { nonCompliantShare, prohibitedShare: nonCompliantShare };
}

/**
 * Business-activity screen. Checks both the declared sector and the revenue mix,
 * because a "Technology" company can still earn 30% of revenue from interest.
 */
export function screenBusinessActivity(input: {
  sector: string;
  industry?: string | null;
  segments?: readonly RevenueSegment[];
}): BusinessActivityScreen {
  const checks: ComplianceCheck[] = [];
  const reasons: string[] = [];
  const segments = input.segments ?? [];
  const { nonCompliantShare } = aggregateRevenueSegments(segments);
  const sector = `${normalize(input.sector)} ${normalize(input.industry)}`;

  const prohibitedSector = matchesAny(sector, PROHIBITED_SECTORS);
  checks.push({
    id: 'business_sector',
    labelKey: 'screening.checks.sector',
    passed: prohibitedSector === null,
    borderline: false,
    value: null,
    threshold: null,
    detail: prohibitedSector ? `Prohibited sector: ${prohibitedSector}` : undefined,
  });
  if (prohibitedSector) reasons.push('screening.reasons.prohibited_sector');

  const questionableSector = matchesAny(sector, QUESTIONABLE_SECTORS);
  checks.push({
    id: 'business_sector_disputed',
    labelKey: 'screening.checks.disputedSector',
    passed: questionableSector === null,
    borderline: questionableSector !== null,
    value: null,
    threshold: null,
    detail: questionableSector ? `Disputed sector: ${questionableSector}` : undefined,
  });
  if (questionableSector) reasons.push('screening.reasons.disputed_sector');

  const revenuePassed = nonCompliantShare <= SHARIA_THRESHOLDS.maxNonCompliantRevenueRatio;
  const borderlineFloor =
    SHARIA_THRESHOLDS.maxNonCompliantRevenueRatio *
    (1 - SHARIA_THRESHOLDS.borderlineMargin);
  checks.push({
    id: 'business_revenue',
    labelKey: 'screening.checks.nonCompliantRevenue',
    passed: revenuePassed,
    borderline: revenuePassed && nonCompliantShare > borderlineFloor,
    value: nonCompliantShare,
    threshold: SHARIA_THRESHOLDS.maxNonCompliantRevenueRatio,
  });
  if (!revenuePassed) reasons.push('screening.reasons.non_compliant_revenue');

  const coreProhibited =
    nonCompliantShare >= SHARIA_THRESHOLDS.coreProhibitedShare || prohibitedSector !== null;

  if (coreProhibited) {
    return {
      status: 'haram',
      checks,
      reasons: reasons.length > 0 ? reasons : ['screening.reasons.prohibited_business'],
      nonCompliantRevenueRatio: nonCompliantShare,
    };
  }

  if (!revenuePassed) {
    return { status: 'haram', checks, reasons, nonCompliantRevenueRatio: nonCompliantShare };
  }

  if (questionableSector || checks.some((check) => check.borderline)) {
    return {
      status: 'questionable',
      checks,
      reasons: reasons.length > 0 ? reasons : ['screening.reasons.requires_review'],
      nonCompliantRevenueRatio: nonCompliantShare,
    };
  }

  return { status: 'halal', checks, reasons, nonCompliantRevenueRatio: nonCompliantShare };
}

function thresholdCheck(input: {
  id: string;
  labelKey: string;
  value: number | null | undefined;
  threshold: number;
  reasonKey: string;
}): ComplianceCheck {
  const { value, threshold } = input;
  if (!isFiniteRatio(value)) {
    return {
      id: input.id,
      labelKey: input.labelKey,
      passed: false,
      borderline: false,
      value: null,
      threshold,
      detail: 'missing_data',
    };
  }

  const passed = value <= threshold;
  const borderlineFloor = threshold * (1 - SHARIA_THRESHOLDS.borderlineMargin);
  return {
    id: input.id,
    labelKey: input.labelKey,
    passed,
    borderline: passed && value > borderlineFloor,
    value,
    threshold,
  };
}

export function screenFinancials(ratios: FinancialRatios): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [
    thresholdCheck({
      id: 'debt_to_assets',
      labelKey: 'screening.checks.debtToAssets',
      value: ratios.debtToAssets,
      threshold: SHARIA_THRESHOLDS.maxDebtToAssets,
      reasonKey: 'screening.reasons.debt',
    }),
    thresholdCheck({
      id: 'interest_income',
      labelKey: 'screening.checks.interestIncome',
      value: ratios.interestIncomeRatio,
      threshold: SHARIA_THRESHOLDS.maxInterestIncomeRatio,
      reasonKey: 'screening.reasons.interest',
    }),
    thresholdCheck({
      id: 'non_compliant_revenue',
      labelKey: 'screening.checks.nonCompliantRevenue',
      value: ratios.nonCompliantRevenueRatio,
      threshold: SHARIA_THRESHOLDS.maxNonCompliantRevenueRatio,
      reasonKey: 'screening.reasons.revenue',
    }),
  ];

  if (ratios.receivablesToAssets !== undefined) {
    checks.push(
      thresholdCheck({
        id: 'receivables',
        labelKey: 'screening.checks.receivables',
        value: ratios.receivablesToAssets,
        threshold: SHARIA_THRESHOLDS.maxReceivablesToAssets,
        reasonKey: 'screening.reasons.receivables',
      }),
    );
  }

  return checks;
}

/**
 * Full assessment. Status precedence is haram > questionable > halal so a single
 * hard failure can never be masked by passing checks.
 */
export function assessCompliance(input: {
  sector: string;
  industry?: string | null;
  ratios?: FinancialRatios | null;
  segments?: readonly RevenueSegment[];
}): ComplianceAssessment {
  const business = screenBusinessActivity({
    sector: input.sector,
    industry: input.industry,
    segments: input.segments,
  });

  const hasRatios =
    input.ratios != null &&
    (isFiniteRatio(input.ratios.debtToAssets) ||
      isFiniteRatio(input.ratios.interestIncomeRatio) ||
      isFiniteRatio(input.ratios.nonCompliantRevenueRatio));

  if (!hasRatios) {
    return {
      status: business.status === 'haram' ? 'haram' : 'unknown',
      score: 0,
      checks: business.checks,
      reasons: [...business.reasons, 'screening.reasons.missing_financials'],
      purificationRate: 0,
    };
  }

  const financialChecks = screenFinancials(input.ratios as FinancialRatios);
  const checks = [...business.checks, ...financialChecks];
  const reasons = [...business.reasons];

  const failed = financialChecks.filter((check) => !check.passed);
  const borderline = financialChecks.filter((check) => check.borderline);

  for (const check of failed) {
    const keyByCheck: Record<string, string> = {
      debt_to_assets: 'screening.reasons.debt',
      interest_income: 'screening.reasons.interest',
      non_compliant_revenue: 'screening.reasons.non_compliant_revenue',
      receivables: 'screening.reasons.receivables',
    };
    const key = keyByCheck[check.id];
    if (key) reasons.push(key);
  }

  let status: ComplianceStatus = 'halal';
  if (business.status === 'haram' || failed.length > 0) status = 'haram';
  else if (business.status === 'questionable' || borderline.length > 0) status = 'questionable';
  else if (business.status === 'unknown') status = 'unknown';

  const ratios = input.ratios as FinancialRatios;
  const purificationRate = Math.min(
    1,
    Math.max(
      0,
      (isFiniteRatio(ratios.nonCompliantRevenueRatio) ? ratios.nonCompliantRevenueRatio : 0) +
        (isFiniteRatio(ratios.interestIncomeRatio) ? ratios.interestIncomeRatio : 0),
    ),
  );

  let score = 100;
  score -= failed.length * 35;
  score -= borderline.length * 12;
  score -= Math.min(20, Math.round(purificationRate * 200));
  if (business.status === 'haram') score = Math.min(score, 25);
  if (status === 'halal') score = Math.max(score, 70);
  if (status === 'questionable') score = Math.min(Math.max(score, 40), 74);
  if (status === 'haram') score = Math.min(score, 39);
  if (status === 'unknown') score = 0;

  return {
    status,
    score: Math.max(0, Math.min(100, score)),
    checks,
    reasons: [...new Set(reasons)],
    purificationRate,
  };
}

/** Only `halal` names may receive price/technical alerts. */
export function isAlertable(status: ComplianceStatus): boolean {
  return status === 'halal';
}

/**
 * Dividend purification: the impermissible share of income must be given away.
 * `dividendPerShare` is in the stock's currency.
 */
export function calculatePurification(
  dividendPerShare: number,
  rates: Pick<FinancialRatios, 'nonCompliantRevenueRatio' | 'interestIncomeRatio'>,
): number {
  if (!Number.isFinite(dividendPerShare) || dividendPerShare <= 0) return 0;
  const rate = Math.min(
    1,
    Math.max(
      0,
      (rates.nonCompliantRevenueRatio || 0) + (rates.interestIncomeRatio || 0),
    ),
  );
  return Math.round(dividendPerShare * rate * 1_000_000) / 1_000_000;
}

export function complianceLabelKey(status: ComplianceStatus): string {
  return `compliance.status.${status}`;
}
