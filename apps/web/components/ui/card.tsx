import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@hse/shared';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-ink-200/70 bg-white/90 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 sm:p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-semibold text-ink-900', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm leading-relaxed text-ink-500', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-ink-100 p-5 sm:px-6', className)}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'start',
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        align === 'center' && 'mx-auto max-w-2xl items-center text-center',
        className,
      )}
    >
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-display text-3xl leading-[1.1] tracking-tight text-ink-950 sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-base leading-relaxed text-ink-500">{description}</p>
      ) : null}
    </div>
  );
}
