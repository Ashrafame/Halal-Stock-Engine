import { cn } from '@hse/shared';

function hash(value: string): number {
  let result = 7;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 17 + value.charCodeAt(index)) % 2311;
  }
  return result;
}

/** Deterministic decorative sparkline — no client JS, no hydration mismatch. */
export function Sparkline({
  seed,
  positive = true,
  className,
}: {
  seed: string;
  positive?: boolean;
  className?: string;
}) {
  const base = hash(seed);
  const points = Array.from({ length: 18 }, (_, index) => {
    const wave = Math.sin((index + base % 7) * 0.7) * 6;
    const trend = positive ? index * 0.9 : index * -0.35;
    const jitter = ((base >> (index % 8)) & 3) - 1.5;
    return 24 - (wave + trend + jitter);
  });

  const width = 180;
  const height = 48;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const coordinates = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = 6 + ((max - value) / span) * (height - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = positive ? 'var(--color-brand-600)' : '#dc2626';
  const area = `${coordinates.join(' ')} ${width},${height} 0,${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-12 w-full', className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${seed.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${seed.replace(/[^a-zA-Z0-9]/g, '')})`} />
      <polyline
        points={coordinates.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
