#!/usr/bin/env python3
"""Track generation state for incremental updates and auditing."""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agent_kit.config import AgentKitConfig

logger = logging.getLogger(__name__)

STATE_FILE = Path(__file__).parent.parent.parent / ".cache" / "agent-kit-state.json"


@dataclass
class GenerationState:
    """Snapshot of a single generation run."""
    timestamp: str
    config_hash: str
    pages_count: int
    changed_pages: int
    outputs: list[str] = field(default_factory=list)
    mcp_server_generated: bool = False
    skill_generated: bool = False
    skill_packaged: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GenerationState:
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


def _hash_config(config: AgentKitConfig) -> str:
    """Compute a simple hash of the configuration."""
    import hashlib
    text = json.dumps(asdict(config), sort_keys=True)
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def load_state() -> list[GenerationState]:
    """Load generation history."""
    if not STATE_FILE.exists():
        return []
    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            return [GenerationState.from_dict(item) for item in raw]
        return []
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load state: %s", exc)
        return []


def save_state(states: list[GenerationState]) -> None:
    """Save generation history."""
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        data = [s.to_dict() for s in states[-20:]]  # Keep last 20 entries
        STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        logger.warning("Failed to save state: %s", exc)


def record_generation(
    config: AgentKitConfig,
    pages_count: int,
    changed_pages: int,
    output_dir: Path,
    mcp: bool = False,
    skill: bool = False,
    packaged: bool = False,
) -> GenerationState:
    """Record a generation run and append to history."""
    outputs: list[str] = []
    if mcp:
        outputs.append(str(output_dir / "mcp-server" / "wiki_mcp_server.py"))
    if skill:
        outputs.append(str(output_dir / "skills" / config.name / "SKILL.md"))
        if packaged:
            outputs.append(str(output_dir / "skills" / f"{config.name}.skill"))

    state = GenerationState(
        timestamp=datetime.now(timezone.utc).isoformat(),
        config_hash=_hash_config(config),
        pages_count=pages_count,
        changed_pages=changed_pages,
        outputs=outputs,
        mcp_server_generated=mcp,
        skill_generated=skill,
        skill_packaged=packaged,
    )

    history = load_state()
    history.append(state)
    save_state(history)
    logger.info("Generation recorded: %d pages, %d changed", pages_count, changed_pages)
    return state
