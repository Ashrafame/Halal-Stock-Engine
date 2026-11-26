import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { Logo } from '@/components/logo';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-sand-50 px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <p className="mt-10 font-display text-7xl tracking-tight text-ink-200">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-950">We could not find that page.</h1>
        <p className="mt-2 text-sm text-ink-500">
          The link may be outdated, or the page moved. Your portfolio is still safe.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/">Back home</ButtonLink>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center rounded-full border border-ink-200 px-5 text-sm font-semibold text-ink-700"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
