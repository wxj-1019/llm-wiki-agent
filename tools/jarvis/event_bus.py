#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from fnmatch import fnmatch
from typing import Callable

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import Event, EventCategory


class EventBus:
    def __init__(self) -> None:
        self._subscriptions: dict[str, tuple[str, Callable]] = {}
        self._ensure_table()

    def _ensure_table(self) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS jarvis_events (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    payload_json JSONB,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    source TEXT NOT NULL DEFAULT ''
                )
                """
            )
            # Migration: add consumed column if missing
            try:
                cur.execute("ALTER TABLE jarvis_events ADD COLUMN consumed BOOLEAN NOT NULL DEFAULT FALSE")
            except Exception:
                conn.rollback()
                cur = conn.cursor()
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_jarvis_events_unconsumed ON jarvis_events(consumed, timestamp DESC)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_jarvis_events_name ON jarvis_events(name, timestamp DESC)"
            )
            cur.close()

    def publish(self, event: Event) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO jarvis_events (id, name, category, payload_json, timestamp, source, consumed)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    event.id,
                    event.name,
                    event.category.value,
                    json.dumps(event.payload, default=str) if event.payload is not None else None,
                    event.timestamp,
                    event.source,
                ),
            )
            cur.close()

    def poll(self, since: str = "", limit: int = 100) -> list[Event]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            if since:
                cur.execute(
                    """
                    SELECT id, name, category, payload_json, timestamp, source
                    FROM jarvis_events WHERE consumed = FALSE AND timestamp > %s
                    ORDER BY timestamp DESC LIMIT %s
                    """,
                    (since, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, name, category, payload_json, timestamp, source
                    FROM jarvis_events WHERE consumed = FALSE
                    ORDER BY timestamp DESC LIMIT %s
                    """,
                    (limit,),
                )
            rows = cur.fetchall()
            cur.close()
        return [self._row_to_event(r) for r in rows]

    def mark_consumed(self, event_ids: list[str]) -> None:
        if not event_ids:
            return
        with get_pg_conn() as conn:
            cur = conn.cursor()
            placeholders = ",".join("%s" for _ in event_ids)
            cur.execute(
                f"UPDATE jarvis_events SET consumed = TRUE WHERE id IN ({placeholders})",
                event_ids,
            )
            cur.close()

    def subscribe(self, pattern: str, callback: Callable) -> str:
        sub_id = f"sub_{uuid.uuid4().hex[:8]}"
        self._subscriptions[sub_id] = (pattern, callback)
        return sub_id

    def unsubscribe(self, subscription_id: str) -> None:
        self._subscriptions.pop(subscription_id, None)

    def dispatch(self, event: Event) -> None:
        self.publish(event)
        for sub_id, (pattern, callback) in self._subscriptions.items():
            if fnmatch(event.name, pattern):
                callback(event)

    def get_recent(self, category: EventCategory | None = None, limit: int = 50) -> list[Event]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            if category is not None:
                cur.execute(
                    """
                    SELECT id, name, category, payload_json, timestamp, source
                    FROM jarvis_events WHERE category = %s
                    ORDER BY timestamp DESC LIMIT %s
                    """,
                    (category.value, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, name, category, payload_json, timestamp, source
                    FROM jarvis_events ORDER BY timestamp DESC LIMIT %s
                    """,
                    (limit,),
                )
            rows = cur.fetchall()
            cur.close()
        return [self._row_to_event(r) for r in rows]

    def purge(self, older_than_hours: int = 168) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM jarvis_events WHERE timestamp < NOW() - INTERVAL '%s hours'",
                (older_than_hours,),
            )
            cur.close()

    def stats(self) -> dict:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT category, COUNT(*) FROM jarvis_events GROUP BY category")
            rows = cur.fetchall()
            cur.close()
        return {row[0]: row[1] for row in rows}

    @staticmethod
    def _row_to_event(row: tuple) -> Event:
        payload = row[3]
        if payload is not None and isinstance(payload, str):
            payload = json.loads(payload)
        return Event(
            id=row[0],
            name=row[1],
            category=EventCategory(row[2]),
            payload=payload,
            timestamp=row[4],
            source=row[5],
        )


_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _bus
    if _bus is None:
        _bus = EventBus()
    return _bus
