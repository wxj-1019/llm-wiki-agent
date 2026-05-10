#!/usr/bin/env python3
from __future__ import annotations

import os
import platform
import subprocess
import sys
import time
from pathlib import Path

from tools.jarvis.tool_registry import register_tool
from tools.jarvis.types import RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent.parent

try:
    import psutil
    _HAS_PSUTIL = True
except ImportError:
    _HAS_PSUTIL = False


def _resolve_path(path: str) -> Path | None:
    if ".." in Path(path).parts:
        return None
    resolved = REPO_ROOT / path
    try:
        resolved.resolve().relative_to(REPO_ROOT.resolve())
    except ValueError:
        return None
    return resolved


def _register_file_read():
    @register_tool(
        name="file_read",
        description="Read file content from the repository",
        risk_level=RiskLevel.L0,
        input_schema={
            "path": {"type": "str", "required": True},
            "encoding": {"type": "str", "required": False},
        },
        output_schema={"content": {"type": "str"}, "size": {"type": "int"}},
        category="system",
    )
    def file_read(path: str, encoding: str = "utf-8") -> dict:
        target = _resolve_path(path)
        if target is None:
            return {"content": "", "size": 0, "error": "Path traversal rejected"}
        if not target.exists() or not target.is_file():
            return {"content": "", "size": 0, "error": f"File not found: {path}"}
        content = target.read_text(encoding=encoding)
        return {"content": content, "size": len(content)}


def _register_file_write():
    @register_tool(
        name="file_write",
        description="Write content to a file in the repository",
        risk_level=RiskLevel.L2,
        input_schema={
            "path": {"type": "str", "required": True},
            "content": {"type": "str", "required": True},
            "encoding": {"type": "str", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "size": {"type": "int"}},
        category="system",
    )
    def file_write(path: str, content: str, encoding: str = "utf-8") -> dict:
        target = _resolve_path(path)
        if target is None:
            return {"success": False, "size": 0, "error": "Path traversal rejected"}
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding=encoding)
        return {"success": True, "size": len(content)}


def _register_file_list():
    @register_tool(
        name="file_list",
        description="List directory contents in the repository",
        risk_level=RiskLevel.L0,
        input_schema={
            "path": {"type": "str", "required": False},
            "pattern": {"type": "str", "required": False},
        },
        output_schema={
            "files": {"type": "list[str]"},
            "dirs": {"type": "list[str]"},
            "total": {"type": "int"},
        },
        category="system",
    )
    def file_list(path: str = ".", pattern: str = "*") -> dict:
        target = _resolve_path(path)
        if target is None:
            return {"files": [], "dirs": [], "total": 0, "error": "Path traversal rejected"}
        if not target.exists() or not target.is_dir():
            return {"files": [], "dirs": [], "total": 0, "error": f"Directory not found: {path}"}
        files = []
        dirs = []
        for entry in sorted(target.glob(pattern)):
            if entry.is_file():
                files.append(entry.name)
            elif entry.is_dir():
                dirs.append(entry.name)
        return {"files": files, "dirs": dirs, "total": len(files) + len(dirs)}


def _register_file_delete():
    @register_tool(
        name="file_delete",
        description="Delete a file from the repository (not directories)",
        risk_level=RiskLevel.L3,
        input_schema={"path": {"type": "str", "required": True}},
        output_schema={"success": {"type": "bool"}},
        category="system",
    )
    def file_delete(path: str) -> dict:
        normalized = path.replace("\\", "/")
        parts = Path(normalized).parts
        if "raw" in parts:
            return {"success": False, "error": "Cannot delete files in raw/"}
        if normalized.startswith("raw") or normalized.startswith("./raw"):
            return {"success": False, "error": "Cannot delete files in raw/"}
        target = _resolve_path(path)
        if target is None:
            return {"success": False, "error": "Path traversal rejected"}
        if not target.exists():
            return {"success": False, "error": f"File not found: {path}"}
        if target.is_dir():
            return {"success": False, "error": "Cannot delete directories"}
        target.unlink()
        return {"success": True}


