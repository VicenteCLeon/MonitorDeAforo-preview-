import type { Status, SemaforoStyle } from "../types";

interface SemaforoProps {
  status: Status;
  style?: SemaforoStyle;
}

export default function Semaforo({ status, style = "tower" }: SemaforoProps) {
  if (style === "tower") {
    return (
      <div
        className="w-[30px] shrink-0 rounded-[10px] p-[5px] flex flex-col gap-1 bg-ink"
        style={{ boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 2px 6px rgba(0,0,0,.15)" }}
        aria-label={`Estado ${status}`}
      >
        <Bulb tone="red" on={status === "danger"} />
        <Bulb tone="yellow" on={status === "warn"} />
        <Bulb tone="green" on={status === "ok"} />
      </div>
    );
  }
  if (style === "row") {
    return (
      <div
        className="shrink-0 rounded-[10px] p-[5px] flex flex-row gap-1 bg-ink h-[30px]"
        style={{ boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 2px 6px rgba(0,0,0,.15)" }}
        aria-label={`Estado ${status}`}
      >
        <Bulb tone="green" on={status === "ok"} />
        <Bulb tone="yellow" on={status === "warn"} />
        <Bulb tone="red" on={status === "danger"} />
      </div>
    );
  }
  // dot
  const color =
    status === "danger" ? "var(--color-danger)" : status === "warn" ? "var(--color-warn)" : "var(--color-ok)";
  const bg =
    status === "danger" ? "var(--color-danger-bg)" : status === "warn" ? "var(--color-warn-bg)" : "var(--color-ok-bg)";
  return (
    <div
      className="w-6 h-6 rounded-full shrink-0"
      style={{ background: color, boxShadow: `0 0 0 4px ${bg}, 0 0 10px ${color}` }}
      aria-label={`Estado ${status}`}
    />
  );
}

function Bulb({ tone, on }: { tone: "red" | "yellow" | "green"; on: boolean }) {
  const colorVar = tone === "red" ? "var(--color-danger)" : tone === "yellow" ? "var(--color-warn)" : "var(--color-ok)";
  return (
    <div
      className="w-5 h-5 rounded-full relative transition-colors"
      style={{
        background: on ? colorVar : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.04)",
        color: colorVar,
        boxShadow: on ? "0 0 0 2px rgba(255,255,255,0.04), 0 0 12px currentColor" : undefined,
      }}
    >
      {on && (
        <span
          aria-hidden
          className="absolute"
          style={{
            top: 3,
            left: 4,
            width: 7,
            height: 5,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.35)",
            filter: "blur(0.5px)",
          }}
        />
      )}
    </div>
  );
}
