import type { DayPoint } from "../types";

interface DayChartProps {
  data: DayPoint[];
  warnT: number;
  dangerT: number;
}

export default function DayChart({ data, warnT, dangerT }: DayChartProps) {
  const W = 760;
  const H = 200;
  const padL = 40;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxY = 100;

  const stepX = innerW / (data.length - 1);
  const xy = (d: DayPoint, i: number): [number, number] => [
    padL + i * stepX,
    padT + innerH - ((d.pct * 100) / maxY) * innerH,
  ];

  const linePts = data.map((d, i) => xy(d, i).join(",")).join(" ");
  const areaPts =
    `${padL},${padT + innerH} ` +
    data.map((d, i) => xy(d, i).join(",")).join(" ") +
    ` ${padL + innerW},${padT + innerH}`;

  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = data.filter((_, i) => i % 2 === 0);

  const yWarn = padT + innerH - (warnT / maxY) * innerH;
  const yDanger = padT + innerH - (dangerT / maxY) * innerH;

  return (
    <div className="relative h-[200px]">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full block">
        {yTicks.map((tick) => {
          const y = padT + innerH - (tick / maxY) * innerH;
          return <line key={tick} x1={padL} x2={padL + innerW} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />;
        })}
        {yTicks.map((tick) => {
          const y = padT + innerH - (tick / maxY) * innerH;
          return (
            <text
              key={tick}
              x={padL - 8}
              y={y + 3}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--color-ink-3)"
            >
              {tick}%
            </text>
          );
        })}

        {/* Threshold lines */}
        <line
          x1={padL}
          x2={padL + innerW}
          y1={yWarn}
          y2={yWarn}
          stroke="oklch(0.78 0.16 80)"
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.7}
        />
        <line
          x1={padL}
          x2={padL + innerW}
          y1={yDanger}
          y2={yDanger}
          stroke="oklch(0.62 0.18 25)"
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.7}
        />
        <text x={padL + innerW - 4} y={yWarn - 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize={10} fill="oklch(0.55 0.12 80)">
          warn {warnT}%
        </text>
        <text
          x={padL + innerW - 4}
          y={yDanger - 4}
          textAnchor="end"
          fontFamily="var(--font-mono)"
          fontSize={10}
          fill="oklch(0.55 0.16 25)"
        >
          danger {dangerT}%
        </text>

        <defs>
          <linearGradient id="sc-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.55 0.05 250)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="oklch(0.55 0.05 250)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill="url(#sc-area)" />
        <polyline
          points={linePts}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((d, i) => {
          const [x, y] = xy(d, i);
          return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth={1.4} />;
        })}

        {xTicks.map((d) => {
          const idx = data.indexOf(d);
          const x = padL + idx * stepX;
          return (
            <text
              key={d.t}
              x={x}
              y={H - 8}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--color-ink-4)"
            >
              {`${String(Math.floor(d.t / 100)).padStart(2, "0")}:${String(d.t % 100).padStart(2, "0")}`}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
