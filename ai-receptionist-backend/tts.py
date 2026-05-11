import io
import asyncio
import edge_tts

# Microsoft's "Multilingual" neural voices — noticeably more natural and conversational
# than the older Jenny / Aria models. Still free via edge-tts.
#
# Other strong options to try:
#   en-US-EmmaMultilingualNeural    — warmer, more upbeat female
#   en-US-AndrewMultilingualNeural  — natural male
#   en-US-BrianMultilingualNeural   — warm, engaging male
#   en-US-AvaMultilingualNeural     — calm, professional female  ← current
DEFAULT_VOICE = "en-US-AvaMultilingualNeural"

# Hard ceiling so a hung TTS websocket can never stall the call.
TTS_TIMEOUT_S = 15


async def _synthesize(text: str, voice: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice=voice)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()


async def synthesize_speech(text: str, voice: str | None = None) -> bytes:
    return await asyncio.wait_for(
        _synthesize(text, voice or DEFAULT_VOICE),
        timeout=TTS_TIMEOUT_S,
    )
