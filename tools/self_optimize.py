#!/usr/bin/env python3
"""Self-optimization orchestrator — diagnose → fix → prevent loop.

Pipeline: health → lint → heal → graph → refresh

Usage:
    python tools/self_optimize.py --dry-run           # preview only (default)
    python tools/self_optimize.py --auto-fix           # auto-heal
    python tools/self_optimize.py --scope health       # only health
    python tools/self_optimize.py --scope lint --auto-fix
    python tools/self_optimize.py --status             # show optimization history
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))
STATE_DIR = REPO_ROOT / "state"
HISTORY_FILE = STATE_DIR / "optimize_history.jsonl"

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _log_step(step: str, status: str, details: dict) -> None:
    """Append step result to optimize_history.jsonl."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now().isoformat(),
        "step": step,
        "status": status,
        **details,
    }
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def run_health(dry_run: bool = True) -> dict:
    """Run health checks. Return structured result."""
    print("\n" + "=" * 50)
    print("Step 1: Health Check")
    print("=" * 50)

    result = {"stubs": [], "index_sync": [], "log_coverage": []}

    try:
        from tools.health import check_empty_files, check_index_sync, check_log_coverage
        from tools.shared.wiki import all_wiki_pages

        pages = list(all_wiki_pages())

        stubs = check_empty_files(pages)
        result["stubs"] = stubs if isinstance(stubs, list) else []

        sync_issues = check_index_sync(pages)
        result["index_sync"] = sync_issues.get("missing_from_index", []) + sync_issues.get("extra_in_index", []) if isinstance(sync_issues, dict) else []

        coverage = check_log_coverage(pages)
        result["log_coverage"] = coverage if isinstance(coverage, list) else []

        total = len(result["stubs"]) + len(result["index_sync"]) + len(result["log_coverage"])
        print(f"  Found {total} health issues")
        if result["stubs"]:
            print(f"    - Empty stubs: {len(result['stubs'])}")
        if result["index_sync"]:
            print(f"    - Index sync issues: {len(result['index_sync'])}")
        if result["log_coverage"]:
            print(f"    - Log coverage gaps: {len(result['log_coverage'])}")

        _log_step("health", "success", {"issues_found": total})
    except Exception as e:
        print(f"  [ERROR] Health check failed: {e}")
        _log_step("health", "error", {"error": str(e)[:200]})
        result["error"] = str(e)

    return result


def run_heal(health_result: dict, lint_result: dict | None = None, dry_run: bool = True) -> dict:
    """Heal missing entity pages. Optionally driven by lint results."""
    print("\n" + "=" * 50)
    print("Step 2: Heal Missing Pages")
    print("=" * 50)

    result = {"would_create": 0, "created": 0}

    try:
        from tools.heal import heal_missing_entities
        import io
        import contextlib

        # If lint found missing entities, log them before healing
        if lint_result and lint_result.get("missing_entities", 0) > 0:
            print(f"  Lint found {lint_result['missing_entities']} missing entities")
            print(f"  Proceeding with auto-heal...")

        f = io.StringIO()
        try:
            with contextlib.redirect_stdout(f):
                heal_missing_entities(dry_run=dry_run)
            output = f.getvalue()
            print(f"  {'[DRY RUN] ' if dry_run else ''}Heal output:")
            for line in output.strip().split("\n")[:10]:
                print(f"    {line}")
        except SystemExit:
            pass

        _log_step("heal", "success", {"dry_run": dry_run})
    except ImportError:
        print("  [SKIP] heal.py not available")
        _log_step("heal", "skipped", {"reason": "import error"})
    except Exception as e:
        print(f"  [ERROR] Heal failed: {e}")
        _log_step("heal", "error", {"error": str(e)[:200]})

    return result


