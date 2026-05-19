import cv2
import time
import logging
import threading
from contextlib import asynccontextmanager

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
FRAME_W, FRAME_H = 640, 480

CAMERAS_CONFIG = [
    {"id": "cam1", "name": "Patio IBC", "source": 0},
    {"id": "cam2", "name": "Comedor IBC", "source": 1},  # índice de Iriun
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

            # Cámara no disponible → placeholder + reintento
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
                    break  # rompe loop interno → reabre la cámara

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
            "cameras": list(CAMERAS.keys())}