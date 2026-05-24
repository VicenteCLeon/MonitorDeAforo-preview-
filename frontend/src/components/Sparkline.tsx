interface SparklineProps {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}

export default function Sparkline({ data, color = "#6b7280", w = 62, h = 18 }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const stepX = w / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / span) * (h - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block" style={{ width: w, height: h }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
