#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
import uuid
from fnmatch import fnmatch
from pathlib import Path
from typing import Callable

from tools.jarvis.types import Event, EventCategory

REPO_ROOT = Path(__file__).parent.parent.parent
DB_PATH = REPO_ROOT / "state" / "jarvis_events.db"


class EventBus:
    def __init__(self) -> None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self._subscriptions: dict[str, tuple[str, Callable]] = {}
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    payload_json TEXT,
                    timestamp TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT ''
                )
                """
            )
            conn.commit()

    def publish(self, event: Event) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO events (id, name, category, payload_json, timestamp, source) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    event.id,
                    event.name,
                    event.category.value,
                    json.dumps(event.payload, default=str) if event.payload is not None else None,
                    event.timestamp,
                    event.source,
                ),
            )
            conn.commit()

    def poll(self, since: str = "", limit: int = 100) -> list[Event]:
        with self._connect() as conn:
            if since:
                rows = conn.execute(
                    "SELECT id, name, category, payload_json, timestamp, source FROM events WHERE timestamp > ? ORDER BY timestamp DESC LIMIT ?",
                    (since, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, name, category, payload_json, timestamp, source FROM events ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [self._row_to_event(r) for r in rows]

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
        with self._connect() as conn:
            if category is not None:
                rows = conn.execute(
                    "SELECT id, name, category, payload_json, timestamp, source FROM events WHERE category = ? ORDER BY timestamp DESC LIMIT ?",
                    (category.value, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, name, category, payload_json, timestamp, source FROM events ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [self._row_to_event(r) for r in rows]

    def purge(self, older_than_hours: int = 168) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM events WHERE timestamp < datetime('now', ?)",
                (f"-{older_than_hours} hours",),
            )
            conn.commit()

    def stats(self) -> dict:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT category, COUNT(*) FROM events GROUP BY category"
            ).fetchall()
        return {row[0]: row[1] for row in rows}

    @staticmethod
    def _row_to_event(row: tuple) -> Event:
        return Event(
            id=row[0],
            name=row[1],
            category=EventCategory(row[2]),
            payload=json.loads(row[3]) if row[3] is not None else None,
            timestamp=row[4],
            source=row[5],
        )


_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _bus
    if _bus is None:
        _bus = EventBus()
    return _bus
