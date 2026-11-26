/**
 * @hse/shared — the framework-agnostic heart of Halal Stock Engine.
 *
 * Consumed as TypeScript source by Next.js (`transpilePackages`) and Metro, and
 * by Vitest for unit tests. No Node-only APIs are used, so the same code runs on
 * the server, in the browser, in React Native and in Deno Edge Functions.
 */

export * from './types';
export * from './constants';

export * from './sharia/screening';
export * from './alerts/evaluate';
export * from './market/indicators';
export * from './portfolio/calc';
export * from './subscriptions/entitlements';
export * from './stripe/billing';
export * from './stripe/signature';
export * from './utils/format';
export * from './validation/schemas';
export * from './i18n';
export * as demo from './demo/data';
