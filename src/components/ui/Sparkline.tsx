'use client';

type SparklineProps = {
  data: number[];
  /** Render height in pixels — width stretches to fill container. */
  height?: number;
  className?: string;
  /** Tailwind text-color class — the SVG inherits via currentColor */
  colorClass?: string;
  /** 'area' fills under the line; 'line' is just the stroke; 'bar' renders bars */
  variant?: 'area' | 'line' | 'bar';
  strokeWidth?: number;
};

/**
 * Minimal SVG sparkline. Zero dependencies, dark-mode friendly via currentColor.
 * Stretches to fill its container width; pass `className` to control sizing.
 */
export function Sparkline({
  data,
  height = 36,
  className = 'w-full',
  colorClass = 'text-primary-500 dark:text-primary-400',
  variant = 'area',
  strokeWidth = 1.75,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className={className} aria-hidden />;
  }

  const W = 200;
  const H = height;
  const padding = 2;
  const innerW = W - padding * 2;
  const innerH = H - padding * 2;

  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const yFor = (v: number) => padding + innerH - ((v - min) / range) * innerH;
  const xFor = (i: number) => padding + i * stepX;

  if (variant === 'bar') {
    const barGap = 2;
    const barW = data.length > 0 ? Math.max(2, innerW / data.length - barGap) : 0;
    const baselineV = min < 0 && max > 0 ? 0 : min;
    const baselineY = yFor(baselineV);
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ height: H }}
        className={`${colorClass} ${className}`}
        aria-hidden
      >
        {data.map((v, i) => {
          const x = padding + i * (barW + barGap);
          const y = v >= 0 ? yFor(v) : baselineY;
          const bh = Math.max(1, Math.abs(yFor(v) - baselineY));
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={bh}
              fill="currentColor"
              opacity={v >= 0 ? 0.85 : 0.5}
              rx={0.5}
            />
          );
        })}
      </svg>
    );
  }

  const points = data.map((v, i) => `${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${xFor(data.length - 1).toFixed(2)},${(padding + innerH).toFixed(2)} L ${xFor(0).toFixed(2)},${(padding + innerH).toFixed(2)} Z`;
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height: H }}
      className={`${colorClass} ${className}`}
      aria-hidden
    >
      {variant === 'area' && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
