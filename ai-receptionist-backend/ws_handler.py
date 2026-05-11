import re
import json
import os
import asyncio
import traceback
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from stt import transcribe_audio
from llm import stream_llm_sentences
from tts import synthesize_speech
from database import create_call, end_call, get_config

# Hard ceiling per turn so nothing can hang the call indefinitely
TURN_TIMEOUT_S = 25

CONFIGS_DIR = os.path.join(os.path.dirname(__file__), "config")

_DAY_MAP = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def _parse_minutes(time_str: str, period: str) -> int:
    parts = time_str.split(":")
    h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    if period.lower() == "pm" and h != 12:
        h += 12
    elif period.lower() == "am" and h == 12:
        h = 0
    return h * 60 + m


def is_within_hours(working_hours: str) -> bool:
    """Return False if current time is outside working hours. Permissive on parse failure."""
    now = datetime.now()
    today = now.weekday()  # 0=Mon, 6=Sun
    current = now.hour * 60 + now.minute

    for segment in working_hours.split(","):
        m = re.match(
            r'(\w{3})(?:-(\w{3}))?\s+(\d+(?::\d+)?)(am|pm)-(\d+(?::\d+)?)(am|pm)',
            segment.strip(), re.IGNORECASE
        )
        if not m:
            return True  # unparseable — be permissive
        d_start, d_end, t_open, p_open, t_close, p_close = m.groups()
        start_day = _DAY_MAP.get(d_start[:3].lower())
        end_day = _DAY_MAP.get(d_end[:3].lower()) if d_end else start_day
        if start_day is None or end_day is None:
            return True

        in_day_range = (
            start_day <= today <= end_day if start_day <= end_day
            else today >= start_day or today <= end_day
        )
        if not in_day_range:
            continue

        open_min = _parse_minutes(t_open, p_open)
        close_min = _parse_minutes(t_close, p_close)
        return open_min <= current <= close_min

    return False  # today not covered by any segment → closed


async def load_config(client_id: str) -> dict:
    db_config = await get_config(client_id)
    if db_config:
        return db_config

    config_path = os.path.join(CONFIGS_DIR, f"{client_id}.json")
    if os.path.exists(config_path):
        with open(config_path) as f:
            return json.load(f)

    raise FileNotFoundError(f"No config found for client: {client_id}")



