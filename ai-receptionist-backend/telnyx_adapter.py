import asyncio
import base64
import json
import os
import httpx
from fastapi import WebSocket, WebSocketDisconnect
from database import create_call, end_call
from llm import stream_llm_sentences
from tts import synthesize_speech
from ws_handler import load_config, is_within_hours
from deepgram_stream import DeepgramStream
from phone_audio import SAMPLE_RATE, BARGE_IN_THRESHOLD, chunk_rms, mp3_to_ulaw


async def _hangup_call(call_control_id: str) -> None:
    """Hang up the actual phone call via Telnyx Call Control API.

    Closing the media-stream WebSocket alone does NOT end the call — Telnyx
    keeps the call up and re-dials the stream. We must explicitly hang up.
    """
    api_key = os.getenv("TELNYX_API_KEY")
    if not api_key or not call_control_id:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            await http.post(
                f"https://api.telnyx.com/v2/calls/{call_control_id}/actions/hangup",
                headers={"Authorization": f"Bearer {api_key}"},
            )
    except Exception as e:
        print(f"[Telnyx] hangup request failed: {e}")


async def _send_audio(ws: WebSocket, _stream_id: str, ulaw_bytes: bytes) -> None:
    # With bidirectionalMode=rtp, Telnyx buffers and paces playback itself.
    # Send in one message — submissions are rate-limited to ~once per second.
    payload = base64.b64encode(ulaw_bytes).decode()
    await ws.send_text(json.dumps({
        "event": "media",
        "media": {"payload": payload},
    }))


# Cache synthesized greetings by text — the greeting is static per business, so
# we only pay the TTS + conversion cost once, not on every call.
_greeting_cache: dict[str, bytes] = {}


async def _get_greeting_ulaw(text: str) -> bytes:
    cached = _greeting_cache.get(text)
    if cached is not None:
        return cached
    ulaw = await mp3_to_ulaw(await synthesize_speech(text))
    _greeting_cache[text] = ulaw
    return ulaw


def texml_response(ws_url: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        "<Connect>"
        f'<Stream url="{ws_url}" '
        'bidirectionalMode="rtp" '
        'bidirectionalCodec="PCMU" '
        'bidirectionalSamplingRate="8000" />'
        "</Connect>"
        "</Response>"
    )


