#!/usr/bin/env python3
"""Infer and validate wiki structure schema."""
from __future__ import annotations

import json
import logging
from collections import Counter
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.types import WikiPage

logger = logging.getLogger(__name__)


def infer_schema(pages: dict[str, WikiPage]) -> dict:
    """Infer the structure schema of the wiki knowledge base.

    Returns a dict describing:
    - page types and their counts
    - tags and their frequencies
    - frontmatter fields and their types
    - body length distribution
    """
    type_counts = Counter[str]()
    tag_counts = Counter[str]()
    field_types: dict[str, set[str]] = {}
    body_lengths: list[int] = []

    for page in pages.values():
        ptype = page.get("type", "page")
        type_counts[ptype] += 1

        for tag in page.get("tags", []):
            tag_counts[tag] += 1

        for key, value in page.get("frontmatter", {}).items():
            if key not in field_types:
                field_types[key] = set()
            field_types[key].add(type(value).__name__)

        body_lengths.append(page.get("body_length", 0))

    if body_lengths:
        body_lengths.sort()
        n = len(body_lengths)
        median = body_lengths[n // 2] if n % 2 else (body_lengths[n // 2 - 1] + body_lengths[n // 2]) // 2
        length_stats = {
            "count": n,
            "min": body_lengths[0],
            "max": body_lengths[-1],
            "median": median,
            "mean": sum(body_lengths) // n,
        }
    else:
        length_stats = {"count": 0, "min": 0, "max": 0, "median": 0, "mean": 0}

    schema = {
        "version": "1.0",
        "inferred_at": _now_iso(),
        "pages": {
            "total": len(pages),
            "by_type": dict(type_counts.most_common()),
        },
        "tags": dict(tag_counts.most_common(50)),
        "frontmatter_fields": {
            field: sorted(types) for field, types in field_types.items()
        },
        "body_length_stats": length_stats,
    }

    return schema


def generate_schema_json(pages: dict[str, WikiPage], output_path: Path) -> Path:
    """Generate schema.json and write to disk."""
    schema = infer_schema(pages)
    output_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Schema written: %s", output_path)
    return output_path


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
