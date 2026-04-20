import { useState } from "react";
import type { ChartPoint } from "../../lib/page-models";

type SparklineProps = {
  points: ChartPoint[];
  height?: number;
};

type KlinePoint = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const MAX_LABELS = 4;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const formatPrice = (value: number) => {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1000) return value.toFixed(1);
  return value.toFixed(2);
};

const formatSigned = (value: number) => {
  if (!Number.isFinite(value)) return "--";
  const text = formatPrice(Math.abs(value));
  return value >= 0 ? `+${text}` : `-${text}`;
};

const formatPct = (value: number) => {
  if (!Number.isFinite(value)) return "--";
  const text = Math.abs(value).toFixed(2);
  return value >= 0 ? `+${text}%` : `-${text}%`;
};

const formatVolume = (value?: number) => {
  if (!isFiniteNumber(value)) return "--";
  if (Math.abs(value) >= 1_0000_0000) return `${(value / 1_0000_0000).toFixed(2)}亿`;
  if (Math.abs(value) >= 1_0000) return `${(value / 1_0000).toFixed(2)}万`;
  return value.toFixed(0);
};

const formatLabel = (label: string) => {
  const text = label.trim();
  if (!text) return "";
  const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    return `${isoDateMatch[2]}-${isoDateMatch[3]}`;
  }
  if (text.length > 8) {
    return text.slice(0, 8);
  }
  return text;
};

const buildVisibleLabels = (points: { label: string }[]) => {
  if (points.length <= MAX_LABELS) {
    return points.map((point, index) => ({ index, label: formatLabel(point.label) }));
  }

  const lastIndex = points.length - 1;
  const labels = new Map<number, string>();
  for (let slot = 0; slot < MAX_LABELS; slot += 1) {
    const ratio = slot / (MAX_LABELS - 1);
    const index = Math.round(lastIndex * ratio);
    labels.set(index, points[index].label);
  }
  return Array.from(labels.entries()).map(([index, label]) => ({ index, label: formatLabel(label) }));
};

const normalizeKlinePoints = (points: ChartPoint[]): KlinePoint[] => {
  const hasOhlc = points.some(
    (point) =>
      isFiniteNumber(point.open) || isFiniteNumber(point.high) || isFiniteNumber(point.low) || isFiniteNumber(point.close),
  );
  if (!hasOhlc) {
    return [];
  }
  const normalized: KlinePoint[] = [];
  let prevClose: number | null = null;
  for (const point of points) {
    const close = isFiniteNumber(point.close) ? point.close : isFiniteNumber(point.value) ? point.value : prevClose;
    if (!isFiniteNumber(close)) {
      continue;
    }
    const open = isFiniteNumber(point.open) ? point.open : prevClose ?? close;
    const high = isFiniteNumber(point.high) ? point.high : Math.max(open, close);
    const low = isFiniteNumber(point.low) ? point.low : Math.min(open, close);
    const volume = isFiniteNumber(point.volume) ? point.volume : undefined;
    normalized.push({
      label: point.label,
      open,
      high,
      low,
      close,
      volume,
    });
    prevClose = close;
  }
  return normalized;
};

