#!/usr/bin/env python3
"""Configuration management for agent_kit."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore


@dataclass(frozen=True)
class CompressionConfig:
    """Content compression settings for Skill generation."""
    entity_summary_max_chars: int = 300
    concept_summary_max_chars: int = 500
    reference_max_chars: int = 3000

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> CompressionConfig:
        if not data:
            return cls()
        return cls(
            entity_summary_max_chars=data.get("entity_summary_max_chars", 300),
            concept_summary_max_chars=data.get("concept_summary_max_chars", 500),
            reference_max_chars=data.get("reference_max_chars", 3000),
        )


@dataclass(frozen=True)
class AgentKitConfig:
    """Top-level configuration for agent_kit generation."""
    name: str = "llm-wiki-knowledge"
    description: str = ""
    max_entities: int = 10
    max_concepts: int = 10
    page_min_length: int = 300
    include_references: bool = True
    compression: CompressionConfig = field(default_factory=CompressionConfig)

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> AgentKitConfig:
        if not data:
            return cls()
        return cls(
            name=data.get("name", "llm-wiki-knowledge"),
            description=data.get("description", ""),
            max_entities=data.get("max_entities", 10),
            max_concepts=data.get("max_concepts", 10),
            page_min_length=data.get("page_min_length", 300),
            include_references=data.get("include_references", True),
            compression=CompressionConfig.from_dict(data.get("compression")),
        )

    @classmethod
    def from_yaml(cls, path: Path) -> AgentKitConfig:
        """Load configuration from a YAML file."""
        if yaml is None:
            return cls()
        if not path.exists():
            return cls()
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            return cls.from_dict(data)
        except (yaml.YAMLError, OSError):
            return cls()
