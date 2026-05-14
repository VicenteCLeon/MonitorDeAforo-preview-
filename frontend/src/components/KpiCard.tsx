import Sparkline from "./Sparkline";

interface KpiProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: string;
  deltaKind?: "up" | "down" | "flat";
  foot?: string;
  spark?: number[];
}

export default function KpiCard({ label, value, unit, delta, deltaKind = "up", foot, spark }: KpiProps) {
  const deltaClasses =
    deltaKind === "up"
      ? "text-danger bg-danger-bg"
      : deltaKind === "down"
      ? "text-ok bg-ok-bg"
      : "text-ink-3 bg-surface-2 border border-line";

  return (
    <div className="relative overflow-hidden bg-surface border border-line rounded-xl p-4 flex flex-col gap-1.5 min-h-[96px]">
      <div className="text-[11px] text-ink-3 uppercase tracking-[0.06em]">{label}</div>
      <div className="font-mono text-[30px] font-medium tracking-tight leading-none">
        {value}
        {unit && <span className="text-[14px] text-ink-3 ml-1.5 font-normal">{unit}</span>}
      </div>
      <div className="flex items-center gap-2 text-[11.5px] text-ink-3 mt-auto">
        {delta !== undefined && (
          <span className={`font-mono px-1.5 py-px rounded-sm text-[11px] ${deltaClasses}`}>
            {deltaKind === "up" ? "▲" : deltaKind === "down" ? "▼" : "■"} {delta}
          </span>
        )}
        {foot && <span>{foot}</span>}
      </div>
      {spark && (
        <div className="absolute right-3.5 bottom-3.5 opacity-55">
          <Sparkline data={spark} color="var(--color-ink-4)" w={70} h={22} />
        </div>
      )}
    </div>
  );
}
