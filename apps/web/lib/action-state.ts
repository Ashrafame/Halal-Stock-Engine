export interface ActionState {
  ok: boolean;
  message?: string;
  code?: string;
}

export const initialActionState: ActionState = { ok: false };

export function actionOk(message?: string): ActionState {
  return { ok: true, message };
}

export function actionError(code: string, message?: string): ActionState {
  return { ok: false, code, message };
}

/** Postgres errors raised by quota/compliance triggers. */
export function mapDbError(message: string | undefined): { code: string; message: string } {
  const raw = message ?? 'unknown';
  if (raw.includes('alert_limit_reached')) {
    return { code: 'alert_limit', message: 'You have reached your plan’s alert limit.' };
  }
  if (raw.includes('compliance_gate')) {
    return { code: 'compliance_gate', message: 'Only halal stocks can receive price alerts.' };
  }
  if (raw.includes('feature_disabled')) {
    return { code: 'feature_disabled', message: 'This alert type requires the Pro plan.' };
  }
  if (raw.includes('watchlist_limit_reached')) {
    return { code: 'watchlist_limit', message: 'Your watchlist is full.' };
  }
  if (raw.includes('portfolio_limit_reached')) {
    return { code: 'portfolio_limit', message: 'Your plan’s portfolio limit has been reached.' };
  }
  if (raw.includes('holding_limit_reached')) {
    return { code: 'holding_limit', message: 'This portfolio has reached its holdings limit.' };
  }
  return { code: 'error', message: 'Something went wrong. Please try again.' };
}
