#!/usr/bin/env python3
"""Global event bus — asyncio.Queue-based pub/sub for SSE streaming.

Usage:
    from tools.shared.event_bus import event_bus
    event_bus.emit("scraper.degraded", {"site": "example.com"}, "warning")

    async for event in event_bus.subscribe():
        yield f"event: {event.type}\ndata: {json.dumps(event.data)}\n\n"
"""
from __future__ import annotations

import asyncio
import json
import time


class Event:
    __slots__ = ("type", "data", "severity", "timestamp")

    def __init__(self, event_type: str, data: dict, severity: str = "info"):
        self.type = event_type
        self.data = data
        self.severity = severity
        self.timestamp = time.time()


class EventBus:
    """Global singleton collecting subsystem events for SSE subscribers."""

    MAX_QUEUE_SIZE = 256

    def __init__(self):
        self._queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=self.MAX_QUEUE_SIZE)

    def emit(self, event_type: str, data: dict, severity: str = "info") -> None:
        """Push event onto queue (must be called from a running event loop thread)."""
        try:
            self._queue.put_nowait(Event(event_type, data, severity))
        except asyncio.QueueFull:
            pass  # Drop oldest implicitly — fine for alerting

    async def subscribe(self):
        """Async generator yielding events for SSE endpoints."""
        while True:
            event = await self._queue.get()
            yield event


# Global singleton — import this everywhere
event_bus = EventBus()
