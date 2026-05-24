import { useEffect, useState, useCallback, useRef } from "react";
import type { Faculty, DayPoint, ActivityEntry } from "./types";
import { statusOf, fmt, clockNow } from "./data";
import {
  fetchCameras,
  streamUrl,
  CAMERA_META,
  fetchHourlyOccupancy,
  TOTAL_CAPACITY,
  UnauthorizedError,
  isTokenExpired,
} from "./api";
import type { CameraDTO } from "./api";
import TopBar from "./components/TopBar";
import KpiCard from "./components/KpiCard";
import FacultyCard from "./components/FacultyCard";
import DayChart from "./components/DayChart";
import ActivityLog from "./components/ActivityLog";
import Login from "./components/Login";

const WARN_T = 60;
const DANGER_T = 85;
const SEMAFORO_STYLE = "tower" as const;
const SHOW_SPARK = true;
const POLL_MS = 2000;
const HISTORY_MS = 60000;
const AUTH_STORAGE_KEY = "monitor-aforo-token";
const SPARK_MAX_POINTS = 24; // ~48 segundos de historial real

// ── Helpers de sesión ──────────────────────────────────────────────────────────
function readStoredToken(): string | null {
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
  return token;
}

export default function App() {
  const [now, setNow] = useState(new Date());
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [dayCurve, setDayCurve] = useState<DayPoint[]>([]);
  const [connError, setConnError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [totalSpark, setTotalSpark] = useState<number[]>([]);

  // Historial real de conteos por cámara (no dispara re-renders)
  const historyRef = useRef<Map<string, number[]>>(new Map());

  // ── Restaurar sesión desde localStorage ────────────────────────────────────
  useEffect(() => {
    const token = readStoredToken();
    if (token) setSessionToken(token);
    else setLoading(false);
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback((reason?: string) => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setSessionToken(null);
    setFaculties([]);
    setDayCurve([]);
    setActivity([]);
    setTotalSpark([]);
    historyRef.current.clear();
    setLoading(true);
    if (reason) setConnError(reason);
    else setConnError(null);
  }, []);

  // ── Reloj ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Expiración de sesión ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionToken) return;
    const id = setInterval(() => {
      if (isTokenExpired(sessionToken)) {
        handleLogout("Tu sesión expiró. Vuelve a iniciar sesión.");
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [sessionToken, handleLogout]);

  // ── Polling de cámaras ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    async function poll() {
      try {
        const cams: CameraDTO[] = await fetchCameras(sessionToken!);
        if (cancelled) return;

        let nextEvents: ActivityEntry[] = [];

        setFaculties((prev) => {
          const prevMap = new Map(prev.map((f) => [f.id, f]));

          const next = cams.map((c) => {
            const meta = CAMERA_META[c.id] ?? { capacity: 50, building: "Sin ubicación" };
            const prevCount = prevMap.get(c.id)?.occ ?? c.count;

            // Acumular historial real para el sparkline
            const prevHist = historyRef.current.get(c.id) ?? [];
            const newHist = [...prevHist, c.count].slice(-SPARK_MAX_POINTS);
            historyRef.current.set(c.id, newHist);

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
              streamUrl: streamUrl(c.id, sessionToken!),
              spark: newHist,
            };
          });

          const timeLabel = clockNow(new Date());
          const events: ActivityEntry[] = [];

          for (const f of next) {
            const prevF = prevMap.get(f.id);
            if (!prevF) continue;

            if (prevF.online !== false && f.online === false) {
              events.push({
                t: timeLabel,
                kind: "danger",
                text: <span><b>{f.name}</b> cámara offline</span>,
              });
            } else if (prevF.online === false && f.online !== false) {
              events.push({
                t: timeLabel,
                kind: "ok",
                text: <span><b>{f.name}</b> cámara en línea</span>,
              });
            }

            if (f.cap > 0) {
              const prevPct = (prevF.occ / f.cap) * 100;
              const nextPct = (f.occ / f.cap) * 100;
              const prevStatus = statusOf(prevPct, WARN_T, DANGER_T);
              const nextStatus = statusOf(nextPct, WARN_T, DANGER_T);

              if (prevStatus !== nextStatus) {
                if (nextStatus === "danger") {
                  events.push({
                    t: timeLabel,
                    kind: "danger",
                    text: <span><b>{f.name}</b> superó {DANGER_T}% de aforo</span>,
                  });
                } else if (nextStatus === "warn") {
                  events.push({
                    t: timeLabel,
                    kind: "warn",
                    text: <span><b>{f.name}</b> entró en zona ámbar</span>,
                  });
                } else {
                  events.push({
                    t: timeLabel,
                    kind: "ok",
                    text: <span><b>{f.name}</b> volvió a nivel normal</span>,
                  });
                }
              }
            }
          }

          nextEvents = events;
          return next;
        });

        // Historial del aforo total para el KPI sparkline
        const newTotal = cams.reduce((s, c) => s + c.count, 0);
        setTotalSpark((prev) => [...prev, newTotal].slice(-SPARK_MAX_POINTS));

        if (nextEvents.length > 0) {
          setActivity((prev) => [...nextEvents, ...prev].slice(0, 8));
        }
        setConnError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          handleLogout("Sesión inválida. Vuelve a iniciar sesión.");
          return;
        }
        setConnError("Sin conexión con el backend (puerto 8000)");
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
  }, [sessionToken, handleLogout]);

  // ── Histórico desde Supabase ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    async function loadHistory() {
      try {
        const hourly = await fetchHourlyOccupancy();
        if (cancelled) return;
        const points: DayPoint[] = hourly.map((h) => {
          const people = Number(h.people) || 0;
          return {
            t: Number(h.bucket),
            people: Math.round(people),
            pct: TOTAL_CAPACITY > 0 ? people / TOTAL_CAPACITY : 0,
          };
        });
        setDayCurve(points);
      } catch {
        // si falla, el gráfico queda vacío — no es crítico
      }
    }

    loadHistory();
    const id = setInterval(loadHistory, HISTORY_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionToken]);

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!sessionToken) {
    return (
      <Login
        onSuccess={(token, _email) => {
          localStorage.setItem(AUTH_STORAGE_KEY, token);
          setSessionToken(token);
          setConnError(null);
          setLoading(true);
        }}
      />
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
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

        <TopBar now={now} overallStatus={overallStatus} onLogout={() => handleLogout()} />

        {connError && (
          <div className="mt-3 px-3.5 py-2.5 rounded-[10px] border border-danger bg-danger-bg text-danger text-[12px] font-medium flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {connError} · reintentando…
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
          <KpiCard
            label="Aforo total" value={fmt(totalOcc)} unit={`/ ${fmt(totalCap)}`}
            delta={`${overallPct}%`}
            deltaKind={overallStatus === "danger" ? "up" : overallStatus === "warn" ? "flat" : "down"}
            foot="Personas detectadas ahora"
            spark={totalSpark.length >= 2 ? totalSpark : undefined}
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

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2.5 mt-2.5">
          <div className="bg-surface border border-line rounded-[14px] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="m-0 text-[13px] md:text-[13.5px] font-semibold">Ocupación del campus · histórico</h3>
                <div className="text-ink-3 text-[11px] mt-0.5 hidden sm:block">Cada 10 min · últimas 6 h · datos en tiempo real</div>
              </div>
            </div>
            {dayCurve.length >= 2 ? (
              <DayChart data={dayCurve} warnT={WARN_T} dangerT={DANGER_T} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-center text-ink-3 text-[12px] px-4">
                Recopilando datos… el gráfico se dibuja cuando haya registros de al menos 2 horas distintas.
              </div>
            )}
          </div>

          <div className="bg-surface border border-line rounded-[14px] px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0 text-[13px] md:text-[13.5px] font-semibold">Actividad reciente</h3>
              <span className="text-ink-3 text-[11.5px]">Últimos eventos</span>
            </div>
            <ActivityLog entries={activity} />
          </div>
        </div>
      </div>
    </div>
  );
}
