import json
import uuid
import os
import asyncpg
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection):
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec("json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"), init=_init_connection)
    return _pool


async def run_migrations():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email         TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS configs (
                client_id     TEXT PRIMARY KEY,
                user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
                business_name TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'receptionist',
                personality   TEXT NOT NULL DEFAULT 'warm, professional',
                capabilities  JSONB NOT NULL DEFAULT '[]',
                working_hours TEXT NOT NULL DEFAULT 'Mon-Fri 9am-6pm',
                greeting      TEXT,
                faqs          JSONB NOT NULL DEFAULT '{}',
                updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS calls (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id   TEXT NOT NULL,
                started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ended_at    TIMESTAMPTZ,
                transcript  JSONB NOT NULL DEFAULT '[]',
                summary     TEXT
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id    TEXT NOT NULL,
                call_id      UUID REFERENCES calls(id) ON DELETE SET NULL,
                patient_name TEXT NOT NULL,
                phone        TEXT,
                day          TEXT NOT NULL,
                time         TEXT NOT NULL,
                reason       TEXT,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS calls_client_idx ON calls(client_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS bookings_client_idx ON bookings(client_id)")
        await conn.execute("ALTER TABLE configs ADD COLUMN IF NOT EXISTS assistant_name TEXT NOT NULL DEFAULT ''")
    print("[DB] Migrations complete")


def _row(record) -> dict:
    """Convert asyncpg Record to a JSON-safe dict."""
    result = {}
    for k, v in dict(record).items():
        if isinstance(v, uuid.UUID):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        elif isinstance(v, list):
            result[k] = [str(i) if isinstance(i, uuid.UUID) else i for i in v]
        else:
            result[k] = v
    return result


# ── Calls ──────────────────────────────────────────────────────

async def create_call(client_id: str) -> str | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO calls (client_id, transcript) VALUES ($1, $2) RETURNING id",
        client_id, []
    )
    if row:
        call_id = str(row["id"])
        print(f"[DB] Call started: {call_id}")
        return call_id
    return None


async def end_call(call_id: str, transcript: list):
    pool = await get_pool()
    await pool.execute(
        "UPDATE calls SET transcript = $1, ended_at = NOW() WHERE id = $2::uuid",
        transcript, call_id
    )
    print(f"[DB] Call ended: {call_id}")


# ── Bookings ───────────────────────────────────────────────────

async def save_booking(client_id: str, call_id: str, booking: dict):
    pool = await get_pool()
    # If this call already booked an appointment, update it instead of inserting a duplicate.
    # This handles the case where the caller changes details mid-call.
    existing = None
    if call_id:
        existing = await pool.fetchrow(
            "SELECT id FROM bookings WHERE call_id = $1::uuid LIMIT 1",
            call_id,
        )
    if existing:
        await pool.execute(
            """UPDATE bookings
                  SET patient_name = $2, phone = $3, day = $4, time = $5, reason = $6
                WHERE id = $1""",
            existing["id"],
            booking["patient_name"], booking["phone"],
            booking["day"], booking["time"], booking.get("reason", ""),
        )
        print(f"[DB] Booking updated: {booking['patient_name']} — {booking['day']} at {booking['time']}")
    else:
        await pool.execute(
            """INSERT INTO bookings (client_id, call_id, patient_name, phone, day, time, reason)
               VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)""",
            client_id, call_id,
            booking["patient_name"], booking["phone"],
            booking["day"], booking["time"],
            booking.get("reason", ""),
        )
        print(f"[DB] Booking saved: {booking['patient_name']} — {booking['day']} at {booking['time']}")


# ── Config ─────────────────────────────────────────────────────

async def get_config(client_id: str) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM configs WHERE client_id = $1", client_id
    )
    return _row(row) if row else None


async def upsert_config(client_id: str, user_id: str, data: dict) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO configs
             (client_id, user_id, business_name, role, personality,
              capabilities, working_hours, greeting, faqs, assistant_name)
           VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (client_id) DO UPDATE SET
             business_name  = EXCLUDED.business_name,
             role           = EXCLUDED.role,
             personality    = EXCLUDED.personality,
             capabilities   = EXCLUDED.capabilities,
             working_hours  = EXCLUDED.working_hours,
             greeting       = EXCLUDED.greeting,
             faqs           = EXCLUDED.faqs,
             assistant_name = EXCLUDED.assistant_name,
             updated_at     = NOW()
           RETURNING *""",
        client_id, user_id,
        data["business_name"], data["role"], data["personality"],
        data["capabilities"], data["working_hours"], data["greeting"],
        data["faqs"], data.get("assistant_name", "")
    )
    return _row(row)