def run_lint(dry_run: bool = True) -> dict:
    """Run lint checks."""
    print("\n" + "=" * 50)
    print("Step 3: Content Lint")
    print("=" * 50)

    result = {"orphans": 0, "broken_links": 0, "missing_entities": 0, "sparse_pages": 0}

    try:
        from tools.lint import (
            find_orphans, find_broken_links, find_missing_entities,
            check_link_density,
        )
        from tools.shared.wiki import all_wiki_pages
        pages = list(all_wiki_pages())

        orphans = find_orphans(pages)
        result["orphans"] = len(orphans)

        broken = find_broken_links(pages)
        result["broken_links"] = len(broken)

        missing = find_missing_entities(pages)
        result["missing_entities"] = len(missing)

        sparse = check_link_density(pages)
        result["sparse_pages"] = len(sparse)

        print(f"  Orphan pages: {result['orphans']}")
        print(f"  Broken links: {result['broken_links']}")
        print(f"  Missing entities: {result['missing_entities']}")
        print(f"  Sparse pages: {result['sparse_pages']}")

        _log_step("lint", "success", result)
    except Exception as e:
        print(f"  [ERROR] Lint failed: {e}")
        _log_step("lint", "error", {"error": str(e)[:200]})

    return result


def run_graph_build(dry_run: bool = True) -> dict:
    """Build knowledge graph."""
    print("\n" + "=" * 50)
    print("Step 4: Knowledge Graph")
    print("=" * 50)

    result = {"status": "skipped"}

    if dry_run:
        graph_json = REPO_ROOT / "graph" / "graph.json"
        if graph_json.exists():
            try:
                data = json.loads(graph_json.read_text(encoding="utf-8"))
                nodes = len(data.get("nodes", []))
                edges = len(data.get("edges", []))
                print(f"  Current graph: {nodes} nodes, {edges} edges")
                result = {"status": "exists", "nodes": nodes, "edges": edges}
            except Exception:
                print("  Graph exists but cannot be parsed")
        else:
            print("  No graph.json found")
        _log_step("graph", "preview", result)
    else:
        print("  Building graph... (this may take a moment)")
        t0 = time.time()
        try:
            import subprocess
            proc = subprocess.run(
                [sys.executable, str(REPO_ROOT / "tools" / "build_graph.py"), "--no-infer"],
                capture_output=True, text=True, timeout=120,
                cwd=str(REPO_ROOT),
            )
            elapsed = time.time() - t0
            if proc.returncode == 0:
                print(f"  Graph built in {elapsed:.1f}s")
                result = {"status": "built", "elapsed": round(elapsed, 1)}
            else:
                print(f"  [WARN] Graph build returned {proc.returncode}")
                if proc.stderr:
                    print(f"    stderr: {proc.stderr[:200]}")
                result = {"status": "error", "returncode": proc.returncode}
            _log_step("graph", "success" if proc.returncode == 0 else "error", result)
        except subprocess.TimeoutExpired:
            print("  [WARN] Graph build timed out (120s)")
            result = {"status": "timeout"}
            _log_step("graph", "timeout", result)
        except Exception as e:
            print(f"  [ERROR] Graph build failed: {e}")
            result = {"status": "error", "error": str(e)[:200]}
            _log_step("graph", "error", result)

    return result


def run_refresh(dry_run: bool = True) -> dict:
    """Refresh stale sources."""
    print("\n" + "=" * 50)
    print("Step 5: Refresh Stale Sources")
    print("=" * 50)

    result = {"status": "skipped"}

    try:
        from tools.refresh import main as refresh_main
        import io
        import contextlib

        f = io.StringIO()
        try:
            with contextlib.redirect_stdout(f):
                old_argv = sys.argv
                sys.argv = ["refresh.py"]
                if dry_run:
                    sys.argv.append("--dry-run")
                refresh_main()
                sys.argv = old_argv
            output = f.getvalue()
            lines = output.strip().split("\n")
            print(f"  {'[DRY RUN] ' if dry_run else ''}Refresh: {len(lines)} lines output")
            for line in lines[:5]:
                print(f"    {line}")
            result = {"status": "ok", "dry_run": dry_run}
        except SystemExit:
            result = {"status": "ok"}

        _log_step("refresh", "success", result)
    except ImportError:
        print("  [SKIP] refresh.py not available")
        _log_step("refresh", "skipped", {"reason": "import error"})
    except Exception as e:
        print(f"  [ERROR] Refresh failed: {e}")
        _log_step("refresh", "error", {"error": str(e)[:200]})

    return result


