import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.state import get_state_store
from tools.jarvis.types import AgentState, AgentStatus


def test_save_and_load():
    store = get_state_store()
    state = AgentState()
    state.cycle_count = 42
    store.save(state)
    loaded = store.load()
    assert loaded.cycle_count == 42


def test_reset():
    store = get_state_store()
    state = AgentState()
    state.cycle_count = 99
    store.save(state)
    store.reset()
    loaded = store.load()
    assert loaded.cycle_count == 0
