import cv2
import logging
import torch
from threading import Lock
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Config ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
FRAME_W, FRAME_H = 640, 480

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"Dispositivo de inferencia: {DEVICE.upper()}")
if DEVICE == "cuda":
    logger.info(f"GPU: {torch.cuda.get_device_name(0)}")

try:
    model = YOLO('yolov8n.pt')
    model.to(DEVICE)
    logger.info("Modelo YOLO listo.")
except Exception as e:
    logger.error(f"Error cargando YOLO: {e}")

# --- Estado ---
state_lock = Lock()
current_count = 0


def get_camera():
    for index in [1, 2, 0]:
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            logger.info(f"Conectado a la cámara en el índice: {index}")
            return cap
    return None


def generate_frames():
    global current_count
    cap = get_camera()
    if cap is None:
        logger.error("No se detectó ninguna cámara disponible.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while True:
        success, frame = cap.read()
        if not success:
            break

        results = model.track(
            frame,
            classes=0,
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False,
            device=DEVICE,
        )

        count = 0
        if results and results[0].boxes is not None:
            boxes_xyxy = results[0].boxes.xyxy.cpu().numpy()
            ids = (results[0].boxes.id.cpu().numpy().astype(int)
                   if results[0].boxes.id is not None
                   else [None] * len(boxes_xyxy))

            count = len(boxes_xyxy)

            for box, tid in zip(boxes_xyxy, ids):
                x1, y1, x2, y2 = map(int, box)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                label = f"ID {tid}" if tid is not None else "Persona"
                cv2.putText(frame, label, (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        with state_lock:
            current_count = count

        cv2.putText(frame, f"Aforo: {count}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 255), 2)

        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

    cap.release()


@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/api/counter/current")
async def get_current_count():
    with state_lock:
        return {
            "count": current_count,
            "location": "Cámara 1",
            "device": DEVICE,
        }


@app.get("/health")
async def health():
    return {"status": "online", "device": DEVICE}