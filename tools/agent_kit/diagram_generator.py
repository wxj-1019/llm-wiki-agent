#!/usr/bin/env python3
"""Generate Mermaid diagrams from knowledge graph."""
from __future__ import annotations

import logging
from io import StringIO
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.types import WikiPage

logger = logging.getLogger(__name__)


def _sanitize_mermaid_id(name: str) -> str:
    """Sanitize a name for use as a Mermaid node ID."""
    return "".join(c if c.isalnum() else "_" for c in name)[:40]


def generate_entity_relationship_diagram(
    pages: dict[str, WikiPage], max_nodes: int = 20
) -> str:
    """Generate a Mermaid ER diagram showing entity relationships."""
    entities = [
        (slug, p) for slug, p in pages.items()
        if p.get("type") == "entity"
    ]
    # Sort by body length (proxy for importance) and take top N
    entities.sort(key=lambda x: x[1].get("body_length", 0), reverse=True)
    entities = entities[:max_nodes]

    buf = StringIO()
    buf.write("```mermaid\n")
    buf.write("erDiagram\n")

    entity_slugs = {slug for slug, _ in entities}

    for slug, page in entities:
        node_id = _sanitize_mermaid_id(slug)
        title = page.get("title", slug).replace('"', "'")
        buf.write(f'    {node_id}["{title}"]\n')

    # Draw relationships from wikilinks
    for slug, page in entities:
        src_id = _sanitize_mermaid_id(slug)
        for link in page.get("links", [])[:5]:
            if link in entity_slugs and link != slug:
                tgt_id = _sanitize_mermaid_id(link)
                buf.write(f"    {src_id} --> {tgt_id}\n")

    buf.write("```\n")
    return buf.getvalue()


def generate_concept_map(
    pages: dict[str, WikiPage], max_nodes: int = 20
) -> str:
    """Generate a Mermaid mindmap showing concept relationships."""
    concepts = [
        (slug, p) for slug, p in pages.items()
        if p.get("type") == "concept"
    ]
    concepts.sort(key=lambda x: x[1].get("body_length", 0), reverse=True)
    concepts = concepts[:max_nodes]

    buf = StringIO()
    buf.write("```mermaid\n")
    buf.write("mindmap\n")
    buf.write("  root((Knowledge Base))\n")

    concept_slugs = {slug for slug, _ in concepts}

    for slug, page in concepts:
        title = page.get("title", slug).replace('"', "'")
        buf.write(f'    {title}\n')
        for link in page.get("links", [])[:3]:
            if link in concept_slugs and link != slug:
                link_title = pages.get(link, {}).get("title", link).replace('"', "'")
                buf.write(f'      {link_title}\n')

    buf.write("```\n")
    return buf.getvalue()


def generate_architecture_overview(pages: dict[str, WikiPage]) -> str:
    """Generate a Mermaid flowchart showing wiki architecture."""
    type_groups: dict[str, list[str]] = {}
    for slug, page in pages.items():
        ptype = page.get("type", "page")
        type_groups.setdefault(ptype, []).append(page.get("title", slug))

    buf = StringIO()
    buf.write("```mermaid\n")
    buf.write("flowchart LR\n")

    # Source nodes
    sources = type_groups.get("source", [])
    if sources:
        buf.write(f'    subgraph Sources["Sources ({len(sources)})"]\n')
        for s in sources[:5]:
            buf.write(f'        { _sanitize_mermaid_id(s)}["{s}"]\n')
        if len(sources) > 5:
            buf.write(f'        ...["+{len(sources)-5} more"]\n')
        buf.write("    end\n")

    # Concept nodes
    concepts = type_groups.get("concept", [])
    if concepts:
        buf.write(f'    subgraph Concepts["Concepts ({len(concepts)})"]\n')
        for c in concepts[:5]:
            buf.write(f'        {_sanitize_mermaid_id(c)}["{c}"]\n')
        if len(concepts) > 5:
            buf.write(f'        ...["+{len(concepts)-5} more"]\n')
        buf.write("    end\n")

    # Entity nodes
    entities = type_groups.get("entity", [])
    if entities:
        buf.write(f'    subgraph Entities["Entities ({len(entities)})"]\n')
        for e in entities[:5]:
            buf.write(f'        {_sanitize_mermaid_id(e)}["{e}"]\n')
        if len(entities) > 5:
            buf.write(f'        ...["+{len(entities)-5} more"]\n')
        buf.write("    end\n")

    buf.write("    Sources --> Concepts\n")
    buf.write("    Concepts --> Entities\n")
    buf.write("```\n")
    return buf.getvalue()


def generate_all_diagrams(
    pages: dict[str, WikiPage],
    output_dir: Path,
) -> list[Path]:
    """Generate all Mermaid diagrams and write to output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    generated: list[Path] = []

    diagrams = {
        "entity-relationship.md": generate_entity_relationship_diagram(pages),
        "concept-map.md": generate_concept_map(pages),
        "architecture-overview.md": generate_architecture_overview(pages),
    }

    for filename, content in diagrams.items():
        path = output_dir / filename
        path.write_text(content, encoding="utf-8")
        generated.append(path)
        logger.info("Diagram generated: %s", path)

    return generated
