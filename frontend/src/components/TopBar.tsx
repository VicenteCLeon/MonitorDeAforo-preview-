import { clockNow, dateLabel } from "../data";
import type { Status } from "../types";

interface TopBarProps {
  now: Date;
  overallStatus: Status;
}

export default function TopBar({ now, overallStatus }: TopBarProps) {
  const liveColor =
    overallStatus === "danger" ? "var(--color-danger)" : overallStatus === "warn" ? "var(--color-warn)" : "var(--color-ok)";

  return (
    <div className="flex items-center justify-between bg-surface border border-line rounded-xl px-3 py-2 md:px-4 md:py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-ink relative flex items-center justify-center shrink-0">
          <span
            aria-hidden
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: "var(--color-ok)", boxShadow: "0 0 0 3px rgba(255,255,255,.15) inset" }}
          />
        </div>
        <div>
          <div className="font-semibold text-[15px] tracking-tight">SpotCheck</div>
          <div className="hidden sm:block text-ink-3 text-[11px] md:text-[12px]">Monitor de aforo · Campus universitario</div>
        </div>
        <div className="hidden md:block w-px h-[18px] bg-line-strong mx-1" />
        <div className="hidden md:block text-ink-3 text-[12px] capitalize">{dateLabel(now)}</div>
      </div>

      <div className="flex items-center gap-2 md:gap-[18px] text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-2 px-2 md:px-2.5 py-[5px] border border-line rounded-full bg-surface-2 text-ink-2 text-[11px] md:text-[11.5px] tracking-wide">
          <span className="w-[7px] h-[7px] rounded-full sc-pulse" style={{ background: liveColor }} />
          EN VIVO
        </span>
        <span className="font-mono text-ink text-[12px] md:text-[13px]">{clockNow(now)}</span>
        <span className="hidden md:inline text-ink-4">·</span>
        <span className="hidden md:inline">
          Latencia <b className="font-mono text-ink-2">1.2s</b>
        </span>
        <button
          aria-label="Configuración"
          className="hidden md:inline-flex w-[30px] h-[30px] rounded-lg border border-line bg-surface items-center justify-center text-ink-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
