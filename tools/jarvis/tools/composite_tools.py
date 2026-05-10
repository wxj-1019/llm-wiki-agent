#!/usr/bin/env python3
from __future__ import annotations

import asyncio
from pathlib import Path

from tools.jarvis.tool_registry import get_registry, register_tool
from tools.jarvis.types import RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent.parent


def _sync_execute(tool_name: str, params: dict = None) -> dict:
    params = params or {}
    registry = get_registry()
    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, registry.execute(tool_name, params))
            result = future.result(timeout=600)
    except RuntimeError:
        result = asyncio.run(registry.execute(tool_name, params))
    if result.success:
        return result.data if result.data is not None else {}
    return {"error": result.error}


def _register_full_ingest_pipeline():
    @register_tool(
        name="full_ingest_pipeline",
        description="Run the complete ingest pipeline: ingest, health check, graph build, and quality scoring",
        risk_level=RiskLevel.L1,
        input_schema={
            "source": {"type": "str", "required": True},
            "source_type": {"type": "str", "required": False},
        },
        output_schema={
            "steps": {"type": "list[dict]"},
            "final_status": {"type": "str"},
        },
        category="composite",
    )
    def full_ingest_pipeline(source: str, source_type: str = "file") -> dict:
        steps = []

        if source_type == "url":
            fetch_result = _sync_execute("web_fetch", {"url": source})
            steps.append({
                "step": "web_fetch",
                "success": fetch_result.get("success", "error" not in fetch_result),
                "detail": fetch_result,
            })
            if "error" in fetch_result:
                return {"steps": steps, "final_status": "failed", "failed_at": "web_fetch"}

            local_path = fetch_result.get("saved_to") or fetch_result.get("path", source)
            ingest_params = {"file_path": local_path}
        else:
            ingest_params = {"file_path": source}

        ingest_result = _sync_execute("ingest", ingest_params)
        steps.append({
            "step": "ingest",
            "success": ingest_result.get("success", "error" not in ingest_result),
            "detail": ingest_result,
        })
        if "error" in ingest_result and not ingest_result.get("success"):
            return {"steps": steps, "final_status": "failed", "failed_at": "ingest"}

        if source_type == "file":
            health_result = _sync_execute("health_check")
            steps.append({
                "step": "health_check",
                "success": "error" not in health_result,
                "detail": health_result,
            })

        graph_result = _sync_execute("build_graph", {"no_infer": True})
        steps.append({
            "step": "build_graph",
            "success": "error" not in graph_result,
            "detail": graph_result,
        })

        quality_result = _sync_execute("quality_score")
        steps.append({
            "step": "quality_score",
            "success": "error" not in quality_result,
            "detail": quality_result,
        })

        has_error = any(not s["success"] for s in steps)
        final_status = "completed_with_issues" if has_error else "completed"
        return {"steps": steps, "final_status": final_status}


def _register_maintenance_cycle():
    @register_tool(
        name="maintenance_cycle",
        description="Run full wiki maintenance: health check, heal, lint, and graph rebuild",
        risk_level=RiskLevel.L1,
        input_schema={"scope": {"type": "str", "required": False}},
        output_schema={
            "steps": {"type": "list[dict]"},
            "issues_fixed": {"type": "int"},
        },
        category="composite",
    )
    def maintenance_cycle(scope: str = "full") -> dict:
        steps = []
        issues_fixed = 0

        health_result = _sync_execute("health_check")
        steps.append({
            "step": "health_check",
            "success": "error" not in health_result,
            "detail": health_result,
        })

        health_data = health_result.get("health", {})
        has_issues = bool(health_data) and (
            health_data.get("errors") or health_data.get("warnings") or health_data.get("empty_stubs")
        )

        if has_issues or scope == "full":
            heal_result = _sync_execute("heal")
            steps.append({
                "step": "heal",
                "success": "error" not in heal_result,
                "detail": heal_result,
            })
            heal_output = heal_result.get("output", "")
            if heal_output:
                fixed = heal_output.lower().count("healed") + heal_output.lower().count("created")
                issues_fixed += fixed

            lint_result = _sync_execute("lint")
            steps.append({
                "step": "lint",
                "success": "error" not in lint_result,
                "detail": lint_result,
            })

            graph_result = _sync_execute("build_graph", {"no_infer": False})
            steps.append({
                "step": "build_graph",
                "success": "error" not in graph_result,
                "detail": graph_result,
            })

        return {"steps": steps, "issues_fixed": issues_fixed}


def _register_research_topic():
    @register_tool(
        name="research_topic",
        description="Research a topic via web search, ingest top results, and build knowledge graph",
        risk_level=RiskLevel.L1,
        input_schema={
            "topic": {"type": "str", "required": True},
            "max_sources": {"type": "int", "required": False},
        },
        output_schema={
            "sources_found": {"type": "int"},
            "pages_created": {"type": "int"},
            "summary": {"type": "str"},
        },
        category="composite",
    )
    def research_topic(topic: str, max_sources: int = 5) -> dict:
        sources_found = 0
        pages_created = 0

        search_result = _sync_execute("web_search", {"query": topic, "max_results": max_sources})
        search_data = search_result.get("results", search_result.get("data", []))

        if isinstance(search_data, list):
            urls = []
            for item in search_data[:max_sources]:
                if isinstance(item, dict) and item.get("url"):
                    urls.append(item["url"])
                elif isinstance(item, str):
                    urls.append(item)
        else:
            urls = []

        sources_found = len(urls)

        for url in urls:
            fetch_result = _sync_execute("web_fetch", {"url": url})
            if "error" in fetch_result:
                continue

            ingest_result = _sync_execute("ingest", {"file_path": url})
            if ingest_result.get("success") and "error" not in ingest_result:
                pages_created += 1

        if pages_created > 0:
            _sync_execute("build_graph")

        summary = f"Researched '{topic}': found {sources_found} sources, created {pages_created} wiki pages."
        return {
            "sources_found": sources_found,
            "pages_created": pages_created,
            "summary": summary,
        }


def _register_daily_report():
    @register_tool(
        name="daily_report",
        description="Generate a daily status report combining health, quality, and git status",
        risk_level=RiskLevel.L1,
        input_schema={},
        output_schema={"report": {"type": "dict"}},
        category="composite",
    )
    def daily_report() -> dict:
        health_result = _sync_execute("health_check")
        quality_result = _sync_execute("quality_score")
        git_result = _sync_execute("git_status")

        report = {
            "health": health_result.get("health", {}),
            "health_errors": health_result.get("error"),
            "quality": quality_result.get("score", quality_result),
            "quality_errors": quality_result.get("error"),
            "git": {
                "branch": git_result.get("branch", ""),
                "status": git_result.get("output", ""),
            },
        }

        return {"report": report}


_ALL_REGISTRARS = [
    _register_full_ingest_pipeline,
    _register_maintenance_cycle,
    _register_research_topic,
    _register_daily_report,
]


def register_all():
    for registrar in _ALL_REGISTRARS:
        try:
            registrar()
        except Exception as exc:
            print(f"WARNING: failed to register tool from {registrar.__name__}: {exc}")
