import { useEffect, useMemo, useState } from "react";
import type { Faculty } from "./types";
import { statusOf, fmt, genDayCurve, genSpark } from "./data";
import { fetchCameras, streamUrl, CAMERA_META } from "./api";
import type { CameraDTO } from "./api";
import TopBar from "./components/TopBar";
import KpiCard from "./components/KpiCard";
import FacultyCard from "./components/FacultyCard";
import DayChart from "./components/DayChart";
import ActivityLog from "./components/ActivityLog";

const WARN_T = 60;
const DANGER_T = 85;
const SEMAFORO_STYLE = "tower" as const;
const SHOW_SPARK = true;
const POLL_MS = 2000;

export default function App() {
  const [now, setNow] = useState(new Date());
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [connError, setConnError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const dayCurve = useMemo(() => genDayCurve(), []);

  // Reloj
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Polling al backend real
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const cams: CameraDTO[] = await fetchCameras();
        if (cancelled) return;
        setFaculties((prev) => {
          const prevOcc = new Map(prev.map((f) => [f.id, f.occ]));
          return cams.map((c) => {
            const meta = CAMERA_META[c.id] ?? { capacity: 50, building: "Sin ubicación" };
            const prevCount = prevOcc.get(c.id) ?? c.count;
            return {
              id: c.id,
              name: c.name,
              cap: meta.capacity,
              occ: c.count,
              building: meta.building,
              cams: 1,
              fps: 30,
              delta: c.count - prevCount,
              lastUpd: 0,
              online: c.online,
              streamUrl: streamUrl(c.id),
            };
          });
        });
        setConnError(null);
      } catch {
        if (!cancelled) setConnError("Sin conexión con el backend (puerto 8000)");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const totalOcc = faculties.reduce((s, f) => s + f.occ, 0);
  const totalCap = faculties.reduce((s, f) => s + f.cap, 0);
  const overallPct = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;
  const alerts = faculties.filter((f) => f.cap > 0 && (f.occ / f.cap) * 100 >= WARN_T).length;
  const criticals = faculties.filter((f) => f.cap > 0 && (f.occ / f.cap) * 100 >= DANGER_T).length;
  const onlineCount = faculties.filter((f) => f.online !== false).length;
  const overallStatus = statusOf(overallPct, WARN_T, DANGER_T);

  return (
    <div className="min-h-screen bg-bg">
      <div className="px-3 pt-3 pb-[88px] md:px-7 md:pt-5 md:pb-10 max-w-[1440px] mx-auto">

        <TopBar now={now} overallStatus={overallStatus} />

        {/* Banner de error de conexión */}
        {connError && (
          <div className="mt-3 px-3.5 py-2.5 rounded-[10px] border border-danger bg-danger-bg text-danger text-[12px] font-medium flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {connError} · reintentando…
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
          <KpiCard
            label="Aforo total" value={fmt(totalOcc)} unit={`/ ${fmt(totalCap)}`}
            delta={`${overallPct}%`}
            deltaKind={overallStatus === "danger" ? "up" : overallStatus === "warn" ? "flat" : "down"}
            foot="Personas detectadas ahora" spark={genSpark(Math.max(totalOcc, 1), 0.03)}
          />
          <KpiCard
            label="Ocupación general" value={`${overallPct}`} unit="%"
            delta={overallStatus === "danger" ? "crítico" : overallStatus === "warn" ? "atención" : "normal"}
            deltaKind={overallStatus === "danger" ? "up" : overallStatus === "warn" ? "flat" : "down"}
            foot="Promedio del campus"
          />
          <KpiCard
            label="Cámaras en línea" value={onlineCount} unit={`/ ${faculties.length}`}
            delta={onlineCount === faculties.length && faculties.length > 0 ? "todas activas" : "revisar"}
            deltaKind={onlineCount === faculties.length ? "flat" : "up"}
            foot="Estado de conexión"
          />
          <KpiCard
            label="Cámaras en alerta" value={alerts} unit={`/ ${faculties.length}`}
            delta={`${criticals} críticas`} deltaKind={criticals > 0 ? "up" : "flat"}
            foot="Aforo ≥ umbral ámbar"
          />
        </div>

        {/* Section header */}
        <div className="mx-1 mt-6 mb-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14px] md:text-[15px] font-semibold tracking-tight">Cámaras · en tiempo real</h2>
              <div className="text-ink-3 text-[11px] md:text-[12px] mt-0.5">YOLOv8 · refresco cada 2 s</div>
            </div>
            <div className="flex gap-3 text-[11px] text-ink-3 items-center">
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-ok" /> Normal</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-warn" /> Atención</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-danger" /> Crítico</span>
            </div>
          </div>
        </div>

        {/* Camera grid */}
        {loading ? (
          <div className="text-ink-3 text-[12px] py-10 text-center">Conectando con el backend…</div>
        ) : faculties.length === 0 ? (
          <div className="text-ink-3 text-[12px] py-10 text-center">No hay cámaras configuradas en el backend.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {faculties.map((f) => (
              <FacultyCard key={f.id} f={f} warnT={WARN_T} dangerT={DANGER_T} semaforoStyle={SEMAFORO_STYLE} showSpark={SHOW_SPARK} />
            ))}
          </div>
        )}

        {/* Chart + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2.5 mt-2.5">
          <div className="bg-surface border border-line rounded-[14px] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="m-0 text-[13px] md:text-[13.5px] font-semibold">Ocupación del campus · hoy</h3>
                <div className="text-ink-3 text-[11px] mt-0.5 hidden sm:block">Datos de ejemplo · histórico llegará con la persistencia</div>
              </div>
              <div className="inline-flex border border-line rounded-lg overflow-hidden bg-surface-2">
                {["1H", "HOY", "SEMANA", "MES"].map((s) => (
                  <button key={s} className={`border-0 px-2 md:px-2.5 py-[5px] text-[11px] md:text-[11.5px] font-mono ${s === "HOY" ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line-strong)_inset]" : "bg-transparent text-ink-3"
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

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-surface border-t border-line z-50"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="grid grid-cols-4 h-14">
          {[
            {
              label: "Inicio", active: true,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            },
            {
              label: "Mapa", active: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            },
            {
              label: "Alertas", active: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            },
            {
              label: "Cuenta", active: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
            },
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