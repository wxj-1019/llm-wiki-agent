#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

from tools.jarvis.shared_utils import safe_subprocess, normalize_path

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.tool_registry import register_tool
from tools.jarvis.types import RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent.parent


def _run_git(args: list[str], cwd: str = "") -> dict:
    work_dir = cwd if cwd else str(REPO_ROOT)
    return safe_subprocess(
        ["git"] + args,
        cwd=work_dir,
        timeout=60,
    )


def _register_git_status():
    @register_tool(
        name="git_status",
        description="Run git status to see working tree state",
        risk_level=RiskLevel.L0,
        input_schema={"path": {"type": "str", "required": False}},
        output_schema={"output": {"type": "str"}, "branch": {"type": "str"}},
        category="dev",
    )
    def git_status(path: str = "") -> dict:
        result = _run_git(["status", "--porcelain", "-b"], cwd=path)
        branch = ""
        for line in result["stdout"].splitlines():
            if line.startswith("## "):
                branch = line[3:].split("...")[0]
                break
        return {"output": result["stdout"], "branch": branch}


def _register_git_diff():
    @register_tool(
        name="git_diff",
        description="Run git diff to see changes",
        risk_level=RiskLevel.L0,
        input_schema={
            "path": {"type": "str", "required": False},
            "staged": {"type": "bool", "required": False},
        },
        output_schema={"output": {"type": "str"}, "files_changed": {"type": "int"}},
        category="dev",
    )
    def git_diff(path: str = "", staged: bool = False) -> dict:
        args = ["diff"]
        if staged:
            args.append("--staged")
        result = _run_git(args, cwd=path)
        files_changed = sum(
            1 for line in result["stdout"].splitlines() if line.startswith("---")
        )
        return {"output": result["stdout"], "files_changed": files_changed}


def _register_git_log():
    @register_tool(
        name="git_log",
        description="View git log entries",
        risk_level=RiskLevel.L0,
        input_schema={
            "count": {"type": "int", "required": False},
            "format": {"type": "str", "required": False},
        },
        output_schema={"entries": {"type": "list[str]"}},
        category="dev",
    )
    def git_log(count: int = 10, format: str = "%h %s (%cr)") -> dict:
        result = _run_git(["log", f"--pretty=format:{format}", f"-{count}"])
        entries = result["stdout"].splitlines() if result["stdout"].strip() else []
        return {"entries": entries}


