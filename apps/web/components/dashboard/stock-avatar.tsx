import { cn } from '@hse/shared';

const gradients = [
  'from-brand-700 to-ink-900',
  'from-ink-800 to-brand-900',
  'from-sky-700 to-ink-900',
  'from-amber-600 to-ink-900',
  'from-indigo-700 to-ink-900',
  'from-rose-700 to-ink-900',
];

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 997;
  }
  return result;
}

export function StockAvatar({
  symbol,
  size = 'md',
  className,
}: {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const gradient = gradients[hash(symbol) % gradients.length];
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br font-semibold tracking-tight text-white shadow-sm',
        size === 'sm' ? 'size-8 text-[11px]' : size === 'lg' ? 'size-12 text-sm' : 'size-10 text-xs',
        gradient,
        className,
      )}
      aria-hidden
    >
      {symbol.slice(0, 2)}
    </span>
  );
}
