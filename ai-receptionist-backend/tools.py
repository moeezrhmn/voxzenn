import re
from datetime import datetime, timedelta
from database import save_booking

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": (
                "Book an appointment for the caller. CRITICAL: Only call this AFTER the caller has explicitly confirmed "
                "the booking in their LAST message — do NOT call this in the same response where you propose a time or "
                "summarize details. If the caller asks to change details later in the call, call this again with the "
                "updated details and it will update their existing booking instead of creating a duplicate."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_name": {
                        "type": "string",
                        "description": "Full name of the caller, properly cased (e.g. 'Sarah Johnson').",
                    },
                    "phone": {
                        "type": "string",
                        "description": "Phone number, digits only (no spaces or dashes). E.g. '5551234567'.",
                    },
                    "day": {
                        "type": "string",
                        "description": (
                            "Appointment date as ISO YYYY-MM-DD (e.g. '2026-05-05'). "
                            "ALWAYS resolve relative phrases ('today', 'tomorrow', 'next Tuesday', 'this Friday') "
                            "to the absolute date using the current date provided in the system prompt. "
                            "Never pass literal words like 'tomorrow' or 'Tuesday' here."
                        ),
                    },
                    "time": {
                        "type": "string",
                        "description": "Appointment time in 24-hour HH:MM format (e.g. '14:30' for 2:30 PM, '09:00' for 9 AM).",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for visit (optional, e.g. 'haircut', 'gel manicure').",
                    },
                },
                "required": ["patient_name", "phone", "day", "time"],
            },
        },
    }
]


_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def normalize_phone(phone: str) -> str:
    """Strip everything except digits and a leading +."""
    if not phone:
        return ""
    cleaned = re.sub(r"[^\d+]", "", phone)
    # Keep + only if it's at the start
    if "+" in cleaned[1:]:
        cleaned = cleaned[0] + cleaned[1:].replace("+", "")
    return cleaned


def normalize_day(day: str) -> str:
    """Return an ISO YYYY-MM-DD date.
    Trusts the LLM to send ISO, but defends against relative phrases as a safety net."""
    raw = (day or "").strip()
    if not raw:
        return raw

    # Already ISO? Validate and return.
    try:
        return datetime.strptime(raw, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        pass

    today = datetime.now()
    lower = raw.lower()

    if lower == "today":
        return today.strftime("%Y-%m-%d")
    if lower == "tomorrow":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # Weekday name → next occurrence (today doesn't count)
    for name in _WEEKDAYS:
        if name in lower:
            target = _WEEKDAYS.index(name)
            days_ahead = (target - today.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7
            return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # Try common alternative formats
    for fmt in ("%B %d %Y", "%B %d, %Y", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Couldn't parse — return raw so the booking still saves (better than losing it)
    return raw


def normalize_time(time: str) -> str:
    """Return 24-hour HH:MM."""
    raw = (time or "").strip()
    if not raw:
        return raw

    # Already HH:MM 24h?
    try:
        return datetime.strptime(raw, "%H:%M").strftime("%H:%M")
    except ValueError:
        pass

    # Try common 12-hour variants. Strip dots ("a.m." → "AM") for parser.
    cleaned = raw.upper().replace(".", "").replace("  ", " ").strip()
    for fmt in ("%I:%M %p", "%I %p", "%I:%M%p", "%I%p", "%H:%M:%S"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%H:%M")
        except ValueError:
            continue

    # Last resort — return raw so the booking still saves
    return raw


async def execute_tool(
    tool_name: str,
    args: dict,
    call_id: str | None = None,
    client_id: str | None = None,
) -> str:
    if tool_name == "book_appointment":
        return await book_appointment(
            **args,
            call_id=call_id,
            client_id=client_id,
        )
    return f"Unknown tool: {tool_name}"


async def book_appointment(
    patient_name: str,
    phone: str,
    day: str,
    time: str,
    reason: str = "",
    call_id: str | None = None,
    client_id: str | None = None,
) -> str:
    booking = {
        "patient_name": (patient_name or "").strip(),
        "phone": normalize_phone(phone),
        "day": normalize_day(day),
        "time": normalize_time(time),
        "reason": (reason or "").strip(),
    }

    await save_booking(
        client_id=client_id or "unknown",
        call_id=call_id or "",
        booking=booking,
    )

    print(f"[BOOKING] Saved: {booking['patient_name']} — {booking['day']} at {booking['time']}")

    # Friendly human-readable confirmation back to the LLM
    try:
        d = datetime.strptime(booking["day"], "%Y-%m-%d").strftime("%A, %B %-d")
    except ValueError:
        d = booking["day"]
    try:
        t = datetime.strptime(booking["time"], "%H:%M").strftime("%-I:%M %p")
    except ValueError:
        t = booking["time"]

    return f"Appointment booked successfully for {booking['patient_name']} on {d} at {t}."
