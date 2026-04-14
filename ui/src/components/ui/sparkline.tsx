import type { ChartPoint } from "../../lib/page-models";

type SparklineProps = {
  points: ChartPoint[];
  height?: number;
};

export function Sparkline({ points, height = 120 }: SparklineProps) {
  if (points.length < 2) {
    return (
      <div className="empty-note" style={{ minHeight: height }}>
        暂无曲线数据
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = 8;
  const width = 100;
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points
    .map((point, index) => {
      const x = index * step;
      const y = padding + (1 - (point.value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="曲线">
        <polyline points={coords} className="sparkline__line" />
      </svg>
      <div className="sparkline__labels">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

