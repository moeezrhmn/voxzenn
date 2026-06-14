import asyncio
import base64
import json
from fastapi import WebSocket

# G.711 µ-law, 8kHz, mono — used by both Twilio and Telnyx
SAMPLE_RATE = 8000

SILENCE_THRESHOLD = 500
SILENCE_CHUNKS = 35       # 35 × 20ms = 700ms
MIN_SPEECH_CHUNKS = 5     # 5  × 20ms = 100ms
MAX_SPEECH_CHUNKS = 400   # 400 × 20ms = 8s
BARGE_IN_CHUNKS = 6       # 6  × 20ms = 120ms sustained speech to interrupt
# While the AI is talking, the caller's mic also picks up the AI's own voice
# (echo). Require LOUDER audio to count as a real interruption so the AI doesn't
# cut itself off. Real speech measured ~600-1600 RMS; echo is quieter.
BARGE_IN_THRESHOLD = 1000


def _ulaw_to_linear(byte: int) -> int:
    u = ~byte & 0xFF
    sign = u & 0x80
    exp = (u >> 4) & 0x07
    mantissa = u & 0x0F
    magnitude = (mantissa << (exp + 3)) + (0x84 << exp)
    return -magnitude if sign else magnitude


def chunk_rms(ulaw_bytes: bytes) -> float:
    if not ulaw_bytes:
        return 0.0
    total = sum(_ulaw_to_linear(b) ** 2 for b in ulaw_bytes)
    return (total / len(ulaw_bytes)) ** 0.5


async def ulaw_to_wav(ulaw_bytes: bytes) -> bytes:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y",
        "-f", "mulaw", "-ar", "8000", "-ac", "1", "-i", "pipe:0",
        "-f", "wav", "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    wav, _ = await proc.communicate(input=ulaw_bytes)
    return wav


async def mp3_to_ulaw(mp3_bytes: bytes) -> bytes:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y",
        "-i", "pipe:0",
        "-ar", "8000", "-ac", "1", "-f", "mulaw", "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    ulaw, _ = await proc.communicate(input=mp3_bytes)
    return ulaw


async def send_audio(ws: WebSocket, stream_sid: str, ulaw_bytes: bytes) -> None:
    payload = base64.b64encode(ulaw_bytes).decode()
    await ws.send_text(json.dumps({
        "event": "media",
        "streamSid": stream_sid,
        "media": {"payload": payload},
    }))