def show_status() -> None:
    """Show optimization history and scheduler metrics."""
    print("=" * 60)
    print("Self-Optimization Status")
    print("=" * 60)

    if HISTORY_FILE.exists():
        try:
            lines = HISTORY_FILE.read_text(encoding="utf-8").strip().split("\n")
            entries = [json.loads(l) for l in lines if l.strip()]
            recent = entries[-10:]
            print(f"\nOptimization History ({len(entries)} total, showing last {len(recent)}):")
            print(f"{'Timestamp':<20} {'Step':<12} {'Status':<10}")
            print("-" * 45)
            for e in recent:
                ts = e.get("timestamp", "")[:19]
                step = e.get("step", "?")
                status = e.get("status", "?")
                print(f"{ts:<20} {step:<12} {status:<10}")
        except Exception as e:
            print(f"  [WARN] Cannot read history: {e}")
    else:
        print("\nNo optimization history yet. Run with --dry-run first.")

    try:
        from tools.scheduler import JobMetrics
        m = JobMetrics()
        print(f"\n{m.get_health_panel()}")
        m.close()
    except Exception:
        pass

    try:
        from tools.shared.llm import LLMBudgetTracker
        bt = LLMBudgetTracker()
        summary = bt.get_summary()
        print(f"\nLLM Budget:")
        print(f"  Daily budget: ${summary['daily_budget_usd']}")
        print(f"  Current spend: ${summary['current_spend']}")
        print(f"  Percent used: {summary['percent_used']}%")
        print(f"  Today calls: {summary['today_calls']}")
    except Exception:
        pass

    try:
        from tools.shared.llm import LLMCircuitBreaker
        cb = LLMCircuitBreaker()
        status = cb.get_all_status()
        if status:
            print(f"\nCircuit Breaker:")
            for model, info in status.items():
                print(f"  {model}: {info['state']} (failures: {info['consecutive_failures']})")
        else:
            print(f"\nCircuit Breaker: no models tracked yet")
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser(
        description="Self-optimization orchestrator — diagnose → fix → prevent",
    )
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Preview only, don't fix (default)")
    parser.add_argument("--auto-fix", action="store_true",
                        help="Automatically fix issues")
    parser.add_argument("--scope",
                        choices=["health", "heal", "lint", "graph", "refresh", "all"],
                        default="all", help="Only optimize specified subsystem")
    parser.add_argument("--status", action="store_true",
                        help="Show optimization status and metrics")
    parser.add_argument("--verbose", action="store_true",
                        help="Show detailed output")
    args = parser.parse_args()

    if args.status:
        show_status()
        return

    dry_run = not args.auto_fix

    print("=" * 60)
    print(f"LLM Wiki Agent — Self-Optimization {'[DRY RUN]' if dry_run else '[AUTO-FIX]'}")
    print(f"Scope: {args.scope}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    t0 = time.time()
    scope = args.scope
    health_result = {}
    lint_result = {}

    if scope in ("health", "all"):
        health_result = run_health(dry_run=dry_run)

    if scope in ("lint", "all"):
        lint_result = run_lint(dry_run=dry_run)

    if scope in ("heal", "all"):
        run_heal(health_result, lint_result=lint_result if lint_result else None, dry_run=dry_run)

    if scope in ("graph", "all"):
        run_graph_build(dry_run=dry_run)

    if scope in ("refresh", "all"):
        run_refresh(dry_run=dry_run)

    elapsed = time.time() - t0
    print("\n" + "=" * 60)
    print(f"Self-optimization complete in {elapsed:.1f}s")
    if dry_run:
        print("Run with --auto-fix to apply changes.")
    print("=" * 60)


if __name__ == "__main__":
    main()
