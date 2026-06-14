import asyncio
import base64
import json
from fastapi import WebSocket, WebSocketDisconnect
from database import create_call, end_call
from llm import stream_llm_sentences
from tts import synthesize_speech
from stt import transcribe_audio
from ws_handler import load_config, is_within_hours
from phone_audio import (
    SAMPLE_RATE, SILENCE_THRESHOLD, SILENCE_CHUNKS,
    MIN_SPEECH_CHUNKS, MAX_SPEECH_CHUNKS,
    chunk_rms, ulaw_to_wav, mp3_to_ulaw, send_audio,
)


def twiml_response(ws_url: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f'<Connect><Stream url="{ws_url}" /></Connect>'
        "</Response>"
    )


async def handle_twilio_stream(websocket: WebSocket, client_id: str) -> None:
    await websocket.accept()
    print(f"[Twilio/{client_id}] connected")

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

    print(f"[Twilio/{client_id}] pre-synthesizing greeting...")
    greeting_ulaw = await mp3_to_ulaw(await synthesize_speech(greeting_text))
    print(f"[Twilio/{client_id}] greeting ready ({len(greeting_ulaw)} bytes)")

    stream_sid: str | None = None
    is_speaking = False
    session_ended = asyncio.Event()
    audio_queue: asyncio.Queue[tuple[str, bytes | None]] = asyncio.Queue()

    async def receive_task() -> None:
        nonlocal stream_sid
        try:
            while not session_ended.is_set():
                try:
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                except asyncio.TimeoutError:
                    print(f"[Twilio/{client_id}] receive timeout")
                    await audio_queue.put(("stop", None))
                    break
                data = json.loads(raw)
                event = data.get("event")
                if event == "start":
                    stream_sid = data["start"]["streamSid"]
                    print(f"[Twilio/{client_id}] stream started: {stream_sid}")
                    await audio_queue.put(("start", None))
                elif event == "media":
                    chunk = base64.b64decode(data["media"]["payload"])
                    await audio_queue.put(("media", chunk))
                elif event == "stop":
                    print(f"[Twilio/{client_id}] stream stopped")
                    await audio_queue.put(("stop", None))
                    break
        except WebSocketDisconnect:
            print(f"[Twilio/{client_id}] disconnected")
            await audio_queue.put(("disconnect", None))
        except Exception as e:
            print(f"[Twilio/{client_id}] receive error: {e}")
            await audio_queue.put(("disconnect", None))

    async def process_task() -> None:
        nonlocal is_speaking, last_ai_message, stream_sid

        audio_buffer = bytearray()
        speech_chunks = 0
        silence_chunks = 0
        in_speech = False
        greeting_done = False

        while True:
            event_type, chunk = await audio_queue.get()

            if event_type in ("stop", "disconnect"):
                break

            if event_type == "start":
                is_speaking = True
                try:
                    await send_audio(websocket, stream_sid, greeting_ulaw)
                    conversation_history.append({"role": "assistant", "content": greeting_text})
                    await asyncio.sleep(len(greeting_ulaw) / SAMPLE_RATE + 0.4)
                    while not audio_queue.empty():
                        audio_queue.get_nowait()
                    greeting_done = True
                except Exception as e:
                    print(f"[Twilio/{client_id}] greeting error: {e}")
                finally:
                    is_speaking = False
                continue

            if event_type == "media":
                if is_speaking or not greeting_done:
                    continue

                assert chunk is not None
                is_speech_frame = chunk_rms(chunk) > SILENCE_THRESHOLD

                if is_speech_frame:
                    if not in_speech:
                        in_speech = True
                        audio_buffer = bytearray()
                        speech_chunks = 0
                        silence_chunks = 0
                    audio_buffer.extend(chunk)
                    speech_chunks += 1
                    silence_chunks = 0
                elif in_speech:
                    audio_buffer.extend(chunk)
                    silence_chunks += 1

                    end_of_speech = (
                        silence_chunks >= SILENCE_CHUNKS
                        or speech_chunks >= MAX_SPEECH_CHUNKS
                    )
                    if not end_of_speech:
                        continue

                    in_speech = False

                    if speech_chunks < MIN_SPEECH_CHUNKS:
                        audio_buffer = bytearray()
                        speech_chunks = 0
                        silence_chunks = 0
                        continue

                    is_speaking = True
                    utterance = bytes(audio_buffer)
                    audio_buffer = bytearray()
                    speech_chunks = 0
                    silence_chunks = 0

                    try:
                        wav = await ulaw_to_wav(utterance)
                        user_text = await transcribe_audio(
                            wav, content_type="audio/wav", last_ai_message=last_ai_message,
                        )

                        if not user_text:
                            continue

                        print(f"[Twilio/{client_id}] user: {user_text}")

                        if stream_sid:
                            try:
                                await websocket.send_text(json.dumps({
                                    "event": "clear", "streamSid": stream_sid,
                                }))
                            except Exception:
                                pass

                        full_response = ""
                        total_ulaw_bytes = 0

                        async for sentence in stream_llm_sentences(
                            user_text, config, conversation_history,
                            call_id=call_id, client_id=client_id, is_open=is_open,
                        ):
                            full_response += (" " if full_response else "") + sentence
                            mp3 = await synthesize_speech(sentence)
                            ulaw = await mp3_to_ulaw(mp3)
                            await send_audio(websocket, stream_sid, ulaw)
                            total_ulaw_bytes += len(ulaw)

                        last_ai_message = full_response
                        print(f"[Twilio/{client_id}] assistant: {full_response}")

                        await asyncio.sleep(total_ulaw_bytes / SAMPLE_RATE + 0.4)
                        while not audio_queue.empty():
                            audio_queue.get_nowait()

                        should_end = any(
                            "[END_CALL]" in (e.get("content") or "")
                            for e in reversed(conversation_history)
                            if e.get("role") == "assistant"
                        )
                        if should_end:
                            print(f"[Twilio/{client_id}] AI ended the call")
                            session_ended.set()
                            break

                    except Exception as e:
                        print(f"[Twilio/{client_id}] turn error: {e}")
                    finally:
                        is_speaking = False

        session_ended.set()

    receiver = asyncio.create_task(receive_task())
    processor = asyncio.create_task(process_task())

    try:
        done, pending = await asyncio.wait(
            [receiver, processor],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    except Exception as e:
        print(f"[Twilio/{client_id}] session error: {e}")
    finally:
        if call_id:
            await end_call(call_id, conversation_history)
            print(f"[Twilio/{client_id}] transcript saved")
