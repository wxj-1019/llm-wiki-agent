#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path

from tools.jarvis.tool_registry import register_tool
from tools.jarvis.types import RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent.parent

try:
    from tools.mcp_manager import get_mcp_manager
    _MCP_AVAILABLE = True
except ImportError:
    _MCP_AVAILABLE = False

_RPC_TIMEOUT = 10
_NEXT_ID = 1


def _next_rpc_id() -> int:
    global _NEXT_ID
    rid = _NEXT_ID
    _NEXT_ID += 1
    return rid


def _extract_result(response: dict) -> dict:
    if "error" in response:
        err = response["error"]
        if isinstance(err, dict):
            return {"error": err.get("message", str(err)), "code": err.get("code")}
        return {"error": str(err)}
    result = response.get("result")
    if result is None:
        return {"result": None}
    if isinstance(result, dict):
        content = result.get("content")
        if isinstance(content, list):
            texts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    texts.append(item.get("text", ""))
            if texts:
                joined = "\n".join(texts)
                try:
                    return {"result": json.loads(joined)}
                except json.JSONDecodeError:
                    return {"result": joined}
    return {"result": result}


def _register_mcp_list_servers():
    @register_tool(
        name="mcp_list_servers",
        description="List all registered MCP servers and their statuses",
        risk_level=RiskLevel.L0,
        input_schema={},
        output_schema={"servers": {"type": "list[dict]"}},
        category="mcp",
    )
    def mcp_list_servers() -> dict:
        if not _MCP_AVAILABLE:
            return {"servers": [], "error": "MCPManager not available"}
        mgr = get_mcp_manager()
        return {"servers": mgr.list_servers()}


def _register_mcp_start_server():
    @register_tool(
        name="mcp_start_server",
        description="Start an MCP server by name",
        risk_level=RiskLevel.L2,
        input_schema={"name": {"type": "str", "required": True}},
        output_schema={"success": {"type": "bool"}, "status": {"type": "dict"}},
        category="mcp",
    )
    def mcp_start_server(name: str) -> dict:
        if not _MCP_AVAILABLE:
            return {"success": False, "status": {}, "error": "MCPManager not available"}
        mgr = get_mcp_manager()
        result = mgr.start(name)
        success = "error" not in result
        return {"success": success, "status": result}


def _register_mcp_stop_server():
    @register_tool(
        name="mcp_stop_server",
        description="Stop a running MCP server by name",
        risk_level=RiskLevel.L2,
        input_schema={"name": {"type": "str", "required": True}},
        output_schema={"success": {"type": "bool"}},
        category="mcp",
    )
    def mcp_stop_server(name: str) -> dict:
        if not _MCP_AVAILABLE:
            return {"success": False, "error": "MCPManager not available"}
        mgr = get_mcp_manager()
        result = mgr.stop(name)
        success = "error" not in result
        return {"success": success, **result}


def _register_mcp_call_tool():
    @register_tool(
        name="mcp_call_tool",
        description="Call a tool on a running MCP server via JSON-RPC over stdio",
        risk_level=RiskLevel.L2,
        input_schema={
            "server_name": {"type": "str", "required": True},
            "tool_name": {"type": "str", "required": True},
            "arguments": {"type": "dict", "required": False},
        },
        output_schema={"result": {"type": "Any"}},
        category="mcp",
    )
    def mcp_call_tool(server_name: str, tool_name: str, arguments: dict = {}) -> dict:
        if not _MCP_AVAILABLE:
            return {"error": "MCPManager not available"}
        mgr = get_mcp_manager()
        st = mgr.status(server_name)
        if st.get("status") != "running":
            return {"error": f"Server '{server_name}' is not running"}
        proc = mgr.processes.get(server_name)
        if proc is None or proc.poll() is not None:
            return {"error": f"Server '{server_name}' process not available"}
        stdin = getattr(proc, "stdin", None)
        stdout = getattr(proc, "stdout", None)
        if stdin is not None and stdout is not None:
            request = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
                "id": _next_rpc_id(),
            }
            try:
                payload = json.dumps(request) + "\n"
                stdin.write(payload)
                stdin.flush()
            except (BrokenPipeError, OSError) as exc:
                return {"error": f"Failed to send request: {exc}"}
            deadline = time.monotonic() + _RPC_TIMEOUT
            while time.monotonic() < deadline:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    line = stdout.readline()
                except (OSError, ValueError):
                    break
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    parsed = json.loads(line)
                    if "jsonrpc" in parsed:
                        return _extract_result(parsed)
                except json.JSONDecodeError:
                    continue
            return {"error": "Timeout waiting for server response"}
        else:
            return mgr.call_tool(server_name, tool_name, arguments)


def _register_mcp_list_tools():
    @register_tool(
        name="mcp_list_tools",
        description="List tools available on a running MCP server via JSON-RPC",
        risk_level=RiskLevel.L0,
        input_schema={"server_name": {"type": "str", "required": True}},
        output_schema={"tools": {"type": "list[dict]"}},
        category="mcp",
    )
    def mcp_list_tools(server_name: str) -> dict:
        if not _MCP_AVAILABLE:
            return {"tools": [], "error": "MCPManager not available"}
        mgr = get_mcp_manager()
        st = mgr.status(server_name)
        if st.get("status") != "running":
            return {"tools": [], "error": f"Server '{server_name}' is not running"}
        proc = mgr.processes.get(server_name)
        if proc is None or proc.poll() is not None:
            return {"tools": [], "error": f"Server '{server_name}' process not available"}
        stdin = getattr(proc, "stdin", None)
        stdout = getattr(proc, "stdout", None)
        if stdin is None or stdout is None:
            return {"tools": st.get("tools", [])}
        request = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "params": {},
            "id": _next_rpc_id(),
        }
        try:
            payload = json.dumps(request) + "\n"
            stdin.write(payload)
            stdin.flush()
        except (BrokenPipeError, OSError) as exc:
            return {"tools": [], "error": f"Failed to send request: {exc}"}
        deadline = time.monotonic() + _RPC_TIMEOUT
        while time.monotonic() < deadline:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                line = stdout.readline()
            except (OSError, ValueError):
                break
            if not line:
                break
            line = line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
                if "jsonrpc" in parsed and "result" in parsed:
                    tools = parsed["result"].get("tools", [])
                    return {"tools": tools}
                if "jsonrpc" in parsed and "error" in parsed:
                    err = parsed["error"]
                    msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                    return {"tools": [], "error": msg}
            except json.JSONDecodeError:
                continue
        return {"tools": [], "error": "Timeout waiting for server response"}


_ALL_REGISTRARS = [
    _register_mcp_list_servers,
    _register_mcp_start_server,
    _register_mcp_stop_server,
    _register_mcp_call_tool,
    _register_mcp_list_tools,
]


def register_all():
    for registrar in _ALL_REGISTRARS:
        try:
            registrar()
        except Exception as exc:
            print(f"WARNING: failed to register tool from {registrar.__name__}: {exc}")
