import type { Faculty, DayPoint, ActivityEntry, Status } from "./types";

// Facultades genéricas (placeholders — reemplazar con datos reales)
export const FACULTIES_SEED: Faculty[] = [
  { id: "ING", name: "Ingeniería",          cap: 1200, occ: 1080, building: "Edif. A · Pabellón Norte", cams: 4, fps: 30 },
  { id: "MED", name: "Medicina",            cap: 900,  occ: 612,  building: "Edif. C · Campus Salud",   cams: 3, fps: 30 },
  { id: "DER", name: "Derecho",             cap: 750,  occ: 245,  building: "Edif. B · Planta baja",    cams: 2, fps: 25 },
  { id: "ECO", name: "Ciencias Económicas", cap: 1100, occ: 798,  building: "Edif. D · Torre Este",     cams: 3, fps: 30 },
  { id: "ARQ", name: "Arquitectura",        cap: 650,  occ: 410,  building: "Edif. E · Talleres",       cams: 2, fps: 25 },
  { id: "SOC", name: "Ciencias Sociales",   cap: 800,  occ: 180,  building: "Edif. F · Auditorios",     cams: 2, fps: 30 },
  { id: "BIB", name: "Biblioteca Central",  cap: 1500, occ: 1395, building: "Edif. G · Hemeroteca",     cams: 4, fps: 30 },
  { id: "EDU", name: "Educación",           cap: 700,  occ: 522,  building: "Edif. H · Bloque 2",       cams: 2, fps: 25 },
];

export function genSpark(target: number, vol = 0.12): number[] {
  const out: number[] = [];
  let v = target * 0.6;
  for (let i = 0; i < 24; i++) {
    v += (target - v) * 0.15 + (Math.random() - 0.5) * target * vol;
    out.push(Math.max(0, Math.round(v)));
  }
  out[out.length - 1] = target;
  return out;
}

export function genDayCurve(): DayPoint[] {
  const base = [0.05, 0.10, 0.25, 0.55, 0.78, 0.92, 0.88, 0.70, 0.85, 0.90, 0.72, 0.40, 0.20];
  return base.map((p, i) => ({
    t: 8 + i,
    pct: p,
    people: Math.round(p * 7600 * (0.95 + Math.random() * 0.1)),
  }));
}

export function statusOf(pct: number, warnT: number, dangerT: number): Status {
  if (pct >= dangerT) return "danger";
  if (pct >= warnT) return "warn";
  return "ok";
}

export function fmt(n: number): string {
  return n.toLocaleString("es-CO");
}

export function clockNow(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function dateLabel(d: Date): string {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
}

import React from "react";

export const ACTIVITY: ActivityEntry[] = [
  { t: "14:02", kind: "danger", text: <span><b>Biblioteca Central</b> superó el 90% de aforo</span> },
  { t: "13:58", kind: "warn",   text: <span><b>Ingeniería</b> entró en zona ámbar</span> },
  { t: "13:51", kind: "ok",     text: <span><b>Derecho</b> liberó capacidad — 32% de aforo</span> },
  { t: "13:47", kind: "warn",   text: <span><b>Ciencias Económicas</b> 72% — cambio de bloque</span> },
  { t: "13:40", kind: "ok",     text: <span><b>Arquitectura</b> recuento manual confirmado</span> },
  { t: "13:35", kind: "danger", text: <span><b>Ingeniería</b> cámara <span className="font-mono">CAM-03</span> offline · puerta sur</span> },
  { t: "13:28", kind: "warn",   text: <span>Modelo YOLO recargado · v8n · confianza ≥ 0.55</span> },
  { t: "13:22", kind: "ok",     text: <span>Inicio de turno · 17 cámaras en línea</span> },
];
