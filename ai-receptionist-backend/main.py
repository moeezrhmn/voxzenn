import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ws_handler import handle_session
from database import get_pool, get_config, upsert_config, run_migrations


class ConfigPayload(BaseModel):
    user_id: str
    business_name: str
    role: str = "receptionist"
    personality: str = "warm, professional"
    capabilities: list[str] = ["book appointments", "answer FAQs"]
    working_hours: str = "Mon-Fri 9am-6pm"
    greeting: str = ""
    faqs: dict = {}
    assistant_name: str = ""


def serialize(obj):
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, list):
        return [serialize(i) for i in obj]
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    return obj


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_migrations()
    yield


app = FastAPI(title="Voxzenn API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://voxzenn.quanter.dev",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await handle_session(websocket, client_id)


@app.get("/calls/{client_id}")
async def get_calls(client_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM calls WHERE client_id = $1 ORDER BY started_at DESC",
        client_id
    )
    return [serialize(dict(r)) for r in rows]


@app.get("/bookings/{client_id}")
async def get_bookings(client_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM bookings WHERE client_id = $1 ORDER BY created_at DESC",
        client_id
    )
    return [serialize(dict(r)) for r in rows]


@app.get("/config/{client_id}")
async def get_config_endpoint(client_id: str):
    config = await get_config(client_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@app.put("/config/{client_id}")
async def upsert_config_endpoint(client_id: str, payload: ConfigPayload):
    return await upsert_config(client_id, payload.user_id, {
        "business_name": payload.business_name,
        "role": payload.role,
        "personality": payload.personality,
        "capabilities": payload.capabilities,
        "working_hours": payload.working_hours,
        "greeting": payload.greeting,
        "faqs": payload.faqs,
        "assistant_name": payload.assistant_name,
    })
