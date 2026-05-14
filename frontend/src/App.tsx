import { useEffect, useMemo, useState } from "react";
import type { Faculty } from "./types";
import { FACULTIES_SEED, statusOf, fmt, genDayCurve, genSpark } from "./data";
import TopBar from "./components/TopBar";
import KpiCard from "./components/KpiCard";
import FacultyCard from "./components/FacultyCard";
import DayChart from "./components/DayChart";
import ActivityLog from "./components/ActivityLog";

const WARN_T = 60;
const DANGER_T = 85;
const SEMAFORO_STYLE = "tower" as const;
const SHOW_SPARK = true;
const SIMULATE = true;

export default function App() {
  const [now, setNow] = useState(new Date());
  const [faculties, setFaculties] = useState<Faculty[]>(() =>
    FACULTIES_SEED.map((f) => ({
      ...f,
      delta: Math.round((Math.random() * 2 - 0.4) * 5),
      lastUpd: 5 + Math.floor(Math.random() * 30),
    }))
  );
  const dayCurve = useMemo(() => genDayCurve(), []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!SIMULATE) return;
    const id = setInterval(() => {
      setFaculties((prev) =>
        prev.map((f) => {
          const drift = Math.round((Math.random() - 0.5) * f.cap * 0.02);
          const newOcc = Math.max(0, Math.min(f.cap, f.occ + drift));
          return { ...f, occ: newOcc, delta: drift, lastUpd: 1 + Math.floor(Math.random() * 8) };
        })
      );
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const totalOcc = faculties.reduce((s, f) => s + f.occ, 0);
  const totalCap = faculties.reduce((s, f) => s + f.cap, 0);
  const overallPct = Math.round((totalOcc / totalCap) * 100);
  const alerts = faculties.filter((f) => (f.occ / f.cap) * 100 >= WARN_T).length;
  const criticals = faculties.filter((f) => (f.occ / f.cap) * 100 >= DANGER_T).length;
  const overallStatus = statusOf(overallPct, WARN_T, DANGER_T);

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Scrollable content ── */}
      <div className="px-3 pt-3 pb-[88px] md:px-7 md:pt-5 md:pb-10 max-w-[1440px] mx-auto">

        <TopBar now={now} overallStatus={overallStatus} />

        {/* KPIs: 2 cols mobile → 4 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
          <KpiCard
            label="Aforo total" value={fmt(totalOcc)} unit={`/ ${fmt(totalCap)}`}
            delta={`${overallPct}%`}
            deltaKind={overallStatus === "danger" ? "up" : overallStatus === "warn" ? "flat" : "down"}
            foot="Capacidad del campus" spark={genSpark(totalOcc, 0.03)}
          />
          <KpiCard label="Facultades en alerta" value={alerts} unit={`/ ${faculties.length}`}
            delta={`${criticals} críticas`} deltaKind={criticals > 0 ? "up" : "flat"} foot="≥ ámbar" />
          <KpiCard label="Pico de hoy" value="5 487" unit="personas" delta="11:30" deltaKind="flat"
            foot="Hora estimada · histórico" />
          <KpiCard label="Tiempo promedio" value="42" unit="min" delta="−3 min" deltaKind="down"
            foot="Permanencia por visita" />
        </div>

        {/* Section header */}
        <div className="mx-1 mt-6 mb-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14px] md:text-[15px] font-semibold tracking-tight">Facultades · en tiempo real</h2>
              <div className="text-ink-3 text-[11px] md:text-[12px] mt-0.5">Cámaras YOLOv8 · refresco cada 3 s</div>
            </div>
            <div className="flex gap-3 text-[11px] text-ink-3 items-center">
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-ok" /> Normal</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-warn" /> Atención</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-danger" /> Crítico</span>
            </div>
          </div>
        </div>

        {/* Faculty grid: 1 col → 2 cols sm → 4 cols lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {faculties.map((f) => (
            <FacultyCard key={f.id} f={f} warnT={WARN_T} dangerT={DANGER_T} semaforoStyle={SEMAFORO_STYLE} showSpark={SHOW_SPARK} />
          ))}
        </div>

        {/* Chart + activity: stacked on mobile, side-by-side on lg */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2.5 mt-2.5">
          <div className="bg-surface border border-line rounded-[14px] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="m-0 text-[13px] md:text-[13.5px] font-semibold">Ocupación del campus · hoy</h3>
                <div className="text-ink-3 text-[11px] mt-0.5 hidden sm:block">Promedio ponderado por capacidad · 08:00 – 20:00</div>
              </div>
              <div className="inline-flex border border-line rounded-lg overflow-hidden bg-surface-2">
                {["1H", "HOY", "SEMANA", "MES"].map((s) => (
                  <button key={s} className={`border-0 px-2 md:px-2.5 py-[5px] text-[11px] md:text-[11.5px] font-mono ${
                    s === "HOY" ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line-strong)_inset]" : "bg-transparent text-ink-3"
                  }`}>{s}</button>
                ))}
              </div>
            </div>
            <DayChart data={dayCurve} warnT={WARN_T} dangerT={DANGER_T} />
          </div>

          <div className="bg-surface border border-line rounded-[14px] px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0 text-[13px] md:text-[13.5px] font-semibold">Actividad reciente</h3>
              <span className="text-ink-3 text-[11.5px]">Últimos eventos</span>
            </div>
            <ActivityLog />
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav (PWA) ── */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-surface border-t border-line z-50"
           style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="grid grid-cols-4 h-14">
          {[
            { label: "Inicio",  active: true,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
            { label: "Mapa",    active: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
            { label: "Alertas", active: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
            { label: "Cuenta",  active: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
          ].map(({ icon, label, active }) => (
            <button key={label} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${active ? "text-ink" : "text-ink-4"}`}>
              {icon}
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
