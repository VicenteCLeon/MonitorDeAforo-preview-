// Conexión con el backend FastAPI
export const API_BASE = "http://localhost:8000";

// Supabase — la anon key es PÚBLICA, puede ir en el frontend
export const SUPABASE_URL = "https://elbmtpcjlwofulpolnbw.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYm10cGNqbHdvZnVscG9sbmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTczNTYsImV4cCI6MjA5NDc3MzM1Nn0.q4fWVPxYJcFkoU0ubzDY8NlXTOiFiWjr4OGqnM2yrno";  // anon public key

// El backend no conoce la capacidad de cada zona — se define aquí.
export const CAMERA_META: Record<string, { capacity: number; building: string }> = {
    cam1: { capacity: 30, building: "Acceso principal · Webcam" },
    cam2: { capacity: 30, building: "Acceso secundario · Cámara móvil" },
};

// Capacidad total monitorizada (suma de todas las cámaras)
export const TOTAL_CAPACITY = Object.values(CAMERA_META).reduce(
    (sum, m) => sum + m.capacity,
    0,
);

export interface CameraDTO {
    id: string;
    name: string;
    count: number;
    online: boolean;
    error: string | null;
}

export interface HourPoint {
    bucket: number;
    people: number;
}

export interface GoogleAuthResult {
    email: string;
    name?: string;
    picture?: string;
}

export async function fetchCameras(): Promise<CameraDTO[]> {
    const res = await fetch(`${API_BASE}/api/cameras`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export function streamUrl(camId: string): string {
    return `${API_BASE}/video_feed/${camId}`;
}

export async function fetchHourlyOccupancy(): Promise<HourPoint[]> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/recent_occupancy`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
        },
        body: "{}",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleAuthResult> {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id_token: idToken }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}