def _register_process_list():
    @register_tool(
        name="process_list",
        description="List running processes",
        risk_level=RiskLevel.L0,
        input_schema={},
        output_schema={"processes": {"type": "list[dict]"}},
        category="system",
    )
    def process_list() -> dict:
        if _HAS_PSUTIL:
            procs = []
            for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info"]):
                try:
                    info = p.info
                    mem_mb = info["memory_info"].rss / (1024 * 1024) if info["memory_info"] else 0.0
                    procs.append({
                        "pid": info["pid"],
                        "name": info["name"] or "",
                        "cpu_percent": info["cpu_percent"] or 0.0,
                        "memory_mb": round(mem_mb, 2),
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            return {"processes": procs}

        is_windows = platform.system() == "Windows"
        cmd = ["tasklist", "/FO", "CSV"] if is_windows else ["ps", "aux"]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return {"processes": []}

        procs = []
        for line in result.stdout.strip().splitlines():
            if is_windows:
                parts = line.replace('"', "").split(",")
                if len(parts) >= 2:
                    try:
                        procs.append({
                            "pid": int(parts[1]),
                            "name": parts[0],
                            "cpu_percent": 0.0,
                            "memory_mb": 0.0,
                        })
                    except ValueError:
                        continue
            else:
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    try:
                        procs.append({
                            "pid": int(parts[1]),
                            "name": parts[10][:80],
                            "cpu_percent": float(parts[2]),
                            "memory_mb": float(parts[5]),
                        })
                    except ValueError:
                        continue
        return {"processes": procs}


def _register_process_kill():
    @register_tool(
        name="process_kill",
        description="Kill a running process by PID",
        risk_level=RiskLevel.L3,
        input_schema={
            "pid": {"type": "int", "required": True},
            "force": {"type": "bool", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "message": {"type": "str"}},
        category="system",
    )
    def process_kill(pid: int, force: bool = False) -> dict:
        if _HAS_PSUTIL:
            try:
                p = psutil.Process(pid)
                p.kill() if force else p.terminate()
                return {"success": True, "message": f"Process {pid} {'killed' if force else 'terminated'}"}
            except psutil.NoSuchProcess:
                return {"success": False, "message": f"No such process: {pid}"}
            except psutil.AccessDenied:
                return {"success": False, "message": f"Access denied killing process: {pid}"}

        is_windows = platform.system() == "Windows"
        if is_windows:
            cmd = ["taskkill", "/PID", str(pid)]
            if force:
                cmd.append("/F")
        else:
            sig = 9 if force else 15
            cmd = ["kill", f"-{sig}", str(pid)]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return {"success": True, "message": f"Process {pid} {'killed' if force else 'terminated'}"}
            return {"success": False, "message": result.stderr.strip() or f"Failed to kill process {pid}"}
        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            return {"success": False, "message": str(exc)}


def _register_terminal_exec():
    @register_tool(
        name="terminal_exec",
        description="Execute a terminal command and return output",
        risk_level=RiskLevel.L3,
        input_schema={
            "command": {"type": "str", "required": True},
            "cwd": {"type": "str", "required": False},
            "timeout": {"type": "int", "required": False},
            "shell": {"type": "bool", "required": False},
        },
        output_schema={
            "stdout": {"type": "str"},
            "stderr": {"type": "str"},
            "returncode": {"type": "int"},
            "duration_ms": {"type": "float"},
        },
        category="system",
    )
    def terminal_exec(command: str, cwd: str = "", timeout: int = 60, shell: bool = True) -> dict:
        exec_cwd = str(REPO_ROOT / cwd) if cwd else str(REPO_ROOT)
        start = time.perf_counter()
        try:
            result = subprocess.run(
                command if shell else command.split(),
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=exec_cwd,
                shell=shell,
            )
            duration_ms = (time.perf_counter() - start) * 1000
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "duration_ms": round(duration_ms, 2),
            }
        except subprocess.TimeoutExpired:
            duration_ms = (time.perf_counter() - start) * 1000
            return {
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s",
                "returncode": -1,
                "duration_ms": round(duration_ms, 2),
            }
        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            return {
                "stdout": "",
                "stderr": str(exc),
                "returncode": -1,
                "duration_ms": round(duration_ms, 2),
            }


def _register_system_info():
    @register_tool(
        name="system_info",
        description="Get system resource and platform information",
        risk_level=RiskLevel.L0,
        input_schema={},
        output_schema={
            "cpu_count": {"type": "int"},
            "cpu_percent": {"type": "float"},
            "memory_total_gb": {"type": "float"},
            "memory_used_gb": {"type": "float"},
            "memory_percent": {"type": "float"},
            "disk_total_gb": {"type": "float"},
            "disk_used_gb": {"type": "float"},
            "disk_percent": {"type": "float"},
            "platform": {"type": "str"},
            "python_version": {"type": "str"},
        },
        category="system",
    )
    def system_info() -> dict:
        if _HAS_PSUTIL:
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage(str(REPO_ROOT))
            return {
                "cpu_count": psutil.cpu_count(),
                "cpu_percent": psutil.cpu_percent(interval=0.5),
                "memory_total_gb": round(mem.total / (1024 ** 3), 2),
                "memory_used_gb": round(mem.used / (1024 ** 3), 2),
                "memory_percent": round(mem.percent, 1),
                "disk_total_gb": round(disk.total / (1024 ** 3), 2),
                "disk_used_gb": round(disk.used / (1024 ** 3), 2),
                "disk_percent": round(disk.percent, 1),
                "platform": platform.platform(),
                "python_version": platform.python_version(),
            }
        return {
            "cpu_count": os.cpu_count() or 0,
            "cpu_percent": 0.0,
            "memory_total_gb": 0.0,
            "memory_used_gb": 0.0,
            "memory_percent": 0.0,
            "disk_total_gb": 0.0,
            "disk_used_gb": 0.0,
            "disk_percent": 0.0,
            "platform": platform.platform(),
            "python_version": platform.python_version(),
        }


_ALL_REGISTRARS = [
    _register_file_read,
    _register_file_write,
    _register_file_list,
    _register_file_delete,
    _register_process_list,
    _register_process_kill,
    _register_terminal_exec,
    _register_system_info,
]


def register_all():
    for registrar in _ALL_REGISTRARS:
        try:
            registrar()
        except Exception as exc:
            print(f"WARNING: failed to register tool from {registrar.__name__}: {exc}")
