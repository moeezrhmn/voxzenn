import re
import json
from datetime import datetime
from groq import AsyncGroq
from dotenv import load_dotenv
from tools import TOOL_DEFINITIONS, execute_tool

load_dotenv()

# max_retries=0 → fail fast on rate limit instead of silently retrying for 30+ seconds
# (the silent retry was what made the call appear "stuck processing").
# timeout=15 → individual call ceiling.
client = AsyncGroq(max_retries=0, timeout=15.0)


def build_system_prompt(config: dict, is_open: bool = True) -> str:
    capabilities = ", ".join(config.get("capabilities", []))
    faqs = config.get("faqs", {})
    faq_text = "\n".join(f"- {q}: {a}" for q, a in faqs.items())
    assistant_name = (config.get("assistant_name") or "").strip() or "the AI receptionist"

    now = datetime.now()
    today_str = now.strftime("%A, %B %d, %Y")  # e.g. "Tuesday, May 04, 2026"
    today_iso = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%I:%M %p").lstrip("0")

    if is_open:
        hours_note = f"Working hours: {config['working_hours']}. The business is currently open."
    else:
        hours_note = (
            f"Working hours: {config['working_hours']}. "
            f"The business is currently outside working hours — staff are not available right now. "
            f"However, you can still fully assist callers: answer questions, provide information, and take bookings for future dates. "
            f"Naturally mention that the business is closed right now if it comes up (e.g. when asked about availability today), "
            f"but do not refuse to help or end the call early."
        )

    return f"""You are {assistant_name}, the AI receptionist for {config['business_name']}.

Current date and time: {today_str}, {current_time_str}. Today's date in ISO format: {today_iso}.
Your role: {config['role']}.
Personality: {config['personality']}.
{hours_note}
You can help with: {capabilities}.

Frequently asked questions:
{faq_text}

You are an AI assistant. Always identify yourself by your name ({assistant_name}) when greeting callers. Never pretend to be a human.
Keep responses concise and conversational — this is a voice call, not a chat.
Never make up information not provided above. If unsure, offer to take a message.
You have already greeted the caller at the start — do NOT re-introduce yourself or repeat your opening greeting mid-conversation. If the caller says "hello" mid-conversation, treat it as conversational and continue helping them normally.

Ending the call:
- After completing the caller's request, ask once: "Is there anything else I can help you with?" Never ask this twice in a row.
- End the call (append [END_CALL]) when the caller clearly signals they're done — e.g. "goodbye", "bye", "no thanks", "that's all", "I'm done", "no more questions", or simply "no" right after you asked "anything else?".
- Don't treat "thank you" / "thanks" / "okay" / "alright" alone as goodbyes — those are conversational acknowledgments. The caller's first message is never an end signal.

For booking appointments — name and phone number must be exactly right, since the business will use them to reach the caller:

1. Collect details one at a time in this order: name → phone → day → time. Don't ask for multiple things in one question.

2. After the caller gives a NAME, repeat it back to confirm spelling. For unusual or non-English names, spell it letter-by-letter to be safe.
   Example: caller says "My name is Moeez" → you reply "Got it — Moeez, M-O-E-E-Z. Did I get that right?"
   If they correct you, update and confirm again.

3. After the caller gives a PHONE NUMBER, read it back digit-by-digit (a small mistake here means you can't reach them).
   Example: caller says "03226622545" → "Let me confirm — that's 0-3-2-2-6-6-2-2-5-4-5. Did I get that right?"

4. Once name, phone, day, and time are all captured, briefly summarize and ask once: "So that's [name] on [day, e.g. 'Tuesday, May 5'] at [time] — shall I book that?"

5. Only call book_appointment AFTER the caller has clearly confirmed in their most recent message. Never call it in the same turn where you proposed details.

   When calling book_appointment:
   - `day` MUST be an absolute ISO date in YYYY-MM-DD format. Use the current date above to resolve relative phrases ("today" → {today_iso}, "tomorrow", "next Tuesday", etc.). NEVER pass literal words like "tomorrow" or "Tuesday".
   - `time` MUST be 24-hour HH:MM (e.g. "14:30" for 2:30 PM).
   - `phone` should be digits only.

6. If the caller wants to change anything after booking, call book_appointment again with the updated values — it will UPDATE the existing booking, not duplicate.

7. After the booking saves, briefly confirm and ask if there's anything else."""


