#!/usr/bin/env python3
from __future__ import annotations

import os
import platform
import shutil
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent

REQUIRED_PACKAGES = [
    "litellm",
    "networkx",
    "markitdown",
    "tqdm",
    "psycopg2",
]

PG_TABLES = [
    "wiki_pages",
    "wiki_embeddings",
    "pipeline_state",
    "scheduler_jobs",
    "search_queries",
    "content_fingerprints",
    "domain_strategies",
    "refresh_monitor",
    "jarvis_events",
    "jarvis_approvals",
    "jarvis_goals",
    "jarvis_lessons",
    "jarvis_agents",
    "jarvis_tasks",
    "jarvis_plugins",
    "jarvis_scheduled_tasks",
    "jarvis_state",
    "jarvis_audit",
    "jarvis_tool_stats",
]

CONFIG_FILES = [
    "jarvis.yaml",
    "approval_policies.yaml",
]


class SelfDiagnose:
    def __init__(self):
        self.repo_root = REPO_ROOT
        self._state_dir = REPO_ROOT / "state"
        self._config_dir = REPO_ROOT / "config"

    def run_full_diagnosis(self) -> dict:
        return {
            "timestamp": datetime.now().isoformat(),
            "python_env": self.check_python_env(),
            "disk_space": self.check_disk_space(),
            "database_health": self.check_database_health(),
            "tool_health": self.check_tool_health(),
            "agent_loop_health": self.check_agent_loop_health(),
            "memory_usage": self.check_memory_usage(),
            "config_files": self.check_config_files(),
        }

    def check_python_env(self) -> dict:
        packages: list[dict] = []
        all_ok = True
        for pkg_name in REQUIRED_PACKAGES:
            try:
                mod = __import__(pkg_name)
                version = getattr(mod, "__version__", "unknown")
                available = True
            except ImportError:
                version = "not installed"
                available = False
                all_ok = False
            packages.append({
                "name": pkg_name,
                "version": version,
                "available": available,
            })

        in_venv = hasattr(sys, "real_prefix") or (
            hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix
        )

        return {
            "status": "healthy" if all_ok else "warning",
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "python_executable": sys.executable,
            "platform": platform.platform(),
            "packages": packages,
            "venv": in_venv,
        }

    def check_disk_space(self) -> dict:
        try:
            usage = shutil.disk_usage(str(self.repo_root))
            total_gb = round(usage.total / (1024 ** 3), 2)
            free_gb = round(usage.free / (1024 ** 3), 2)
            used_percent = round((usage.used / usage.total) * 100, 1)
        except Exception:
            total_gb = 0.0
            free_gb = 0.0
            used_percent = 0.0

        def _dir_size_mb(path: Path) -> float:
            if not path.exists():
                return 0.0
            total = 0
            for f in path.rglob("*"):
                if f.is_file():
                    try:
                        total += f.stat().st_size
                    except OSError:
                        pass
            return round(total / (1024 ** 2), 2)

        status = "healthy" if used_percent < 90 else ("warning" if used_percent < 98 else "critical")

        return {
            "status": status,
            "total_gb": total_gb,
            "free_gb": free_gb,
            "used_percent": used_percent,
            "wiki_size_mb": _dir_size_mb(self.repo_root / "wiki"),
            "raw_size_mb": _dir_size_mb(self.repo_root / "raw"),
            "state_size_mb": _dir_size_mb(self._state_dir),
            "graph_size_mb": _dir_size_mb(self.repo_root / "graph"),
        }

    def check_database_health(self) -> dict:
        tables: list[dict] = []
        all_healthy = True

        try:
            from tools.jarvis.jarvis_pg import get_pg_conn
            with get_pg_conn() as conn:
                cur = conn.cursor()
                cur.execute(
                    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
                )
                existing = {r[0] for r in cur.fetchall()}

                for table_name in PG_TABLES:
                    if table_name not in existing:
                        tables.append({
                            "name": table_name,
                            "exists": False,
                            "status": "missing",
                            "row_count": 0,
                        })
                        all_healthy = False
                        continue
                    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                    row_count = cur.fetchone()[0]
                    tables.append({
                        "name": table_name,
                        "exists": True,
                        "status": "healthy",
                        "row_count": row_count,
                    })
                cur.close()
        except Exception as exc:
            all_healthy = False
            tables.append({
                "name": "postgresql",
                "exists": False,
                "status": f"error: {exc}",
                "row_count": 0,
            })

        return {
            "status": "healthy" if all_healthy else "warning",
            "tables": tables,
        }

    def check_tool_health(self) -> dict:
        broken: list[str] = []
        healthy = 0
        total = 0

        try:
            from tools.jarvis.tool_registry import get_registry
            registry = get_registry()
            health_data = registry.health_check()
            total = len(health_data)
            for tool_name, info in health_data.items():
                if info.get("callable", False):
                    healthy += 1
                else:
                    broken.append(tool_name)
        except Exception:
            pass

        status = "healthy" if not broken and total > 0 else ("warning" if total > 0 else "error")

        return {
            "status": status,
            "total": total,
            "healthy": healthy,
            "broken": broken,
        }

    def check_agent_loop_health(self) -> dict:
        try:
            from tools.jarvis.loop import get_agent_loop
            loop = get_agent_loop()
            status_data = loop.get_status()
            error_rate = 0.0
            total = status_data.get("total_tool_calls", 0)
            failed = status_data.get("total_failed", 0)
            if total > 0:
                error_rate = round(failed / total * 100, 1)

            loop_status = status_data.get("status", "stopped")
            if loop_status in ("running", "idle"):
                health = "healthy" if error_rate < 25 else "warning"
            elif loop_status == "error":
                health = "error"
            else:
                health = "info"

            return {
                "status": health,
                "agent_status": loop_status,
                "cycle_count": status_data.get("cycle_count", 0),
                "last_cycle_time": status_data.get("last_cycle_time", ""),
                "total_tool_calls": total,
                "total_success": status_data.get("total_success", 0),
                "total_failed": failed,
                "error_rate_percent": error_rate,
                "pending_approvals": status_data.get("pending_approvals", 0),
                "success_rate": status_data.get("success_rate", "0.0%"),
            }
        except Exception as exc:
            return {
                "status": "error",
                "error": str(exc),
                "agent_status": "unavailable",
                "cycle_count": 0,
                "last_cycle_time": "",
                "total_tool_calls": 0,
                "total_success": 0,
                "total_failed": 0,
                "error_rate_percent": 0.0,
                "pending_approvals": 0,
                "success_rate": "n/a",
            }

    def check_memory_usage(self) -> dict:
        try:
            import psutil
            proc = psutil.Process()
            mem_info = proc.memory_info()
            rss_mb = round(mem_info.rss / (1024 ** 2), 2)
            vms_mb = round(mem_info.vms / (1024 ** 2), 2)
            try:
                percent = round(proc.memory_percent(), 2)
            except Exception:
                percent = 0.0
        except ImportError:
            rss_mb = 0.0
            vms_mb = 0.0
            percent = 0.0

        status = "healthy" if rss_mb < 500 else ("warning" if rss_mb < 1000 else "critical")

        return {
            "status": status,
            "rss_mb": rss_mb,
            "vms_mb": vms_mb,
            "percent": percent,
            "psutil_available": True if rss_mb > 0 else False,
        }

    def check_config_files(self) -> dict:
        configs: list[dict] = []
        all_ok = True

        for cfg_name in CONFIG_FILES:
            cfg_path = self._config_dir / cfg_name
            if not cfg_path.exists():
                configs.append({
                    "name": cfg_name,
                    "exists": False,
                    "status": "missing",
                    "valid": False,
                })
                all_ok = False
                continue
            valid = True
            try:
                import yaml
                with open(cfg_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                if not isinstance(data, dict):
                    valid = False
                    all_ok = False
            except ImportError:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                valid = len(content) > 0
                if not valid:
                    all_ok = False
            except Exception:
                valid = False
                all_ok = False
            configs.append({
                "name": cfg_name,
                "exists": True,
                "status": "valid" if valid else "invalid",
                "valid": valid,
                "path": str(cfg_path),
            })

        return {
            "status": "healthy" if all_ok else "warning",
            "configs": configs,
        }

    def generate_report(self) -> str:
        diag = self.run_full_diagnosis()
        lines: list[str] = []
        lines.append("=" * 60)
        lines.append("  Jarvis Self-Diagnosis Report")
        lines.append(f"  Generated: {diag['timestamp']}")
        lines.append("=" * 60)

        def _icon(status: str) -> str:
            if status in ("healthy", "valid", "ok"):
                return "\u2705"
            if status in ("warning", "info"):
                return "\u26a0\ufe0f"
            if status in ("error", "corrupt", "critical", "missing"):
                return "\u274c"
            return "\u2753"

        py = diag["python_env"]
        lines.append("")
        lines.append(f"{_icon(py['status'])} Python Environment")
        lines.append(f"  Python: {py['python_version']} ({py['platform']})")
        lines.append(f"  Executable: {py['python_executable']}")
        lines.append(f"  Virtual env: {'yes' if py['venv'] else 'no'}")
        for pkg in py["packages"]:
            mark = _icon("healthy" if pkg["available"] else "error")
            lines.append(f"    {mark} {pkg['name']}: {pkg['version']}")

        disk = diag["disk_space"]
        lines.append("")
        lines.append(f"{_icon(disk['status'])} Disk Space")
        lines.append(f"  Total: {disk['total_gb']} GB | Free: {disk['free_gb']} GB | Used: {disk['used_percent']}%")
        lines.append(f"  wiki/: {disk['wiki_size_mb']} MB | raw/: {disk['raw_size_mb']} MB")
        lines.append(f"  state/: {disk['state_size_mb']} MB | graph/: {disk['graph_size_mb']} MB")

        db = diag["database_health"]
        lines.append("")
        lines.append(f"{_icon(db['status'])} Database Health (PostgreSQL)")
        for d in db["tables"]:
            mark = _icon(d["status"])
            rows_info = f" ({d['row_count']} rows)" if d["exists"] else ""
            lines.append(f"  {mark} {d['name']}: {d['status']}{rows_info}")

        tools = diag["tool_health"]
        lines.append("")
        lines.append(f"{_icon(tools['status'])} Tool Health")
        lines.append(f"  Total: {tools['total']} | Healthy: {tools['healthy']} | Broken: {len(tools['broken'])}")
        for b in tools["broken"]:
            lines.append(f"    \u274c {b}")

        agent = diag["agent_loop_health"]
        lines.append("")
        lines.append(f"{_icon(agent['status'])} Agent Loop")
        lines.append(f"  Status: {agent['agent_status']}")
        lines.append(f"  Cycles: {agent['cycle_count']} | Last: {agent['last_cycle_time'] or 'never'}")
        lines.append(f"  Tool calls: {agent['total_tool_calls']} | Success: {agent['total_success']} | Failed: {agent['total_failed']}")
        lines.append(f"  Error rate: {agent['error_rate_percent']}% | Success rate: {agent['success_rate']}")
        lines.append(f"  Pending approvals: {agent['pending_approvals']}")

        mem = diag["memory_usage"]
        lines.append("")
        lines.append(f"{_icon(mem['status'])} Memory Usage")
        if mem["psutil_available"]:
            lines.append(f"  RSS: {mem['rss_mb']} MB | VMS: {mem['vms_mb']} MB | Percent: {mem['percent']}%")
        else:
            lines.append("  psutil not available — memory stats unavailable")

        cfg = diag["config_files"]
        lines.append("")
        lines.append(f"{_icon(cfg['status'])} Configuration Files")
        for c in cfg["configs"]:
            mark = _icon(c["status"])
            lines.append(f"  {mark} {c['name']}: {c['status']}" + (f" ({c.get('path', '')})" if c["exists"] else ""))

        lines.append("")
        lines.append("=" * 60)

        recommendations: list[str] = []
        if disk["used_percent"] > 90:
            recommendations.append("- Disk usage above 90% — consider freeing space")
        if mem["rss_mb"] > 500:
            recommendations.append("- RSS memory above 500 MB — investigate memory leaks")
        if tools["broken"]:
            recommendations.append(f"- {len(tools['broken'])} broken tools detected — check tool registration")
        missing_pkgs = [p["name"] for p in py["packages"] if not p["available"]]
        if missing_pkgs:
            recommendations.append(f"- Missing packages: {', '.join(missing_pkgs)}")
        missing_tables = [d["name"] for d in db["tables"] if d["status"] == "missing"]
        if missing_tables:
            recommendations.append(f"- Missing PG tables: {', '.join(missing_tables)}")
        missing_cfgs = [c["name"] for c in cfg["configs"] if not c["exists"]]
        if missing_cfgs:
            recommendations.append(f"- Missing config files: {', '.join(missing_cfgs)}")

        if recommendations:
            lines.append("  Recommendations:")
            for rec in recommendations:
                lines.append(f"  {rec}")
            lines.append("=" * 60)
        else:
            lines.append("  All systems nominal.")

        return "\n".join(lines)


_diagnose: SelfDiagnose | None = None


def get_self_diagnose() -> SelfDiagnose:
    global _diagnose
    if _diagnose is None:
        _diagnose = SelfDiagnose()
    return _diagnose
