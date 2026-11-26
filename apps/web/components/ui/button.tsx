import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@hse/shared';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'lime';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 shadow-[0_10px_30px_-15px_rgba(15,118,110,0.8)]',
  secondary: 'bg-ink-900 text-sand-50 hover:bg-ink-800',
  outline: 'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100/70',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  lime: 'bg-lime text-ink-950 hover:bg-lime-deep',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-full',
  md: 'h-11 px-5 text-sm gap-2 rounded-full',
  lg: 'h-13 px-7 text-base gap-2.5 rounded-full',
};

export function buttonStyles(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap',
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonStyles(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonStyles(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
