import type { ActivityEntry } from "../types";

interface ActivityLogProps {
  entries: ActivityEntry[];
}

export default function ActivityLog({ entries }: ActivityLogProps) {
  if (entries.length === 0) {
    return <div className="text-[12px] text-ink-3">Sin actividad reciente.</div>;
  }

  return (
    <div className="flex flex-col">
      {entries.map((a, i) => (
        <div
          key={i}
          className="flex gap-2.5 py-2.5 items-center text-[12px] border-b border-dashed border-line last:border-b-0"
        >
          <span className="font-mono text-ink-4 text-[11px] w-[42px] shrink-0">{a.t}</span>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              a.kind === "danger" ? "bg-danger" : a.kind === "warn" ? "bg-warn" : "bg-ok"
            }`}
          />
          <span className="text-ink-2 flex-1">{a.text}</span>
        </div>
      ))}
    </div>
  );
}
