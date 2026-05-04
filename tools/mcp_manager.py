#!/usr/bin/env python3
"""MCP Server runtime manager for LLM Wiki Agent."""
from __future__ import annotations

import atexit
import collections
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

_SAFE_NAME_RE = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$')

try:
    import psutil
except ImportError:
    psutil = None

REPO = Path(__file__).parent.parent
MCP_SERVERS_DIR = REPO / "mcp-servers"
MCP_REGISTRY_PATH = MCP_SERVERS_DIR / "installed.json"
DEFAULT_MAX_SERVERS = 5


class MCPManager:
    def __init__(self, base_dir: Path = MCP_SERVERS_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.registry_path = base_dir / "installed.json"
        self.processes: dict[str, subprocess.Popen] = {}
        self.log_buffers: dict[str, collections.deque] = {}
        self.max_servers = int(os.getenv("MCP_MAX_SERVERS", str(DEFAULT_MAX_SERVERS)))
        self._load_registry()
        atexit.register(self.stop_all)

    def _load_registry(self):
        if self.registry_path.exists():
            try:
                self.registry = json.loads(self.registry_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self.registry = {"version": 1, "servers": []}
        else:
            self.registry = {"version": 1, "servers": []}

    def _save_registry(self):
        self.registry_path.write_text(
            json.dumps(self.registry, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def list_servers(self) -> list[dict]:
        servers = self.registry.get("servers", [])
        result = []
        for s in servers:
            entry = dict(s)
            proc = self.processes.get(entry["name"])
            if proc and proc.poll() is None:
                entry["status"] = "running"
                entry["pid"] = proc.pid
                if psutil:
                    try:
                        p = psutil.Process(proc.pid)
                        entry["memory_mb"] = round(p.memory_info().rss / 1024 / 1024, 1)
                        entry["cpu_percent"] = round(p.cpu_percent(interval=0.05), 1)
                        entry["uptime_sec"] = round(time.time() - p.create_time(), 0)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            elif entry.get("status") == "running":
                entry["status"] = "stopped"
                entry["pid"] = None
            result.append(entry)
        return result

    def install(self, name: str, source: str, **kwargs) -> dict:
        if not _SAFE_NAME_RE.match(name):
            return {"error": f"Invalid server name: {name}. Use only alphanumeric, hyphens, underscores (2-64 chars)"}
        if len(self.registry.get("servers", [])) >= self.max_servers:
            return {"error": f"Maximum {self.max_servers} servers limit reached"}
        server_dir = self.base_dir / name
        if server_dir.exists() and any(server_dir.iterdir()):
            return {"error": f"Server already exists: {name}"}

        server_dir.mkdir(parents=True, exist_ok=True)

        if source == "generated":
            self._install_generated(name, server_dir, kwargs)
        elif source == "pip":
            result = self._install_pip(name, server_dir, kwargs)
            if "error" in result:
                return result
        elif source == "url":
            result = self._install_url(name, server_dir, kwargs)
            if "error" in result:
                return result
        elif source == "local":
            result = self._install_local(name, server_dir, kwargs)
            if "error" in result:
                return result
        else:
            return {"error": f"Unsupported source: {source}"}

        entry = {
            "name": name,
            "display_name": kwargs.get("display_name", name),
            "description": kwargs.get("description", ""),
            "version": kwargs.get("version", "1.0.0"),
            "source": source,
            "status": "stopped",
            "port": None,
            "pid": None,
            "transport": kwargs.get("transport", "stdio"),
            "tools": kwargs.get("tools", []),
            "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "health": {"last_check": None, "status": "unknown", "error_count": 0},
            "config": kwargs.get("config", {}),
        }
        self.registry["servers"].append(entry)
        self._save_registry()
        return {"name": name, "status": "installed"}

    def _install_generated(self, name: str, server_dir: Path, kwargs: dict):
        code = kwargs.get("code", "")
        if code:
            (server_dir / "server.py").write_text(code, encoding="utf-8")
        req = kwargs.get("requirements", "")
        if req:
            (server_dir / "requirements.txt").write_text(req, encoding="utf-8")

    def _install_pip(self, name: str, server_dir: Path, kwargs: dict) -> dict:
        package = kwargs.get("package", "")
        if not package:
            return {"error": "package is required for pip source"}
        # Validate package name to prevent command injection
        if not re.match(r'^[a-zA-Z0-9_.-]+$', package) or len(package) > 100:
            return {"error": f"Invalid package name: {package}"}
        # Package whitelist to reduce supply-chain attack surface
        env_whitelist = {p.strip() for p in os.getenv("MCP_PACKAGE_WHITELIST", "").split(",") if p.strip()}
        default_whitelist = {
            "mcp-server-filesystem", "mcp-server-github", "mcp-server-gitlab",
            "mcp-server-slack", "mcp-server-sqlite", "mcp-server-puppeteer",
            "mcp", "mcp-server", "mcp-client",
        }
        allowed = default_whitelist | env_whitelist
        if package not in allowed:
            return {"error": f"Package '{package}' is not in the allowed whitelist. Set MCP_PACKAGE_WHITELIST env var to extend."}
        # Install into server-specific directory for isolation
        target_dir = server_dir / "packages"
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package, "--target", str(target_dir)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return {"error": f"pip install failed: {result.stderr[:500]}"}
        return {}

    def _install_url(self, name: str, server_dir: Path, kwargs: dict) -> dict:
        url = kwargs.get("url", "")
        if not url:
            return {"error": "url is required for url source"}
        if not url.startswith(("https://", "git://", "git@")):
            return {"error": "Only https://, git://, and git@ URLs are allowed"}
        result = subprocess.run(
            ["git", "clone", url, str(server_dir)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return {"error": f"git clone failed: {result.stderr[:500]}"}
        req_file = server_dir / "requirements.txt"
        if req_file.exists():
            # Install into server-specific directory for isolation
            target_dir = server_dir / "packages"
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", str(req_file), "--target", str(target_dir)],
                capture_output=True, text=True, timeout=120,
            )
        return {}

    def _install_local(self, name: str, server_dir: Path, kwargs: dict) -> dict:
        path = kwargs.get("path", "")
        if not path:
            return {"error": "path is required for local source"}
        src = (REPO / path).resolve()
        if not src.exists():
            return {"error": f"Local path not found: {path}"}
        # Path traversal protection
        try:
            src.relative_to(REPO.resolve())
        except ValueError:
            return {"error": "Invalid path: must be within repository"}
        # Ensure target is within base_dir
        try:
            server_dir.resolve().relative_to(self.base_dir.resolve())
        except ValueError:
            return {"error": "Invalid server name"}
        if sys.platform == "win32":
            import shutil
            shutil.copytree(str(src), str(server_dir), dirs_exist_ok=True)
        else:
            subprocess.run(["cp", "-r", str(src) + "/.", str(server_dir)], capture_output=True)
        return {}

    def uninstall(self, name: str) -> dict:
        if not _SAFE_NAME_RE.match(name):
            return {"error": f"Invalid server name: {name}"}
        self.stop(name)
        server_dir = self.base_dir / name
        if server_dir.exists():
            import shutil
            shutil.rmtree(str(server_dir))
        self.registry["servers"] = [s for s in self.registry["servers"] if s["name"] != name]
        self._save_registry()
        return {"status": "uninstalled", "name": name}

    def start(self, name: str) -> dict:
        server_dir = self.base_dir / name
        server_file = server_dir / "server.py"
        if not server_file.exists():
            return {"error": f"Server not found: {name}"}

        proc = self.processes.get(name)
        if proc and proc.poll() is None:
            return {"status": "already_running", "pid": proc.pid}

        env = os.environ.copy()
        env["PYTHONPATH"] = str(REPO) + os.pathsep + env.get("PYTHONPATH", "")

        proc = subprocess.Popen(
            [sys.executable, str(server_file)],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            cwd=str(server_dir),
            env=env,
            text=True, errors='replace',
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )
        self.processes[name] = proc
        self.log_buffers[name] = collections.deque(maxlen=500)
        self._update_registry(name, "running", proc.pid)
        self._start_log_reader(name, proc)
        return {"pid": proc.pid, "status": "running"}

    def stop(self, name: str) -> dict:
        proc = self.processes.pop(name, None)
        if proc and proc.poll() is None:
            if sys.platform == "win32":
                proc.kill()
            else:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
        self.log_buffers.pop(name, None)
        self._update_registry(name, "stopped", None)
        return {"status": "stopped", "name": name}

    def restart(self, name: str) -> dict:
        self.stop(name)
        time.sleep(0.5)
        return self.start(name)

    def status(self, name: str) -> dict:
        for s in self.registry.get("servers", []):
            if s["name"] == name:
                proc = self.processes.get(name)
                mem_mb = None
                cpu_pct = None
                uptime_sec = None
                if proc and proc.poll() is None:
                    status_str = "running"
                    pid = proc.pid
                    if psutil:
                        try:
                            p = psutil.Process(pid)
                            mem_mb = round(p.memory_info().rss / 1024 / 1024, 1)
                            cpu_pct = round(p.cpu_percent(interval=0.1), 1)
                            uptime_sec = round(time.time() - p.create_time(), 0)
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                else:
                    status_str = s.get("status", "stopped")
                    pid = None
                    if status_str == "running":
                        status_str = "stopped"
                return {
                    "name": name,
                    "status": status_str,
                    "pid": pid,
                    "port": s.get("port"),
                    "memory_mb": mem_mb,
                    "cpu_percent": cpu_pct,
                    "uptime_sec": uptime_sec,
                    "tools": s.get("tools", []),
                    "health": s.get("health", {}),
                }
        return {"error": f"Server not found: {name}"}

    def logs(self, name: str, lines: int = 100) -> dict:
        buf = self.log_buffers.get(name, collections.deque(maxlen=500))
        return {"logs": list(buf)[-lines:]}

    def test(self, name: str) -> dict:
        st = self.status(name)
        if st.get("status") != "running":
            return {"ok": False, "error": "Server not running"}
        return {"ok": True, "message": "Server process is alive"}

    def call_tool(self, name: str, tool: str, arguments: dict) -> dict:
        st = self.status(name)
        if st.get("status") != "running":
            return {"error": "Server not running"}
        # For stdio-based MCP, tool calling requires MCP client protocol
        # This is a simplified placeholder for direct execution
        return {"error": "Direct tool calling not yet implemented for stdio transport"}

    def stop_all(self):
        for name in list(self.processes.keys()):
            self.stop(name)

    def _update_registry(self, name: str, status: str, pid: Optional[int]):
        for s in self.registry.get("servers", []):
            if s["name"] == name:
                s["status"] = status
                s["pid"] = pid
                s["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                break
        self._save_registry()

    def _start_log_reader(self, name: str, proc: subprocess.Popen):
        if name not in self.log_buffers:
            self.log_buffers[name] = collections.deque(maxlen=500)
        buf = self.log_buffers[name]
        def reader():
            try:
                for line in proc.stdout:
                    decoded = line.rstrip()[:2000]
                    buf.append(decoded)
            except Exception:
                pass
        t = threading.Thread(target=reader, daemon=True)
        t.start()

    def _register_builtins(self):
        """Register built-in MCP servers from the templates directory."""
        builtins = [
            {
                "name": "wiki-search",
                "display_name": "Wiki 知识搜索",
                "description": "搜索 wiki 知识库中的页面和内容",
                "version": "1.0.0",
                "source": "builtin",
                "status": "stopped",
                "port": None,
                "pid": None,
                "transport": "stdio",
                "tools": ["search_wiki", "get_page", "list_pages", "get_graph"],
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "health": {"last_check": None, "status": "unknown", "error_count": 0},
                "config": {},
            },
            {
                "name": "filesystem",
                "display_name": "文件系统",
                "description": "安全地读写项目目录中的文件",
                "version": "1.0.0",
                "source": "builtin",
                "status": "stopped",
                "port": None,
                "pid": None,
                "transport": "stdio",
                "tools": ["read_file", "write_file", "list_directory"],
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "health": {"last_check": None, "status": "unknown", "error_count": 0},
                "config": {"allowed_paths": ["wiki/", "raw/", "graph/"]},
            },
            {
                "name": "agent-tools",
                "display_name": "Agent 操作",
                "description": "提供 Agent 常用的辅助工具",
                "version": "1.0.0",
                "source": "builtin",
                "status": "stopped",
                "port": None,
                "pid": None,
                "transport": "stdio",
                "tools": ["run_command", "get_status", "search_web"],
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "health": {"last_check": None, "status": "unknown", "error_count": 0},
                "config": {},
            },
        ]
        existing_names = {s["name"] for s in self.registry.get("servers", [])}
        for b in builtins:
            if b["name"] not in existing_names:
                self.registry.setdefault("servers", []).append(b)
        self._save_registry()


# Singleton instance
_mcp_manager: Optional[MCPManager] = None


def get_mcp_manager() -> MCPManager:
    global _mcp_manager
    if _mcp_manager is None:
        _mcp_manager = MCPManager()
    return _mcp_manager