async def handle_telnyx_stream(websocket: WebSocket, client_id: str) -> None:
    await websocket.accept()
    print(f"[Telnyx/{client_id}] connected")

    try:
        config = await load_config(client_id)
    except FileNotFoundError:
        await websocket.close()
        return

    call_id = await create_call(client_id)
    conversation_history: list[dict] = []

    working_hours = config.get("working_hours", "")
    is_open = not working_hours or is_within_hours(working_hours)

    assistant_name = (config.get("assistant_name") or "").strip()
    business_name = config["business_name"]

    if assistant_name:
        default_greeting = (
            f"Hi! This is {assistant_name}, an AI assistant at {business_name}. "
            "How can I help you today?"
        )
    else:
        default_greeting = (
            f"Hi! You've reached {business_name}. I'm an AI assistant — "
            "how can I help you today?"
        )

    custom_greeting = (config.get("greeting") or "").strip()
    greeting_text = (
        custom_greeting
        if custom_greeting and (not assistant_name or assistant_name.lower() in custom_greeting.lower())
        else default_greeting
    )
    last_ai_message = greeting_text

    # Pre-synthesize greeting so it plays instantly when the stream opens.
    # Cached after the first call, so this is near-instant on subsequent calls.
    _t = asyncio.get_running_loop().time()
    print(f"[Telnyx/{client_id}] preparing greeting...")
    greeting_ulaw = await _get_greeting_ulaw(greeting_text)
    print(f"[Telnyx/{client_id}] greeting ready ({len(greeting_ulaw)} bytes) "
          f"in {asyncio.get_running_loop().time() - _t:.2f}s")

    loop = asyncio.get_running_loop()
    stream_sid: str | None = None
    call_control_id: str | None = None
    greeting_done = False
    playback_until = 0.0  # monotonic time the AI audio finishes playing
    session_ended = asyncio.Event()

    dg = DeepgramStream()
    await dg.connect()

    async def stop_playback() -> None:
        nonlocal playback_until
        playback_until = 0.0
        try:
            await websocket.send_text(json.dumps({"event": "clear"}))
        except Exception:
            pass

    async def receive_task() -> None:
        """Telnyx → us. Forward caller audio to Deepgram in real time."""
        nonlocal stream_sid, call_control_id, playback_until, greeting_done
        try:
            while not session_ended.is_set():
                try:
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                except asyncio.TimeoutError:
                    print(f"[Telnyx/{client_id}] receive timeout")
                    break
                data = json.loads(raw)
                event = data.get("event")
                if event == "start":
                    stream_sid = data.get("stream_id", "")
                    start_obj = data.get("start") or {}
                    call_control_id = (
                        data.get("call_control_id")
                        or start_obj.get("call_control_id")
                    )
                    print(f"[Telnyx/{client_id}] stream started: {stream_sid} "
                          f"(call_control_id={call_control_id})")
                    # play the pre-synthesized greeting immediately
                    await _send_audio(websocket, stream_sid, greeting_ulaw)
                    conversation_history.append({"role": "assistant", "content": greeting_text})
                    playback_until = loop.time() + len(greeting_ulaw) / SAMPLE_RATE
                    greeting_done = True
                    print(f"[Telnyx/{client_id}] greeting sent, listening...")
                elif event == "media":
                    if not greeting_done:
                        continue
                    chunk = base64.b64decode(data["media"]["payload"])
                    # While the AI is talking, replace quiet audio (its own echo)
                    # with µ-law silence — so Deepgram doesn't transcribe the AI
                    # back, but still gets a steady stream and won't time out.
                    # Loud audio (a real interruption) passes through untouched.
                    if loop.time() < playback_until and chunk_rms(chunk) < BARGE_IN_THRESHOLD:
                        chunk = b"\xff" * len(chunk)
                    await dg.send(chunk)
                elif event == "stop":
                    print(f"[Telnyx/{client_id}] stream stopped")
                    break
        except WebSocketDisconnect:
            print(f"[Telnyx/{client_id}] disconnected")
        except Exception as e:
            print(f"[Telnyx/{client_id}] receive error: {e}")
        finally:
            session_ended.set()

    async def respond_task() -> None:
        """Deepgram transcripts → LLM → TTS → back to the caller."""
        nonlocal last_ai_message, playback_until
        ended = asyncio.create_task(session_ended.wait())
        try:
            while not session_ended.is_set():
                get = asyncio.create_task(dg.transcripts.get())
                await asyncio.wait(
                    [get, ended],
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if session_ended.is_set():
                    get.cancel()
                    break
                user_text = get.result()
                if not user_text:
                    continue

                t0 = loop.time()

                # real words while the AI is still talking → genuine barge-in
                if loop.time() < playback_until:
                    print(f"[Telnyx/{client_id}] barge-in")
                    await stop_playback()

                print(f"[Telnyx/{client_id}] user: {user_text}")

                try:
                    full_response = ""
                    total_ulaw_bytes = 0
                    first_audio_sent = False

                    async for sentence in stream_llm_sentences(
                        user_text, config, conversation_history,
                        call_id=call_id, client_id=client_id, is_open=is_open,
                    ):
                        full_response += (" " if full_response else "") + sentence
                        mp3 = await synthesize_speech(sentence)
                        ulaw = await mp3_to_ulaw(mp3)
                        await _send_audio(websocket, stream_sid, ulaw)
                        total_ulaw_bytes += len(ulaw)
                        if not first_audio_sent:
                            first_audio_sent = True
                            print(f"[timing] response={loop.time() - t0:.2f}s")

                    last_ai_message = full_response
                    print(f"[Telnyx/{client_id}] assistant: {full_response}")

                    playback_until = loop.time() + total_ulaw_bytes / SAMPLE_RATE
                    # discard anything transcribed while we were synthesizing
                    while not dg.transcripts.empty():
                        dg.transcripts.get_nowait()

                    should_end = any(
                        "[END_CALL]" in (e.get("content") or "")
                        for e in reversed(conversation_history)
                        if e.get("role") == "assistant"
                    )
                    if should_end:
                        print(f"[Telnyx/{client_id}] AI ended the call")
                        # let the goodbye finish, then hang up the phone call
                        await asyncio.sleep(total_ulaw_bytes / SAMPLE_RATE + 0.5)
                        await _hangup_call(call_control_id)
                        session_ended.set()
                        break

                except Exception as e:
                    print(f"[Telnyx/{client_id}] turn error: {e}")
        finally:
            ended.cancel()
            session_ended.set()

    receiver = asyncio.create_task(receive_task())
    responder = asyncio.create_task(respond_task())

    try:
        await asyncio.wait(
            [receiver, responder],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in (receiver, responder):
            task.cancel()
    except Exception as e:
        print(f"[Telnyx/{client_id}] session error: {e}")
    finally:
        await dg.close()
        if call_id:
            await end_call(call_id, conversation_history)
            print(f"[Telnyx/{client_id}] transcript saved")
