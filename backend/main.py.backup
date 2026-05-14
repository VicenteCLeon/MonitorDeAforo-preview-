import cv2
import logging
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    model = YOLO('yolov8n.pt')
    logger.info("Modelo YOLO listo.")
except Exception as e:
    logger.error(f"Error: {e}")

current_person_count = 0

def get_camera():
    for index in [1, 2, 0]:
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            logger.info(f"Conectado a la cámara en el índice: {index}")
            return cap
    return None

def generate_frames():
    global current_person_count
    cap = get_camera()
    
    if cap is None:
        logger.error("No se detectó ninguna cámara disponible.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) 

    while True:
        success, frame = cap.read()
        if not success:
            break
            
        results = model(frame, classes=0, stream=True, verbose=False)
        person_count = 0

        for r in results:
            boxes = r.boxes
            person_count = len(boxes)
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, f"Persona", (x1, y1 - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        current_person_count = person_count

        cv2.putText(frame, f"Conteo: {person_count}", (20, 50), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret: continue
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

    cap.release()

@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/counter/current")
async def get_current_count():
    return {
        "count": current_person_count,
        "location": "Cámara 1"
    }

@app.get("/health")
async def health():
    return {"status": "online"}