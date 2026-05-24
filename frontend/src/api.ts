// ── Conexión con el backend FastAPI ───────────────────────────────────────────
export const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

// ── Supabase (anon key — pública por diseño) ──────────────────────────────────
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ── Metadatos de cámaras (capacidad y ubicación) ──────────────────────────────
export const CAMERA_META: Record<string, { capacity: number; building: string }> = {
    cam1: { capacity: 30, building: "Acceso principal · Webcam" },
    cam2: { capacity: 30, building: "Acceso secundario · Cámara móvil" },
};

export const TOTAL_CAPACITY = Object.values(CAMERA_META).reduce(
    (sum, m) => sum + m.capacity,
    0,
);

// ── Tipos ─────────────────────────────────────────────────────────────────────
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
    token: string;   // JWT de sesión firmado por el backend
    email: string;
    name?: string;
    picture?: string;
}

// ── Error especial para respuestas 401 ────────────────────────────────────────
export class UnauthorizedError extends Error {
    constructor() {
        super("UNAUTHORIZED");
        this.name = "UnauthorizedError";
    }
}

// ── Helper: fetch autenticado con JWT ─────────────────────────────────────────
async function authFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers ?? {}),
            Authorization: `Bearer ${token}`,
        },
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
}

// ── Endpoints del backend ─────────────────────────────────────────────────────
export async function fetchCameras(token: string): Promise<CameraDTO[]> {
    const res = await authFetch(`${API_BASE}/api/cameras`, token);
    return res.json();
}

/**
 * URL del stream MJPEG con el JWT en query param.
 * (Los elementos <img src> no admiten headers personalizados.)
 */
export function streamUrl(camId: string, token: string): string {
    return `${API_BASE}/video_feed/${camId}?token=${encodeURIComponent(token)}`;
}

// ── Supabase: histórico de ocupación (usa anon key directamente) ───────────────
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

// ── Auth: verificar token Google y obtener JWT de sesión ──────────────────────
export async function verifyGoogleToken(idToken: string): Promise<GoogleAuthResult> {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
    });
    if (res.status === 403) throw new Error("DOMAIN_NOT_ALLOWED");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── Utilidad: decodificar JWT sin verificar firma (solo para leer exp) ─────────
export function parseTokenExpiry(token: string): number | null {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}

export function isTokenExpired(token: string): boolean {
    const exp = parseTokenExpiry(token);
    if (exp === null) return true;
    return Date.now() >= exp;
}