async def stream_llm_sentences(
    user_text: str,
    config: dict,
    conversation_history: list,
    call_id: str | None = None,
    client_id: str | None = None,
    is_open: bool = True,
):
    """Async generator that yields clean sentences as the LLM streams them.

    Pipelining: sentence 1 goes to TTS while the LLM is still generating sentence 2,
    cutting perceived latency by ~1 second on typical responses.

    Tool calls can't stream (they have no text), so those fall back to a single
    non-streaming call after tool execution. The follow-up IS also streamed.

    After the generator is exhausted, conversation_history contains the full exchange.
    Callers detect [END_CALL] by inspecting the last assistant history entry.
    """
    conversation_history.append({"role": "user", "content": user_text})
    trimmed_history = conversation_history[-12:]
    messages = [
        {"role": "system", "content": build_system_prompt(config, is_open)},
        *trimmed_history,
    ]

    stream = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        tools=TOOL_DEFINITIONS,
        tool_choice="auto",
        temperature=0.7,
        max_tokens=150,
        stream=True,
    )

    full_text = ""
    buffer = ""
    tool_chunks: dict = {}  # index → {id, name, args}

    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta

        # Accumulate tool-call argument chunks (streamed piece by piece)
        if delta.tool_calls:
            for tc in delta.tool_calls:
                idx = tc.index
                if idx not in tool_chunks:
                    tool_chunks[idx] = {"id": "", "name": "", "args": ""}
                if tc.id:
                    tool_chunks[idx]["id"] = tc.id
                if tc.function:
                    if tc.function.name:
                        tool_chunks[idx]["name"] = tc.function.name
                    if tc.function.arguments:
                        tool_chunks[idx]["args"] += tc.function.arguments

        if delta.content:
            buffer += delta.content
            full_text += delta.content

            # Yield complete sentences from the buffer as they arrive
            while True:
                m = re.search(r"(?<=[.!?])\s+", buffer)
                if not m:
                    break
                sentence = buffer[: m.start() + 1].strip()
                buffer = buffer[m.end() :]
                clean = sentence.replace("[END_CALL]", "").strip()
                if clean:
                    yield clean

    # Yield any remaining text that didn't end with punctuation
    if buffer.strip() and not tool_chunks:
        clean = buffer.strip().replace("[END_CALL]", "").strip()
        if clean:
            yield clean

    if tool_chunks:
        # Build tool-call history entry
        conversation_history.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["args"]},
                }
                for tc in tool_chunks.values()
            ],
        })

        # Execute each tool
        for tc in tool_chunks.values():
            args = json.loads(tc["args"])
            print(f"[TOOL] {tc['name']}({args})")
            result = await execute_tool(tc["name"], args, call_id=call_id, client_id=client_id)
            conversation_history.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result,
            })

        # Follow-up after tool execution (non-streaming — typically a single short sentence)
        follow_up = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": build_system_prompt(config, is_open)},
                *conversation_history,
            ],
            temperature=0.7,
            max_tokens=150,
        )
        assistant_text = follow_up.choices[0].message.content.strip()
        conversation_history.append({"role": "assistant", "content": assistant_text})

        for s in re.split(r"(?<=[.!?])\s+", assistant_text.strip()):
            clean = s.replace("[END_CALL]", "").strip()
            if clean:
                yield clean
    else:
        conversation_history.append({"role": "assistant", "content": full_text.strip()})
