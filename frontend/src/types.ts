export type Status = "ok" | "warn" | "danger";

export interface Faculty {
  id: string;
  name: string;
  cap: number;
  occ: number;
  building: string;
  cams: number;
  fps: number;
  delta?: number;
  lastUpd?: number;
  /** Estado de conexión de la cámara (viene del backend) */
  online?: boolean;
  /** URL del stream MJPEG de la cámara */
  streamUrl?: string;
  /** Historial real de conteos (últimas N lecturas del polling) */
  spark?: number[];
}

export interface DayPoint {
  t: number;
  pct: number;
  people: number;
}

export interface ActivityEntry {
  t: string;
  kind: Status;
  text: React.ReactNode;
}

export type SemaforoStyle = "tower" | "row" | "dot";
export type Density = "compact" | "regular" | "comfy";