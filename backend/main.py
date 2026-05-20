import cv2
import time
import logging
import threading
from contextlib import asynccontextmanager

import requests
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
FRAME_W, FRAME_H = 640, 480
UPLOAD_INTERVAL = 10  # segundos entre escrituras a Supabase

# Credenciales de Supabase (archivo config.py local, no se sube a git)
try:
    from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_CLIENT_ID
    SUPABASE_ENABLED = bool(SUPABASE_URL) and bool(SUPABASE_SERVICE_KEY)
except ImportError:
    SUPABASE_URL = SUPABASE_SERVICE_KEY = ""
    SUPABASE_ENABLED = False
    GOOGLE_CLIENT_ID = ""

ALLOWED_DOMAIN = "@mail.pucv.cl"

CAMERAS_CONFIG = [
    {"id": "cam1", "name": "Camara 1 - Webcam",  "source": 0},
    {"id": "cam2", "name": "Camara 2 - Celular", "source": 1},
]


def make_placeholder(text, color=(0, 165, 255)):
    """Frame JPEG de marcador con un mensaje (cuando no hay cámara)."""
    frame = np.full((FRAME_H, FRAME_W, 3), 38, dtype=np.uint8)
    font = cv2.FONT_HERSHEY_SIMPLEX
    size = cv2.getTextSize(text, font, 0.8, 2)[0]
    x = (FRAME_W - size[0]) // 2
    y = (FRAME_H + size[1]) // 2
    cv2.putText(frame, text, (x, y), font, 0.8, color, 2)
    ok, buf = cv2.imencode(".jpg", frame)
    return buf.tobytes() if ok else None


