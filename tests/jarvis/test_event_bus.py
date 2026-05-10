import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.event_bus import get_event_bus
from tools.jarvis.types import Event, EventCategory, EventSource


def test_publish_and_poll():
    bus = get_event_bus()
    bus.publish(Event(name="test.event", category=EventCategory.SYSTEM, payload={"x": 1}, source=EventSource.LOOP))
    polled = bus.poll(limit=10)
    assert any(e.name == "test.event" for e in polled)


def test_mark_consumed():
    bus = get_event_bus()
    bus.publish(Event(name="test.consume", category=EventCategory.SYSTEM, payload={}, source=EventSource.LOOP))
    polled = bus.poll(limit=10)
    ids = [e.id for e in polled if e.name == "test.consume"]
    if ids:
        bus.mark_consumed(ids)
        polled2 = bus.poll(limit=10)
        assert not any(e.id in ids for e in polled2)


def test_stats():
    bus = get_event_bus()
    stats = bus.stats()
    assert isinstance(stats, dict)
    assert len(stats) > 0
    assert all(isinstance(v, int) for v in stats.values())
