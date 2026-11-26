import Link from 'next/link';

import { cn } from '@hse/shared';

export function Logo({
  className,
  inverted = false,
  compact = false,
}: {
  className?: string;
  inverted?: boolean;
  compact?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative grid size-9 place-items-center rounded-2xl shadow-sm',
          inverted ? 'bg-lime text-ink-950' : 'bg-ink-900 text-lime',
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none">
          <path
            d="M15.8 3.6a8.6 8.6 0 1 0 4.6 15.1 9.4 9.4 0 0 1-4.6-15.1Z"
            fill="currentColor"
          />
          <path
            d="m17.7 5.1.7 1.7 1.8.2-1.4 1.2.4 1.8-1.5-.9-1.5.9.4-1.8-1.4-1.2 1.8-.2.7-1.7Z"
            fill="currentColor"
          />
        </svg>
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'text-[15px] font-semibold tracking-tight',
              inverted ? 'text-sand-50' : 'text-ink-950',
            )}
          >
            Halal Stock Engine
          </span>
          <span
            className={cn(
              'mt-1 text-[10px] font-medium uppercase tracking-[0.18em]',
              inverted ? 'text-sand-200/70' : 'text-ink-400',
            )}
          >
            Screen · Alert · Track
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function LogoLink({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" aria-label="Halal Stock Engine home">
      <Logo inverted={inverted} />
    </Link>
  );
}
