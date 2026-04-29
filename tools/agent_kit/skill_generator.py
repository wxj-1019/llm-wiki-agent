#!/usr/bin/env python3
"""Generate Kimi Skill from wiki content."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.config import AgentKitConfig
    from tools.agent_kit.types import WikiPage

logger = logging.getLogger(__name__)


def _normalize_slug(slug: str) -> str:
    """Convert graph node id (e.g., 'concepts/Transformer') to page slug ('Transformer')."""
    return slug.split("/")[-1]


def select_top_nodes(
    graph_analysis: dict,
    pages: dict[str, WikiPage],
    max_items: int = 10,
    node_type: str | None = None,
) -> list[str]:
    """Select top nodes by composite score (degree + betweenness + body quality)."""
    nodes = graph_analysis.get("nodes", {})
    scores: dict[str, float] = {}
    seen_slugs: set[str] = set()

    for raw_slug, node in nodes.items():
        slug = _normalize_slug(raw_slug)
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        if node_type and node.get("type") != node_type:
            continue

        score = 0.0
        score += node.get("degree", 0) * 2
        score += node.get("betweenness", 0.0) * 3

        page = pages.get(slug)
        if page:
            body_len = page.get("body_length", 0)
            if body_len < 300:
                continue
            score += min(body_len / 1000, 5)

        if node.get("type") == "concept":
            score *= 1.2

        scores[slug] = score

    sorted_slugs = sorted(scores.keys(), key=lambda s: scores[s], reverse=True)
    return sorted_slugs[:max_items]


def _extract_summary(body: str, max_chars: int) -> str:
    """Extract a clean summary from page body, skipping the leading H1."""
    lines = body.split("\n")
    start = 0
    for i, line in enumerate(lines):
        if line.strip().startswith("# "):
            start = i + 1
            break
    content = "\n".join(lines[start:]).strip()
    first_para = content.split("\n\n")[0] if content else ""
    return first_para.replace("\n", " ")[:max_chars]


def _render_entities(
    top_entities: list[str],
    pages: dict[str, WikiPage],
    max_chars: int,
) -> list[str]:
    """Render the Entities section of SKILL.md."""
    lines: list[str] = []
    lines.append("## 核心实体")
    lines.append("")
    lines.append("| 实体 | 类型 | 描述 |")
    lines.append("|------|------|------|")
    for slug in top_entities:
        page = pages.get(slug)
        if not page:
            continue
        title = page.get("title", slug)
        ptype = page.get("type", "entity")
        summary = _extract_summary(page.get("body", ""), max_chars)
        lines.append(f"| **{title}** | {ptype} | {summary} |")
    lines.append("")
    return lines


def _render_concepts(
    top_concepts: list[str],
    pages: dict[str, WikiPage],
    max_chars: int,
) -> list[str]:
    """Render the Concepts section of SKILL.md."""
    lines: list[str] = []
    lines.append("## 核心概念")
    lines.append("")
    for slug in top_concepts:
        page = pages.get(slug)
        if not page:
            continue
        title = page.get("title", slug)
        summary = _extract_summary(page.get("body", ""), max_chars)
        lines.append(f"### {title}")
        lines.append("")
        lines.append(summary)
        lines.append("")
    return lines


def _render_relationships(
    overview_page: WikiPage | None,
    pages: dict[str, WikiPage],
) -> list[str]:
    """Render the Relationships section of SKILL.md."""
    lines: list[str] = []
    lines.append("## 关键关系")
    lines.append("")
    overview_links = overview_page.get("links", []) if overview_page else []
    seen_pairs: set[tuple[str, str]] = set()
    for link in overview_links[:20]:
        target_page = pages.get(link)
        if target_page:
            pair = tuple(sorted([
                overview_page.get("title", "Overview") if overview_page else "Overview",
                target_page.get("title", link),
            ]))
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                lines.append(f"- **{pair[0]}** → **{pair[1]}**")
    if not overview_links:
        lines.append("_See individual pages for relationship details._")
    lines.append("")
    return lines


def render_skill_md(
    skill_name: str,
    description: str,
    overview_page: WikiPage | None,
    top_entities: list[str],
    top_concepts: list[str],
    pages: dict[str, WikiPage],
    config: AgentKitConfig,
) -> str:
    """Render the complete SKILL.md content."""
    lines: list[str] = [
        "---",
        f"name: {skill_name}",
        "description: |",
    ]
    for desc_line in description.split("\n"):
        lines.append(f"  {desc_line}")
    lines.append("---")
    lines.append("")
    lines.append(f"# {skill_name}")
    lines.append("")

    # Overview
    if overview_page and overview_page.get("body"):
        lines.append("## 领域概览")
        lines.append("")
        paras = [
            p.strip()
            for p in overview_page["body"].split("\n\n")
            if p.strip() and not p.strip().startswith("#")
        ]
        for para in paras[:2]:
            lines.append(para)
            lines.append("")

    lines.extend(_render_entities(top_entities, pages, config.compression.entity_summary_max_chars))
    lines.extend(_render_concepts(top_concepts, pages, config.compression.concept_summary_max_chars))
    lines.extend(_render_relationships(overview_page, pages))

    lines.append("## 使用工作流")
    lines.append("")
    lines.append("当用户询问相关主题时：")
    lines.append("1. 先确认用户问题的具体范围")
    lines.append("2. 引用上述实体/概念进行解释")
    lines.append("3. 如需更详细资料，引导用户使用 wiki 查询工具")
    lines.append("4. 标注不确定性（如果信息来自矛盾或开放问题部分）")
    lines.append("")

    return "\n".join(lines) + "\n"


def generate_skill(
    graph_analysis: dict,
    pages: dict[str, WikiPage],
    config: AgentKitConfig,
    output_dir: Path,
) -> Path:
    """Generate Skill package.

    Returns the path to the generated skill directory.
    """
    skill_name = config.name
    skill_dir = output_dir / skill_name
    skill_dir.mkdir(parents=True, exist_ok=True)

    top_entities = select_top_nodes(
        graph_analysis, pages,
        max_items=config.max_entities, node_type="entity"
    )
    top_concepts = select_top_nodes(
        graph_analysis, pages,
        max_items=config.max_concepts, node_type="concept"
    )

    overview_page = pages.get("overview")
    description = config.description or f"Knowledge base skill: {skill_name}"

    skill_md = render_skill_md(
        skill_name=skill_name,
        description=description,
        overview_page=overview_page,  # type: ignore[arg-type]
        top_entities=top_entities,
        top_concepts=top_concepts,
        pages=pages,
        config=config,
    )
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")
    logger.info("SKILL.md written: %s", skill_dir / "SKILL.md")

    if config.include_references:
        ref_dir = skill_dir / "references"
        ref_dir.mkdir(exist_ok=True)
        for slug, page in pages.items():
            if page.get("body_length", 0) >= config.page_min_length:
                target = ref_dir / f"{slug}.md"
                body = page.get("body", "")
                max_chars = config.compression.reference_max_chars
                content = f"# {page.get('title', slug)}\n\n{body[:max_chars]}"
                if len(body) > max_chars:
                    content += "\n\n_... (truncated)_"
                target.write_text(content, encoding="utf-8")
        logger.info("References copied to %s", ref_dir)

    return skill_dir