async def handle_session(websocket: WebSocket, client_id: str):
    await websocket.accept()
    print(f"[{client_id}] WebSocket connected")

    try:
        config = await load_config(client_id)
    except FileNotFoundError as e:
        await websocket.send_json({"error": str(e)})
        await websocket.close()
        return

    call_id = await create_call(client_id)
    conversation_history = []

    # Compute open/closed once for the whole session
    working_hours = config.get("working_hours", "")
    is_open = not working_hours or is_within_hours(working_hours)

    assistant_name = (config.get("assistant_name") or "").strip()
    business_name = config["business_name"]

    # Default greeting — natural-sounding, with required AI disclosure (US compliance).
    if assistant_name:
        default_greeting = (
            f"Hi! This is {assistant_name}, an AI assistant at {business_name}. "
            f"How can I help you today?"
        )
    else:
        default_greeting = (
            f"Hi! You've reached {business_name}. I'm an AI assistant — "
            f"how can I help you today?"
        )

    try:
        # AI speaks first.
        # If the custom greeting doesn't include the assistant's name, fall back to the
        # auto-generated default so the name is always said in the opening line.
        custom_greeting = (config.get("greeting") or "").strip()
        if custom_greeting and (not assistant_name or assistant_name.lower() in custom_greeting.lower()):
            greeting = custom_greeting
        else:
            greeting = default_greeting
        print(f"[{client_id}] Greeting: {greeting}")
        await websocket.send_json({"status": "processing"})
        await websocket.send_json({"type": "transcript", "role": "assistant", "text": greeting})
        greeting_audio = await synthesize_speech(greeting)
        await websocket.send_bytes(greeting_audio)
        conversation_history.append({"role": "assistant", "content": greeting})
        last_ai_message = greeting

        consecutive_failures = 0
        MAX_FAILURES = 2

        while True:
            audio_bytes = await websocket.receive_bytes()

            if len(audio_bytes) < 1024:
                print(f"[{client_id}] Skipped silent chunk ({len(audio_bytes)} bytes)")
                continue

            try:
                await websocket.send_json({"status": "processing"})

                # Step 1: STT — pass the AI's last message so Whisper disambiguates short replies
                user_text = await transcribe_audio(audio_bytes, last_ai_message=last_ai_message)
                if not user_text:
                    print(f"[{client_id}] STT returned empty — skipping")
                    await websocket.send_json({"status": "ready"})
                    continue

                print(f"[{client_id}] User: {user_text}")
                await websocket.send_json({"type": "transcript", "role": "user", "text": user_text})

                # Steps 2+3: LLM streaming + TTS pipelined.
                # TTS starts on sentence 1 while LLM is still generating sentence 2,
                # cutting perceived latency by ~1 second on typical responses.
                accumulated = ""
                async for sentence in stream_llm_sentences(
                    user_text, config, conversation_history,
                    call_id=call_id, client_id=client_id, is_open=is_open,
                ):
                    accumulated += (" " if accumulated else "") + sentence
                    # Update transcript progressively so the UI builds up in real time
                    await websocket.send_json({"type": "transcript", "role": "assistant", "text": accumulated})
                    audio = await synthesize_speech(sentence)
                    await websocket.send_bytes(audio)

                # Detect end-call from the last assistant history entry
                should_end = False
                for entry in reversed(conversation_history):
                    if entry.get("role") == "assistant" and entry.get("content"):
                        should_end = "[END_CALL]" in entry["content"]
                        break

                print(f"[{client_id}] Assistant: {accumulated}")
                last_ai_message = accumulated

                # Successful turn — reset the failure counter
                consecutive_failures = 0

                if should_end:
                    print(f"[{client_id}] AI ended the call")
                    await websocket.send_json({"action": "end_call"})
                    break

            except WebSocketDisconnect:
                raise
            except Exception as turn_err:
                consecutive_failures += 1
                err_str = str(turn_err)
                is_rate_limit = "rate_limit" in err_str.lower() or "429" in err_str
                print(f"[{client_id}] Turn failed (#{consecutive_failures}, rate_limit={is_rate_limit}): {turn_err}")
                traceback.print_exc()

                # Rate limit OR repeated failures → end the call gracefully, don't loop forever.
                if is_rate_limit or consecutive_failures >= MAX_FAILURES:
                    if is_rate_limit:
                        bye_msg = (
                            "I'm sorry, our system is at capacity right now. "
                            "Please try calling back in a few minutes. Thanks for your patience!"
                        )
                    else:
                        bye_msg = (
                            "I'm sorry, I'm having trouble on my end. "
                            "Please try calling back in a moment. Thank you!"
                        )
                    try:
                        await websocket.send_json({"type": "transcript", "role": "assistant", "text": bye_msg})
                        audio = await synthesize_speech(bye_msg)
                        await websocket.send_bytes(audio)
                        await websocket.send_json({"action": "end_call"})
                    except Exception:
                        pass
                    break

                # First transient failure — try to recover and continue.
                try:
                    await websocket.send_json({"status": "ready"})
                    fallback = "Sorry, I had a hiccup — could you say that again?"
                    await websocket.send_json({"type": "transcript", "role": "assistant", "text": fallback})
                    audio = await synthesize_speech(fallback)
                    await websocket.send_bytes(audio)
                    last_ai_message = fallback
                except Exception:
                    raise

    except WebSocketDisconnect:
        print(f"[{client_id}] Client disconnected")
    except Exception as e:
        print(f"[{client_id}] Error: {e}")
    finally:
        if call_id:
            await end_call(call_id, conversation_history)
            print(f"[{client_id}] Transcript saved")