# ─────────────────────────────────────────────
# WORKER POR CÁMARA
# ─────────────────────────────────────────────
class CameraWorker:
    def __init__(self, cam_id, name, source):
        self.id = cam_id
        self.name = name
        self.source = source
        self.model = YOLO("yolov8n.pt")
        self.model.to(DEVICE)

        self.lock = threading.Lock()
        self.latest_frame = make_placeholder(f"{name}: iniciando...")
        self.count = 0
        self.online = False
        self.error = None
        self._running = False
        self._thread = None

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)

    def _loop(self):
        while self._running:
            backend = cv2.CAP_DSHOW if isinstance(self.source, int) else cv2.CAP_ANY
            cap = cv2.VideoCapture(self.source, backend)

            if not cap.isOpened():
                self.online = False
                self.error = f"No se pudo abrir: {self.source}"
                logger.warning(f"[{self.id}] {self.error} - reintento en 3s")
                with self.lock:
                    self.latest_frame = make_placeholder(f"{self.name}: SIN SENAL")
                    self.count = 0
                time.sleep(3)
                continue

            cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self.online = True
            self.error = None
            logger.info(f"[{self.id}] Capturando desde {self.source}")

            while self._running:
                ok, frame = cap.read()
                if not ok:
                    logger.warning(f"[{self.id}] Frame perdido, reconectando…")
                    with self.lock:
                        self.latest_frame = make_placeholder(f"{self.name}: RECONECTANDO")
                        self.count = 0
                    break

                results = self.model.track(
                    frame, classes=0, persist=True,
                    tracker="bytetrack.yaml", verbose=False, device=DEVICE,
                )

                count = 0
                if results and results[0].boxes is not None:
                    boxes = results[0].boxes.xyxy.cpu().numpy()
                    ids = (results[0].boxes.id.cpu().numpy().astype(int)
                           if results[0].boxes.id is not None
                           else [None] * len(boxes))
                    count = len(boxes)
                    for box, tid in zip(boxes, ids):
                        x1, y1, x2, y2 = map(int, box)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        label = f"ID {tid}" if tid is not None else "Persona"
                        cv2.putText(frame, label, (x1, y1 - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

                cv2.putText(frame, f"{self.name} | Aforo: {count}",
                            (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                            (0, 200, 255), 2)

                ok2, buf = cv2.imencode(".jpg", frame)
                if ok2:
                    with self.lock:
                        self.latest_frame = buf.tobytes()
                        self.count = count

            cap.release()
            self.online = False

    def snapshot(self):
        with self.lock:
            return self.latest_frame


CAMERAS = {}


# ─────────────────────────────────────────────
# UPLOADER A SUPABASE
# ─────────────────────────────────────────────
def upload_loop():
    if not SUPABASE_ENABLED:
        logger.warning("Supabase no configurado - persistencia desactivada.")
        return

    url = f"{SUPABASE_URL}/rest/v1/samples"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    while True:
        time.sleep(UPLOAD_INTERVAL)
        rows = [{"camera_id": w.id, "count": w.count} for w in CAMERAS.values()]
        if not rows:
            continue
        try:
            res = requests.post(url, json=rows, headers=headers, timeout=5)
            if res.status_code in (200, 201):
                logger.info(f"Supabase: {len(rows)} muestras subidas")
            else:
                logger.warning(f"Supabase respondio {res.status_code}: {res.text}")
        except Exception as e:
            logger.warning(f"Supabase sin conexion: {e}")


# ─────────────────────────────────────────────
# CICLO DE VIDA
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Dispositivo de inferencia: {DEVICE.upper()}")
    if DEVICE == "cuda":
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
    for cfg in CAMERAS_CONFIG:
        try:
            worker = CameraWorker(cfg["id"], cfg["name"], cfg["source"])
            worker.start()
            CAMERAS[cfg["id"]] = worker
            logger.info(f"Worker iniciado: {cfg['id']}")
        except Exception as e:
            logger.error(f"No se pudo iniciar worker {cfg['id']}: {e}")

    threading.Thread(target=upload_loop, daemon=True).start()
    logger.info(f"Uploader Supabase: {'activo' if SUPABASE_ENABLED else 'desactivado'}")

    yield
    for worker in CAMERAS.values():
        worker.stop()
    logger.info("Workers detenidos.")


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# STREAMING
# ─────────────────────────────────────────────
def mjpeg_stream(cam_id):
    worker = CAMERAS[cam_id]
    while True:
        frame = worker.snapshot()
        if frame is None:
            time.sleep(0.05)
            continue
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
        time.sleep(0.03)


@app.get("/video_feed/{cam_id}")
async def video_feed(cam_id: str):
    if cam_id not in CAMERAS:
        raise HTTPException(404, "Camara no encontrada")
    return StreamingResponse(
        mjpeg_stream(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ─────────────────────────────────────────────
# API
# ─────────────────────────────────────────────
@app.get("/api/cameras")
async def list_cameras():
    return [
        {"id": w.id, "name": w.name, "count": w.count,
         "online": w.online, "error": w.error}
        for w in CAMERAS.values()
    ]


class GoogleTokenPayload(BaseModel):
    id_token: str


@app.post("/api/auth/google")
async def auth_google(payload: GoogleTokenPayload):
    try:
        res = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": payload.id_token},
            timeout=5,
        )
    except requests.RequestException:
        raise HTTPException(502, "No se pudo validar el token con Google")

    if res.status_code != 200:
        raise HTTPException(401, "Token de Google invalido")

    data = res.json()
    if GOOGLE_CLIENT_ID and data.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(401, "Token no corresponde al cliente")

    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(401, "El token no incluye correo")

    if str(data.get("email_verified")).lower() != "true":
        raise HTTPException(401, "Correo no verificado")

    if not email.endswith(ALLOWED_DOMAIN):
        raise HTTPException(403, "Dominio de correo no permitido")

    return {
        "email": email,
        "name": data.get("name"),
        "picture": data.get("picture"),
    }


@app.get("/api/counter/{cam_id}")
async def counter(cam_id: str):
    if cam_id not in CAMERAS:
        raise HTTPException(404, "Camara no encontrada")
    w = CAMERAS[cam_id]
    return {"id": w.id, "name": w.name, "count": w.count,
            "online": w.online, "device": DEVICE}


@app.get("/health")
async def health():
    return {"status": "online", "device": DEVICE,
            "cameras": list(CAMERAS.keys()),
            "supabase": SUPABASE_ENABLED}