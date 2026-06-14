import os
import json
import asyncio
import websockets
from dotenv import load_dotenv

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Streaming endpoint — accepts µ-law/8kHz directly (no ffmpeg needed).
# endpointing=300       → finalize ~300ms after speech stops
# utterance_end_ms=1000 → backstop UtteranceEnd event if no speech_final
_DG_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-3"
    "&language=en"
    "&encoding=mulaw"
    "&sample_rate=8000"
    "&channels=1"
    "&punctuate=true"
    "&interim_results=true"
    "&endpointing=300"
    "&utterance_end_ms=1000"
    "&vad_events=true"
    "&keyterm=yes&keyterm=no&keyterm=okay&keyterm=bye&keyterm=goodbye"
)


class DeepgramStream:
    """Persistent Deepgram streaming STT for one phone call.

    Feed µ-law/8kHz chunks via send(); finalized utterances are pushed onto
    the .transcripts asyncio.Queue as plain strings. Because audio is
    transcribed as it arrives, the final transcript is ready almost the moment
    the caller stops talking — far faster than POSTing the whole clip.
    """

    def __init__(self) -> None:
        self.ws = None
        self.transcripts: asyncio.Queue[str] = asyncio.Queue()
        self._recv_task: asyncio.Task | None = None
        self._utterance = ""
        self._alive = False
        self._connecting = False

    async def connect(self) -> None:
        self.ws = await websockets.connect(
            _DG_URL,
            additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
        )
        self._alive = True
        print("[DG] connected")
        self._recv_task = asyncio.create_task(self._receive_loop())

    async def _reconnect(self) -> None:
        if self._connecting:
            return
        self._connecting = True
        try:
            print("[DG] reconnecting...")
            await self.connect()
        except Exception as e:
            print(f"[DG] reconnect failed: {e}")
        finally:
            self._connecting = False

    async def send(self, ulaw_chunk: bytes) -> None:
        # Deepgram closes the stream if it gets no audio for ~10s, so callers
        # MUST forward continuously (including silence) to keep it alive.
        if not self._alive:
            await self._reconnect()
            if not self._alive:
                return
        try:
            await self.ws.send(ulaw_chunk)
        except Exception:
            self._alive = False  # receive loop logs the reason once

    async def _receive_loop(self) -> None:
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                mtype = msg.get("type")
                if mtype == "Results":
                    alt = msg["channel"]["alternatives"][0]
                    text = alt.get("transcript", "").strip()
                    is_final = msg.get("is_final")
                    speech_final = msg.get("speech_final")
                    if text:
                        print(f"[DG] '{text}' final={is_final} speech_final={speech_final}")
                    if text and is_final:
                        self._utterance = (self._utterance + " " + text).strip()
                    if speech_final and self._utterance:
                        await self.transcripts.put(self._utterance)
                        self._utterance = ""
                elif mtype == "UtteranceEnd":
                    print(f"[DG] UtteranceEnd (buffered='{self._utterance}')")
                    if self._utterance:
                        await self.transcripts.put(self._utterance)
                        self._utterance = ""
                elif mtype in ("Metadata", "SpeechStarted"):
                    pass
                else:
                    print(f"[DG] event: {mtype}")
        except Exception as e:
            print(f"[DG] receive loop ended: {e}")
        finally:
            self._alive = False

    async def close(self) -> None:
        self._alive = False
        try:
            if self.ws is not None:
                await self.ws.send(json.dumps({"type": "CloseStream"}))
                await self.ws.close()
        except Exception:
            pass
        if self._recv_task is not None:
            self._recv_task.cancel()
