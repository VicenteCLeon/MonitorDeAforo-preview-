import React from "react";
import type { Faculty, SemaforoStyle } from "../types";
import { statusOf, fmt, genSpark } from "../data";
import Semaforo from "./Semaforo";
import Sparkline from "./Sparkline";

interface FacultyCardProps {
  f: Faculty;
  warnT: number;
  dangerT: number;
  semaforoStyle: SemaforoStyle;
  showSpark: boolean;
}

export default function FacultyCard({ f, warnT, dangerT, semaforoStyle, showSpark }: FacultyCardProps) {
  const pct = Math.round((f.occ / f.cap) * 100);
  const status = statusOf(pct, warnT, dangerT);
  const spark = React.useMemo(() => genSpark(f.occ), [f.id, f.occ]);
  const delta = f.delta ?? 0;

  const sparkColor =
    status === "danger" ? "oklch(0.62 0.18 25)" : status === "warn" ? "oklch(0.72 0.16 80)" : "oklch(0.62 0.14 145)";

  const pctClasses =
    status === "danger"
      ? "text-danger bg-danger-bg"
      : status === "warn"
      ? "text-warn bg-warn-bg"
      : "text-ok bg-ok-bg";

  const fillClass =
    status === "danger" ? "bg-danger" : status === "warn" ? "bg-warn" : "bg-ok";

  const iconBorder =
    status === "danger" ? "var(--color-danger)" : status === "warn" ? "var(--color-warn)" : "var(--color-line)";

  return (
    <div
      className="bg-[#f6f6f6] border border-line rounded-[14px] p-[14px] pb-3 flex flex-col gap-3 transition-colors hover:border-line-strong"
      data-screen-label={`Card ${f.name}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div
          className="w-[34px] h-[34px] rounded-lg bg-surface-2 border flex items-center justify-center shrink-0"
          style={{ borderColor: iconBorder, borderWidth: 1 }}
        >
          <span className="font-mono text-[11px] font-semibold text-ink-2 tracking-wide">{f.id}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="m-0 text-[13.5px] font-semibold tracking-tight truncate">{f.name}</h3>
          <div className="text-[11px] text-ink-3 mt-0.5 truncate">{f.building}</div>
          <div className="text-[10.5px] text-ink-4 mt-0.5 font-mono flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            {f.cams} cám · {f.fps} fps · YOLOv8
          </div>
        </div>
        <Semaforo status={status} style={semaforoStyle} />
      </div>

      {/* Count */}
      <div className="flex items-end justify-between gap-2">
        <div className="font-mono text-[32px] font-medium leading-none tracking-tight">
          {fmt(f.occ)}
          <span className="text-[14px] text-ink-3 ml-1 font-normal"> / {fmt(f.cap)}</span>
        </div>
        <div className={`font-mono text-[13px] px-2 py-[3px] rounded-md font-medium ${pctClasses}`}>
          {pct}%
        </div>
      </div>

      {/* Progress */}
      <div
        className="relative h-[6px] bg-surface-2 rounded-[3px] overflow-hidden border border-line"
        aria-label="Ocupación"
      >
        <div
          className={`h-full rounded-sm transition-[width] duration-300 ${fillClass}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        <span
          aria-hidden
          className="absolute top-[-1px] bottom-[-1px] w-px bg-line-strong"
          style={{ left: `${warnT}%` }}
        />
        <span
          aria-hidden
          className="absolute top-[-1px] bottom-[-1px] w-px bg-line-strong"
          style={{ left: `${dangerT}%` }}
        />
      </div>

      {/* Foot */}
      <div className="flex items-center justify-between text-[11px] text-ink-3">
        <div className="flex gap-2.5 items-center">
          <span
            className={`font-mono inline-flex items-center gap-1 ${
              delta >= 0 ? "text-danger" : "text-ok"
            }`}
          >
            <span
              className="inline-block w-0 h-0"
              style={
                delta >= 0
                  ? { borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderBottom: "5px solid currentColor" }
                  : { borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: "5px solid currentColor" }
              }
            />
            {Math.abs(delta)} <span className="text-ink-4">/5min</span>
          </span>
          <span className="text-ink-4">·</span>
          <span>Actualizado hace {f.lastUpd ?? 12}s</span>
        </div>
        {showSpark && <Sparkline data={spark} color={sparkColor} />}
      </div>
    </div>
  );
}
