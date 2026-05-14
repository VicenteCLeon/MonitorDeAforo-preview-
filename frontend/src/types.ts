export type Status = "ok" | "warn" | "danger";

export interface Faculty {
  id: string;
  name: string;
  cap: number;
  occ: number;
  building: string;
  /** Número de cámaras YOLO conectadas en los accesos */
  cams: number;
  /** Frames por segundo del pipeline de visión */
  fps: number;
  delta?: number;
  lastUpd?: number;
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
