// Conexión con el backend FastAPI
export const API_BASE = "http://localhost:8000";

// El backend no conoce la capacidad de cada zona — se define aquí.
// Ajusta "capacity" según el aforo real del espacio que vigila cada cámara.
export const CAMERA_META: Record<string, { capacity: number; building: string }> = {
    cam1: { capacity: 30, building: "Acceso principal · Patio IBC" },
    cam2: { capacity: 30, building: "Acceso secundario · Comedor IBC" },
};

export interface CameraDTO {
    id: string;
    name: string;
    count: number;
    online: boolean;
    error: string | null;
}

export async function fetchCameras(): Promise<CameraDTO[]> {
    const res = await fetch(`${API_BASE}/api/cameras`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export function streamUrl(camId: string): string {
    return `${API_BASE}/video_feed/${camId}`;
}