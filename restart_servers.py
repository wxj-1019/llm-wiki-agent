#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
One-click cleanup and restart script for LLM Wiki Agent servers.

Usage:
    python restart_servers.py              # cleanup + restart both
    python restart_servers.py --backend    # restart backend only
    python restart_servers.py --frontend   # restart frontend only
    python restart_servers.py --auto-port  # auto-find free ports
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).parent
DEFAULT_BACKEND_PORT = 8000
DEFAULT_FRONTEND_PORT = 3000


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex((host, port)) == 0


def kill_process_on_port(port: int) -> bool:
    """Kill the process occupying *port* on Windows."""
    if sys.platform != "win32":
        try:
            result = subprocess.run(
                ["lsof", "-ti", ":{}".format(port)],
                capture_output=True, text=True, check=False,
            )
            if result.stdout.strip():
                for pid in result.stdout.strip().splitlines():
                    subprocess.run(["kill", "-9", pid], check=False)
                return True
        except FileNotFoundError:
            pass
        return False

    try:
        result = subprocess.run(
            ["cmd", "/c", "netstat -ano | findstr :{}".format(port)],
            capture_output=True, text=True, check=False,
        )
        lines = result.stdout.strip().splitlines()
        killed_any = False
        for line in lines:
            parts = line.split()
            if len(parts) >= 5:
                local_addr = parts[1]
                state = parts[3]
                pid = parts[4]
                if ":{}".format(port) in local_addr and state == "LISTENING":
                    print("  Found PID {} listening on port {}. Killing...".format(pid, port))
                    subprocess.run(["taskkill", "/F", "/PID", pid],
                                   check=False, capture_output=True)
                    killed_any = True
        return killed_any
    except Exception as e:
        print("  [WARN] Failed to kill process on port {}: {}".format(port, e))
        return False


def kill_python_processes_by_name(script_name: str) -> int:
    """Kill python.exe processes running *script_name*."""
    count = 0
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                ["wmic", "process", "where",
                 "CommandLine like '%{}%'".format(script_name),
                 "get", "ProcessId"],
                capture_output=True, text=True, check=False,
            )
            for line in result.stdout.strip().splitlines()[1:]:
                pid = line.strip()
                if pid.isdigit():
                    subprocess.run(["taskkill", "/F", "/PID", pid],
                                   check=False, capture_output=True)
                    count += 1
        except Exception:
            pass
    else:
        try:
            result = subprocess.run(
                ["pgrep", "-f", script_name],
                capture_output=True, text=True, check=False,
            )
            for pid in result.stdout.strip().splitlines():
                subprocess.run(["kill", "-9", pid],
                               check=False, capture_output=True)
                count += 1
        except FileNotFoundError:
            pass
    return count


def clear_pycache(root: Path) -> int:
    """Remove all __pycache__ dirs and .pyc files under *root*."""
    removed = 0
    for pycache in root.rglob("__pycache__"):
        if pycache.is_dir():
            try:
                shutil.rmtree(pycache)
                removed += 1
            except OSError:
                pass
    for pyc in root.rglob("*.pyc"):
        try:
            pyc.unlink()
        except OSError:
            pass
    return removed


def wait_for_port_release(port: int, timeout: float = 5.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not is_port_in_use(port):
            return True
        time.sleep(0.2)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Restart LLM Wiki Agent servers")
    parser.add_argument("--backend", action="store_true",
                        help="Only restart backend")
    parser.add_argument("--frontend", action="store_true",
                        help="Only restart frontend")
    parser.add_argument("--auto-port", action="store_true",
                        help="Auto-find free ports if occupied")
    parser.add_argument("--backend-port", type=int,
                        default=DEFAULT_BACKEND_PORT)
    parser.add_argument("--frontend-port", type=int,
                        default=DEFAULT_FRONTEND_PORT)
    args = parser.parse_args()

    print("=" * 50)
    print("LLM Wiki Agent - Restart Script")
    print("=" * 50)

    backend_port = args.backend_port
    frontend_port = args.frontend_port

    # Step 1: Kill old processes
    print("\n[Step 1/4] Stopping old server processes...")

    if not args.frontend:
        if is_port_in_use(backend_port):
            if kill_process_on_port(backend_port):
                print("  [OK] Killed process on backend port {}".format(backend_port))
            else:
                print("  [WARN] Could not kill process on port {}".format(backend_port))
        else:
            print("  Port {} is already free.".format(backend_port))

    if not args.backend:
        if is_port_in_use(frontend_port):
            if kill_process_on_port(frontend_port):
                print("  [OK] Killed process on frontend port {}".format(frontend_port))
            else:
                print("  [WARN] Could not kill process on port {}".format(frontend_port))
        else:
            print("  Port {} is already free.".format(frontend_port))

    for script in ("api_server.py", "start_servers.py"):
        n = kill_python_processes_by_name(script)
        if n:
            print("  [OK] Killed {} orphaned '{}' process(es)".format(n, script))

    if not args.frontend:
        wait_for_port_release(backend_port, timeout=3)
    if not args.backend:
        wait_for_port_release(frontend_port, timeout=3)

    # Step 2: Clear Python cache
    print("\n[Step 2/4] Clearing Python cache...")
    count = clear_pycache(REPO)
    print("  [OK] Removed {} __pycache__ dir(s)".format(count))

    # Step 3: Validate environment
    print("\n[Step 3/4] Checking environment...")
    backend_ready = (REPO / "tools" / "api_server.py").exists()
    frontend_ready = (REPO / "wiki-viewer" / "dist").exists()

    if backend_ready:
        print("  [OK] Backend found: tools/api_server.py")
    else:
        print("  [ERR] Backend not found!")
        return 1

    if frontend_ready:
        print("  [OK] Frontend dist found: wiki-viewer/dist")
    else:
        print("  [WARN] Frontend dist missing - backend only")

    # Step 4: Start servers
    print("\n[Step 4/4] Starting servers...")
    print("-" * 50)

    cmd = [sys.executable, str(REPO / "start_servers.py")]
    if args.backend:
        cmd.append("--backend-only")
    if args.frontend:
        cmd.append("--frontend-only")
    if args.auto_port:
        cmd.append("--auto-port")
    if args.backend_port != DEFAULT_BACKEND_PORT:
        cmd.extend(["--backend-port", str(args.backend_port)])
    if args.frontend_port != DEFAULT_FRONTEND_PORT:
        cmd.extend(["--frontend-port", str(args.frontend_port)])

    print("  Command: {}".format(" ".join(cmd)))
    print("")

    try:
        result = subprocess.run(cmd, cwd=str(REPO))
        return result.returncode
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
