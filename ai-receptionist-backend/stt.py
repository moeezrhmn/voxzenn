import os
import httpx
from dotenv import load_dotenv

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


async def transcribe_audio(
    audio_bytes: bytes,
    last_ai_message: str = "",
    content_type: str = "audio/webm",
) -> str | None:
    """Transcribe audio with Deepgram Nova-3.

    `content_type` defaults to "audio/webm" for browser WebSocket calls.
    Pass "audio/wav" when audio comes from the Twilio adapter (µ-law → WAV conversion).
    `last_ai_message` is accepted for API compatibility but not currently used.
    """
    if not DEEPGRAM_API_KEY:
        print("[STT] DEEPGRAM_API_KEY not set in .env")
        return None

    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": content_type,
    }

    # Repeated query params for keyterm — Nova-3 feature that boosts recognition
    # of these specific words. Helps with the short single-word reply problem.
    params = [
        ("model", "nova-3"),
        ("language", "en"),
        ("punctuate", "true"),
        ("keyterm", "yes"),
        ("keyterm", "no"),
        ("keyterm", "okay"),
        ("keyterm", "sure"),
        ("keyterm", "nope"),
        ("keyterm", "bye"),
        ("keyterm", "goodbye"),
    ]

    print(f"[STT] audio={len(audio_bytes)} bytes")

    try:
        async with httpx.AsyncClient(timeout=30) as http:
            response = await http.post(
                DEEPGRAM_URL,
                headers=headers,
                params=params,
                content=audio_bytes,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as e:
        print(f"[STT] Deepgram request failed: {e}")
        return None

    try:
        alternatives = data["results"]["channels"][0]["alternatives"]
        alternative = alternatives[0]
        transcript = alternative.get("transcript", "").strip()
        confidence = alternative.get("confidence", 0.0)
        words = alternative.get("words", [])
        # Log all alternatives so we can see what Deepgram considered
        for i, alt in enumerate(alternatives):
            print(f"[STT] alt[{i}] '{alt.get('transcript','').strip()}' (confidence: {alt.get('confidence', 0):.2f})")
        # Log word-level confidence for short responses (the tricky ones)
        if words and len(words) <= 2:
            for w in words:
                print(f"[STT] word '{w.get('word')}' confidence={w.get('confidence', 0):.2f} punct='{w.get('punctuated_word', '')}'")
    except (KeyError, IndexError) as e:
        print(f"[STT] Unexpected Deepgram response shape: {e}")
        print(f"[STT] Raw response: {data}")
        return None

    if not transcript:
        print("[STT] Empty transcript returned")
        return None

    print(f"[STT] Final: '{transcript}' (confidence: {confidence:.2f})")
    return transcript