export function Sparkline({ points, height = 88 }: SparklineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const klinePoints = normalizeKlinePoints(points);

  if (klinePoints.length >= 2) {
    const chartHeight = Math.max(height, 220);
    const width = Math.max(420, klinePoints.length * 12);
    const hasVolume = klinePoints.some((point) => isFiniteNumber(point.volume) && point.volume > 0);
    const volumeHeight = hasVolume ? Math.max(38, Math.floor(chartHeight * 0.22)) : 0;
    const priceTop = 10;
    const priceBottom = chartHeight - 12 - volumeHeight - (hasVolume ? 10 : 0);
    const priceHeight = Math.max(82, priceBottom - priceTop);
    const volumes = klinePoints.map((point) => point.volume ?? 0);
    const maxVolume = Math.max(1, ...volumes);

    const minPrice = Math.min(...klinePoints.map((point) => point.low));
    const maxPrice = Math.max(...klinePoints.map((point) => point.high));
    const priceRange = maxPrice - minPrice || 1;
    const step = width / Math.max(1, klinePoints.length);
    const candleWidth = Math.max(3, Math.min(10, step * 0.56));
    const volumeTop = priceBottom + 10;
    const volumeBottom = chartHeight - 12;
    const volumeSpan = Math.max(1, volumeBottom - volumeTop);

    const priceToY = (value: number) => priceTop + (1 - (value - minPrice) / priceRange) * priceHeight;
    const volumeToHeight = (value?: number) => {
      if (!hasVolume || !isFiniteNumber(value) || value <= 0) {
        return 0;
      }
      return Math.max(1, (value / maxVolume) * volumeSpan);
    };

    const coords = klinePoints.map((point, index) => {
      const x = index * step + step / 2;
      const yOpen = priceToY(point.open);
      const yClose = priceToY(point.close);
      const yHigh = priceToY(point.high);
      const yLow = priceToY(point.low);
      const volumeH = volumeToHeight(point.volume);
      return { x, yOpen, yClose, yHigh, yLow, volumeH };
    });

    const activeIndex = hoveredIndex ?? klinePoints.length - 1;
    const activePoint = klinePoints[activeIndex] ?? klinePoints[klinePoints.length - 1];
    const activeCoord = coords[activeIndex] ?? coords[coords.length - 1];
    const prevClose = activeIndex > 0 ? klinePoints[activeIndex - 1].close : klinePoints[0].open;
    const diff = activePoint.close - prevClose;
    const diffPct = prevClose !== 0 ? (diff / prevClose) * 100 : 0;
    const topGridY = priceTop;
    const midGridY = priceTop + priceHeight * 0.5;
    const bottomGridY = priceTop + priceHeight;
    const visibleLabels = buildVisibleLabels(klinePoints);

    return (
      <div className="sparkline sparkline--kline">
        <div className="sparkline__meta" aria-live="polite">
          <span>{`时间 ${activePoint.label || "--"}`}</span>
          <span>{`开 ${formatPrice(activePoint.open)}  高 ${formatPrice(activePoint.high)}  低 ${formatPrice(activePoint.low)}  收 ${formatPrice(activePoint.close)}`}</span>
          <span>{`涨跌 ${formatSigned(diff)} (${formatPct(diffPct)})`}</span>
          <span>{`成交量 ${formatVolume(activePoint.volume)}`}</span>
        </div>
        <div className="sparkline__chart sparkline__chart--kline" style={{ height: chartHeight }} onMouseLeave={() => setHoveredIndex(null)}>
          <svg className="sparkline__svg" viewBox={`0 0 ${width} ${chartHeight}`} role="img" aria-label="K线图">
            <line x1={0} y1={topGridY} x2={width} y2={topGridY} className="sparkline__grid" />
            <line x1={0} y1={midGridY} x2={width} y2={midGridY} className="sparkline__grid" />
            <line x1={0} y1={bottomGridY} x2={width} y2={bottomGridY} className="sparkline__grid" />
            {hasVolume ? <line x1={0} y1={volumeTop - 5} x2={width} y2={volumeTop - 5} className="sparkline__kline-separator" /> : null}

            {coords.map((coord, index) => {
              const point = klinePoints[index];
              const up = point.close >= point.open;
              const bodyTop = Math.min(coord.yOpen, coord.yClose);
              const bodyHeight = Math.max(1.2, Math.abs(coord.yClose - coord.yOpen));
              const volumeY = volumeBottom - coord.volumeH;
              return (
                <g key={`${point.label}-${index}`}>
                  {hasVolume ? (
                    <rect
                      x={coord.x - candleWidth / 2}
                      y={volumeY}
                      width={candleWidth}
                      height={coord.volumeH}
                      className={up ? "sparkline__kline-volume sparkline__kline-volume--up" : "sparkline__kline-volume sparkline__kline-volume--down"}
                    />
                  ) : null}
                  <line
                    x1={coord.x}
                    y1={coord.yHigh}
                    x2={coord.x}
                    y2={coord.yLow}
                    className={up ? "sparkline__kline-wick sparkline__kline-wick--up" : "sparkline__kline-wick sparkline__kline-wick--down"}
                  />
                  <rect
                    x={coord.x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    className={up ? "sparkline__kline-body sparkline__kline-body--up" : "sparkline__kline-body sparkline__kline-body--down"}
                  />
                  <rect
                    x={coord.x - Math.max(step / 2, candleWidth)}
                    y={priceTop}
                    width={Math.max(step, candleWidth * 2)}
                    height={priceHeight + (hasVolume ? volumeSpan + 10 : 0)}
                    className="sparkline__point-hit"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                  >
                    <title>{`${point.label} | O ${formatPrice(point.open)} H ${formatPrice(point.high)} L ${formatPrice(point.low)} C ${formatPrice(point.close)} | Vol ${formatVolume(point.volume)}`}</title>
                  </rect>
                </g>
              );
            })}

            <line
              x1={activeCoord.x}
              y1={priceTop}
              x2={activeCoord.x}
              y2={hasVolume ? volumeBottom : priceBottom}
              className="sparkline__crosshair"
            />
            <circle cx={activeCoord.x} cy={activeCoord.yClose} r={3.5} className="sparkline__point-active" />
            <text x={width - 4} y={topGridY + 10} textAnchor="end" className="sparkline__value-tag">
              {formatPrice(maxPrice)}
            </text>
            <text x={width - 4} y={bottomGridY - 2} textAnchor="end" className="sparkline__value-tag">
              {formatPrice(minPrice)}
            </text>
          </svg>
        </div>
        <div className="sparkline__labels">
          {visibleLabels.map((point) => (
            <span key={`${point.index}-${point.label}`}>{point.label}</span>
          ))}
        </div>
      </div>
    );
  }

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
  const latest = values[values.length - 1];
  const padding = 8;
  const width = Math.max(240, (points.length - 1) * 24);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const visibleLabels = buildVisibleLabels(points);
  const pointCoords = points.map((point, index) => {
    const x = index * step;
    const y = padding + (1 - (point.value - min) / range) * (height - padding * 2);
    return { x, y };
  });
  const coords = pointCoords.map((point) => `${point.x},${point.y}`).join(" ");
  const latestX = pointCoords[pointCoords.length - 1].x;
  const latestY = pointCoords[pointCoords.length - 1].y;
  const activeIndex = hoveredIndex ?? points.length - 1;
  const activePoint = points[activeIndex] ?? points[points.length - 1];
  const activeCoord = pointCoords[activeIndex] ?? pointCoords[pointCoords.length - 1];
  const firstValue = values[0];
  const activePnl = activePoint.value - firstValue;
  const activePnlPct = firstValue !== 0 ? (activePnl / firstValue) * 100 : 0;
  const topGridY = padding;
  const midGridY = padding + (height - padding * 2) * 0.5;
  const bottomGridY = height - padding;

  return (
    <div className="sparkline">
      <div className="sparkline__meta" aria-live="polite">
        <span>{`时间 ${activePoint.label || "--"}`}</span>
        <span>{`权益 ${formatPrice(activePoint.value)}`}</span>
        <span>{`区间盈亏 ${formatSigned(activePnl)} (${formatPct(activePnlPct)})`}</span>
        <span>{`最高 ${formatPrice(max)} / 最低 ${formatPrice(min)}`}</span>
      </div>
      <div className="sparkline__chart" style={{ height }} onMouseLeave={() => setHoveredIndex(null)}>
        <svg className="sparkline__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="曲线">
          <line x1={0} y1={topGridY} x2={width} y2={topGridY} className="sparkline__grid" />
          <line x1={0} y1={midGridY} x2={width} y2={midGridY} className="sparkline__grid" />
          <line x1={0} y1={bottomGridY} x2={width} y2={bottomGridY} className="sparkline__grid" />
          <polyline points={coords} className="sparkline__line" vectorEffect="non-scaling-stroke" />
          <line x1={activeCoord.x} y1={topGridY} x2={activeCoord.x} y2={bottomGridY} className="sparkline__crosshair" />
          {pointCoords.map((point, index) => {
            const pointValue = points[index].value;
            const pointPnl = pointValue - firstValue;
            const pointPnlPct = firstValue !== 0 ? (pointPnl / firstValue) * 100 : 0;
            return (
              <circle
                key={`${points[index].label}-${index}`}
                cx={point.x}
                cy={point.y}
                r={6}
                className="sparkline__point-hit"
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
              >
                <title>{`${points[index].label} | 权益 ${formatPrice(pointValue)} | 区间盈亏 ${formatSigned(pointPnl)} (${formatPct(pointPnlPct)})`}</title>
              </circle>
            );
          })}
          <circle cx={latestX} cy={latestY} r={3} className="sparkline__dot" />
          <circle cx={activeCoord.x} cy={activeCoord.y} r={3.5} className="sparkline__point-active" />
          <text x={width - 2} y={Math.max(padding + 10, latestY - 6)} textAnchor="end" className="sparkline__value-tag">
            {formatPrice(latest)}
          </text>
        </svg>
      </div>
      <div className="sparkline__labels">
        {visibleLabels.map((point) => (
          <span key={`${point.index}-${point.label}`}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}
