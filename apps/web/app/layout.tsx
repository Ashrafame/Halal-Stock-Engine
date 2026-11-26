import type { Metadata, Viewport } from 'next';

import './globals.css';

import { getI18n } from '@/lib/i18n';

export const metadata: Metadata = {
  title: {
    default: 'Halal Stock Engine — Sharia-compliant screening, alerts and portfolios',
    template: '%s · Halal Stock Engine',
  },
  description:
    'Screen stocks against AAOIFI Sharia ratios, get one-click price alerts, and track a compliant portfolio. English, Arabic (RTL) and Spanish.',
  applicationName: 'Halal Stock Engine',
  keywords: [
    'halal investing',
    'sharia compliant stocks',
    'islamic finance',
    'halal stock screener',
    'AAOIFI',
  ],
  openGraph: {
    title: 'Halal Stock Engine',
    description:
      'Know exactly which stocks are halal for you. Explainable screening, one-click alerts, portfolio tracking.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#08140f',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getI18n();

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-dvh bg-sand-50 text-ink-900 antialiased">{children}</body>
    </html>
  );
}