def _register_git_commit():
    @register_tool(
        name="git_commit",
        description="Git commit with optional add-all",
        risk_level=RiskLevel.L3,
        input_schema={
            "message": {"type": "str", "required": True},
            "add_all": {"type": "bool", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "output": {"type": "str"}},
        category="dev",
    )
    def git_commit(message: str, add_all: bool = False) -> dict:
        if add_all:
            add_result = _run_git(["add", "-A"])
            if add_result["returncode"] != 0:
                return {"success": False, "output": add_result["stderr"]}
        result = _run_git(["commit", "-m", message])
        output = result["stdout"]
        if result["stderr"]:
            output += "\n" + result["stderr"]
        return {"success": result["returncode"] == 0, "output": output}


def _register_git_push():
    @register_tool(
        name="git_push",
        description="Git push to remote",
        risk_level=RiskLevel.L3,
        input_schema={
            "remote": {"type": "str", "required": False},
            "branch": {"type": "str", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "output": {"type": "str"}},
        category="dev",
    )
    def git_push(remote: str = "origin", branch: str = "") -> dict:
        args = ["push", remote]
        if branch:
            args.append(branch)
        result = _run_git(args)
        output = result["stdout"]
        if result["stderr"]:
            output += "\n" + result["stderr"]
        return {"success": result["returncode"] == 0, "output": output}


def _register_git_pull():
    @register_tool(
        name="git_pull",
        description="Git pull from remote",
        risk_level=RiskLevel.L2,
        input_schema={
            "remote": {"type": "str", "required": False},
            "branch": {"type": "str", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "output": {"type": "str"}},
        category="dev",
    )
    def git_pull(remote: str = "origin", branch: str = "") -> dict:
        args = ["pull", remote]
        if branch:
            args.append(branch)
        result = _run_git(args)
        output = result["stdout"]
        if result["stderr"]:
            output += "\n" + result["stderr"]
        return {"success": result["returncode"] == 0, "output": output}


def _register_db_query():
    @register_tool(
        name="db_query",
        description="Query a local SQLite database (SELECT / EXPLAIN / PRAGMA only)",
        risk_level=RiskLevel.L2,
        input_schema={
            "db_path": {"type": "str", "required": True},
            "query": {"type": "str", "required": True},
            "params": {"type": "list", "required": False},
        },
        output_schema={
            "rows": {"type": "list[dict]"},
            "row_count": {"type": "int"},
            "columns": {"type": "list[str]"},
        },
        category="dev",
    )
    def db_query(db_path: str, query: str, params: list = []) -> dict:
        resolved = normalize_path(db_path, str(REPO_ROOT))
        if resolved is None:
            return {"rows": [], "row_count": 0, "columns": [], "error": "path traversal denied"}
        if not resolved.exists():
            return {"rows": [], "row_count": 0, "columns": [], "error": f"database not found: {db_path}"}
        normalized = query.strip().lstrip()
        if not normalized.upper().startswith(("SELECT", "EXPLAIN", "PRAGMA")):
            return {"rows": [], "row_count": 0, "columns": [], "error": "only SELECT / EXPLAIN / PRAGMA queries allowed"}
        try:
            conn = sqlite3.connect(str(resolved))
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(normalized, params)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return {"rows": rows, "row_count": len(rows), "columns": columns}
        except Exception as exc:
            return {"rows": [], "row_count": 0, "columns": [], "error": str(exc)}


def _register_pg_query():
    @register_tool(
        name="pg_query",
        description="Query the PostgreSQL database (SELECT / EXPLAIN / SHOW only). Uses the configured PG connection.",
        risk_level=RiskLevel.L2,
        input_schema={
            "query": {"type": "str", "required": True},
            "params": {"type": "list", "required": False},
        },
        output_schema={
            "rows": {"type": "list[dict]"},
            "row_count": {"type": "int"},
            "columns": {"type": "list[str]"},
        },
        category="dev",
    )
    def pg_query(query: str, params: list = []) -> dict:
        normalized = query.strip().lstrip()
        if not normalized.upper().startswith(("SELECT", "EXPLAIN", "SHOW")):
            return {"rows": [], "row_count": 0, "columns": [], "error": "only SELECT / EXPLAIN / SHOW queries allowed"}
        try:
            with get_pg_conn() as conn:
                cur = conn.cursor()
                cur.execute(normalized, params)
                columns = [desc[0] for desc in cur.description] if cur.description else []
                rows = []
                for row in cur.fetchall():
                    rows.append({col: (row[i].isoformat() if hasattr(row[i], 'isoformat') else row[i]) for i, col in enumerate(columns)})
                cur.close()
            return {"rows": rows, "row_count": len(rows), "columns": columns}
        except Exception as exc:
            return {"rows": [], "row_count": 0, "columns": [], "error": str(exc)}


def _register_build_run():
    @register_tool(
        name="build_run",
        description="Run a build command",
        risk_level=RiskLevel.L2,
        input_schema={
            "command": {"type": "str", "required": False},
            "cwd": {"type": "str", "required": False},
            "timeout": {"type": "int", "required": False},
        },
        output_schema={
            "success": {"type": "bool"},
            "stdout": {"type": "str"},
            "stderr": {"type": "str"},
            "returncode": {"type": "int"},
        },
        category="dev",
    )
    def build_run(command: str = "npm run build", cwd: str = "", timeout: int = 300) -> dict:
        work_dir = cwd if cwd else str(REPO_ROOT)
        result = safe_subprocess(command, cwd=work_dir, timeout=timeout, shell=True)
        return {
            "success": result["returncode"] == 0,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "returncode": result["returncode"],
        }


def _register_test_run():
    @register_tool(
        name="test_run",
        description="Run tests",
        risk_level=RiskLevel.L1,
        input_schema={
            "command": {"type": "str", "required": False},
            "cwd": {"type": "str", "required": False},
            "timeout": {"type": "int", "required": False},
        },
        output_schema={
            "success": {"type": "bool"},
            "stdout": {"type": "str"},
            "stderr": {"type": "str"},
            "returncode": {"type": "int"},
        },
        category="dev",
    )
    def test_run(command: str = "python -m pytest", cwd: str = "", timeout: int = 300) -> dict:
        work_dir = cwd if cwd else str(REPO_ROOT)
        result = safe_subprocess(command, cwd=work_dir, timeout=timeout, shell=True)
        return {
            "success": result["returncode"] == 0,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "returncode": result["returncode"],
        }


def _register_pip_install():
    @register_tool(
        name="pip_install",
        description="Install a Python package via pip",
        risk_level=RiskLevel.L3,
        input_schema={
            "package": {"type": "str", "required": True},
            "upgrade": {"type": "bool", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "output": {"type": "str"}},
        category="dev",
    )
    def pip_install(package: str, upgrade: bool = False) -> dict:
        cmd = [sys.executable, "-m", "pip", "install", package]
        if upgrade:
            cmd.append("--upgrade")
        result = safe_subprocess(cmd, timeout=300)
        output = result["stdout"]
        if result["stderr"]:
            output += "\n" + result["stderr"]
        return {"success": result["returncode"] == 0, "output": output}


_ALL_REGISTRARS = [
    _register_git_status,
    _register_git_diff,
    _register_git_log,
    _register_git_commit,
    _register_git_push,
    _register_git_pull,
    _register_db_query,
    _register_pg_query,
    _register_build_run,
    _register_test_run,
    _register_pip_install,
]


def register_all():
    for registrar in _ALL_REGISTRARS:
        try:
            registrar()
        except Exception as exc:
            print(f"WARNING: failed to register tool from {registrar.__name__}: {exc}")
