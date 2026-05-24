import type { Status } from "./types";

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
