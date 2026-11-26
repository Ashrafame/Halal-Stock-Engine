import { cn } from '@hse/shared';

export function ScoreRing({
  score,
  size = 44,
  className,
}: {
  score: number | null;
  size?: number;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const color =
    value >= 85 ? 'var(--color-brand-600)' : value >= 60 ? 'var(--color-amber-500)' : '#dc2626';

  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${value * 3.6}deg, var(--color-ink-100) 0deg)`,
      }}
      role="img"
      aria-label={`${value}`}
    >
      <span
        className="grid place-items-center rounded-full bg-white font-semibold text-ink-800"
        style={{ width: size - 8, height: size - 8, fontSize: size <= 40 ? 10 : 12 }}
      >
        {Math.round(value)}
      </span>
    </span>
  );
}
