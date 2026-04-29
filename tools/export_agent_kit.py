#!/usr/bin/env python3
"""Export wiki knowledge to MCP Server and/or Kimi Skill."""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import zipfile
from pathlib import Path

# Configure logging before anything else
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger("export_agent_kit")

REPO_ROOT = Path(__file__).parent.parent
WIKI_ROOT = REPO_ROOT / "wiki"
GRAPH_PATH = REPO_ROOT / "graph" / "graph.json"
DEFAULT_OUTPUT = REPO_ROOT / "agent-kit"


def load_graph(graph_path: Path) -> dict:
    """Safely load knowledge graph, degrade gracefully on failure."""
    if not graph_path.exists():
        logger.warning("graph.json not found — graph-based features disabled")
        return {"nodes": [], "edges": []}
    try:
        data = json.loads(graph_path.read_text(encoding="utf-8"))
        if "nodes" not in data or "edges" not in data:
            raise ValueError("Missing required keys: 'nodes' or 'edges'")
        return data
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("graph.json is corrupted (%s) — graph-based features disabled", exc)
        logger.info("Run 'python tools/build_graph.py' to regenerate.")
        return {"nodes": [], "edges": []}


def run_preflight_check(pages: dict) -> dict:
    """Lightweight pre-flight check (structural only, no LLM)."""
    critical: list[str] = []
    warnings: list[str] = []

    if len(pages) == 0:
        critical.append("wiki/ contains no markdown files")
    elif len(pages) < 5:
        warnings.append(f"wiki/ has only {len(pages)} pages — Skill will be minimal")

    if pages:
        stub_count = sum(1 for p in pages.values() if p.get("body_length", 0) < 200)
        if stub_count > len(pages) * 0.3:
            warnings.append(f"{stub_count}/{len(pages)} pages are stubs (< 200 chars)")

    if not GRAPH_PATH.exists():
        warnings.append("graph.json not found — run build_graph first for optimal results")

    return {"critical": critical, "warnings": warnings}


def package_skill(skill_dir: Path) -> Path:
    """Package skill directory into a .skill zip file."""
    output = skill_dir.parent / f"{skill_dir.name}.skill"
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in skill_dir.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(skill_dir))
    logger.info("Packaged: %s", output)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Export wiki to agent assets")
    parser.add_argument("--target", choices=["mcp", "skill", "all"], default="all")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--incremental", action="store_true")
    parser.add_argument("--package", action="store_true", help="Package skill as .skill file")
    parser.add_argument("--config", type=Path, default=REPO_ROOT / "agent-kit-config.yaml")
    parser.add_argument("--skip-health-check", action="store_true", help="Skip pre-flight checks")
    parser.add_argument("--skip-diagrams", action="store_true", help="Skip Mermaid diagram generation")
    parser.add_argument("--skip-schema", action="store_true", help="Skip schema inference")
    parser.add_argument("--skip-validation", action="store_true", help="Skip generated skill validation")
    parser.add_argument("--embed", action="store_true", help="Build semantic embeddings (requires fastembed)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Ensure tools/ is on path for imports
    sys.path.insert(0, str(REPO_ROOT / "tools"))

    from agent_kit.config import AgentKitConfig
    from agent_kit.indexer import detect_changes, load_cache, save_cache
    from agent_kit.parser import parse_all_pages
    from agent_kit.state import record_generation

    config = AgentKitConfig.from_yaml(args.config)
    logger.debug("Config loaded: %s", config)

    pages = parse_all_pages(WIKI_ROOT, REPO_ROOT)
    logger.info("Parsed %d wiki pages", len(pages))

    # Pre-flight health check
    health = run_preflight_check(pages)
    if health["critical"]:
        for issue in health["critical"]:
            logger.error("Critical: %s", issue)
        if not args.skip_health_check:
            return 1
    for warning in health["warnings"]:
        logger.warning("Pre-flight: %s", warning)

    # Load graph (safe degrade)
    graph_data = load_graph(GRAPH_PATH)

    # Analyze graph
    from agent_kit.graph_analyzer import analyze_graph
    graph_analysis = analyze_graph(graph_data, pages)
    logger.debug("Graph analysis: %d nodes", len(graph_analysis.get("nodes", {})))

    # Incremental update
    cache = load_cache()
    added, modified, deleted = detect_changes(pages, REPO_ROOT, cache)
    changed_slugs = added | modified | deleted if args.incremental else None

    if args.incremental and not changed_slugs:
        logger.info("No changes detected. Skipping regeneration.")
        return 0

    if changed_slugs:
        logger.info("Changes: +%d ~%d -%d pages", len(added), len(modified), len(deleted))

    # Optional: semantic embeddings
    embeddings: dict[str, list[float]] = {}
    if args.embed:
        from agent_kit.embedder import build_embeddings
        embeddings = build_embeddings(pages)
        if embeddings:
            logger.info("Embeddings built for %d pages", len(embeddings))

    # Generate MCP Server
    if args.target in ("mcp", "all"):
        from agent_kit.mcp_generator import generate_mcp_server
        mcp_dir = args.output / "mcp-server"
        generate_mcp_server(pages, graph_analysis, {}, mcp_dir)
        logger.info("MCP Server generated: %s", mcp_dir)

    # Generate Skill
    skill_path: Path | None = None
    if args.target in ("skill", "all"):
        from agent_kit.skill_generator import generate_skill
        skill_dir = args.output / "skills"
        skill_path = generate_skill(graph_analysis, pages, config, skill_dir)
        logger.info("Skill generated: %s", skill_path)

        # Validate generated skill
        if not args.skip_validation:
            from agent_kit.validators import validate_skill_frontmatter
            skill_md = skill_path / "SKILL.md"
            if skill_md.exists():
                result = validate_skill_frontmatter(skill_md)
                if result.valid:
                    logger.info("Skill validation passed")
                else:
                    logger.warning("Skill validation errors: %s", "; ".join(result.errors))
                if result.warnings:
                    logger.warning("Skill validation warnings: %s", "; ".join(result.warnings))

        if args.package and skill_path:
            package_skill(skill_path)

    # Generate schema
    if not args.skip_schema:
        from agent_kit.schema import generate_schema_json
        schema_dir = args.output / "schema"
        schema_dir.mkdir(parents=True, exist_ok=True)
        generate_schema_json(pages, schema_dir / "schema.json")

    # Generate diagrams
    if not args.skip_diagrams:
        from agent_kit.diagram_generator import generate_all_diagrams
        diag_dir = args.output / "mcp-server" / "diagrams"
        generate_all_diagrams(pages, diag_dir)

    # Save cache
    new_cache: dict[str, str] = {}
    for slug, page in pages.items():
        p = REPO_ROOT / page["path"]
        if p.exists():
            new_cache[slug] = hashlib.sha256(p.read_bytes()).hexdigest()[:16]
    save_cache(new_cache)

    # Record generation state
    record_generation(
        config=config,
        pages_count=len(pages),
        changed_pages=len(changed_slugs) if changed_slugs else 0,
        output_dir=args.output,
        mcp=(args.target in ("mcp", "all")),
        skill=(args.target in ("skill", "all")),
        packaged=args.package,
    )
    logger.info("State saved")
    return 0


if __name__ == "__main__":
    sys.exit(main())
