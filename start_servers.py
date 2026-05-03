#!/usr/bin/env python3
"""Start both frontend and backend servers."""
from __future__ import annotations

import argparse
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).parent

DEFAULT_BACKEND_PORT = 8000
DEFAULT_FRONTEND_PORT = 3000


def is_port_free(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a TCP port is available for binding."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


def find_free_port(start: int, end: int = 65535, host: str = "127.0.0.1") -> int | None:
    """Find the next available port starting from *start*."""
    for port in range(start, min(end + 1, 65536)):
        if is_port_free(port, host):
            return port
    return None


def wait_for_port(port: int, timeout: float = 10.0, host: str = "127.0.0.1") -> bool:
    """Poll until *port* accepts connections or *timeout* elapses."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.3)
            try:
                sock.connect((host, port))
                return True
            except OSError:
                time.sleep(0.2)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Start LLM Wiki Agent servers")
    parser.add_argument("--backend-port", type=int, default=DEFAULT_BACKEND_PORT,
                        help=f"Backend API port (default: {DEFAULT_BACKEND_PORT})")
    parser.add_argument("--frontend-port", type=int, default=DEFAULT_FRONTEND_PORT,
                        help=f"Frontend dev-server port (default: {DEFAULT_FRONTEND_PORT})")
    parser.add_argument("--backend-only", action="store_true",
                        help="Start only the backend API server")
    parser.add_argument("--frontend-only", action="store_true",
                        help="Start only the frontend dev server")
    parser.add_argument("--auto-port", action="store_true",
                        help="Automatically find free ports if defaults are in use")
    parser.add_argument("--no-browser", action="store_true",
                        help="Do not open browser automatically")
    args = parser.parse_args()

    backend_port = args.backend_port
    frontend_port = args.frontend_port

    # Port checks
    if not args.frontend_only:
        if not is_port_free(backend_port):
            if args.auto_port:
                found = find_free_port(backend_port + 1)
                if found:
                    print(f"Port {backend_port} in use. Using backend port {found} instead.")
                    backend_port = found
                else:
                    print(f"ERROR: No free port found for backend starting from {backend_port}.")
                    return 1
            else:
                print(f"ERROR: Backend port {backend_port} is already in use.")
                print(f"       Use --auto-port to pick the next free port, or --backend-port <port>.")
                return 1

    if not args.backend_only:
        if not is_port_free(frontend_port):
            if args.auto_port:
                found = find_free_port(frontend_port + 1)
                if found:
                    print(f"Port {frontend_port} in use. Using frontend port {found} instead.")
                    frontend_port = found
                else:
                    print(f"ERROR: No free port found for frontend starting from {frontend_port}.")
                    return 1
            else:
                print(f"ERROR: Frontend port {frontend_port} is already in use.")
                print(f"       Use --auto-port to pick the next free port, or --frontend-port <port>.")
                return 1

    processes: list[subprocess.Popen] = []

    def shutdown(signum=None, frame=None):
        """Terminate all child processes gracefully."""
        print("\nShutting down servers...")
        for proc in processes:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
        print("Servers stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    kwargs: dict = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_CONSOLE

    # ── Backend ──
    if not args.frontend_only:
        backend_cmd = [
            sys.executable, "-m", "uvicorn",
            "tools.api_server:app",
            "--host", "127.0.0.1",
            "--port", str(backend_port),
            "--reload" if (REPO / "tools" / "api_server.py").exists() else "",
        ]
        backend_cmd = [c for c in backend_cmd if c]

        # Fallback: run api_server.py directly if uvicorn is not available
        try:
            import uvicorn  # noqa: F401
        except ImportError:
            backend_cmd = [sys.executable, str(REPO / "tools" / "api_server.py")]

        backend = subprocess.Popen(backend_cmd, cwd=str(REPO), **kwargs)
        processes.append(backend)
        print(f"Backend API started on http://127.0.0.1:{backend_port} (PID: {backend.pid})")

    # ── Frontend ──
    if not args.backend_only:
        frontend_dir = REPO / "wiki-viewer"
        dist_dir = frontend_dir / "dist"

        if not dist_dir.exists():
            print(f"WARNING: {dist_dir} not found. Frontend will not be available.")
            print(f"         Run 'cd wiki-viewer && npm run build' first.")
        else:
            npm_cmd = "npx.cmd" if sys.platform == "win32" else "npx"

            # Check node_modules
            if not (frontend_dir / "node_modules").exists():
                print("Installing frontend dependencies...")
                install_result = subprocess.run(
                    [npm_cmd, "install"],
                    cwd=str(frontend_dir),
                    check=False,
                    capture_output=True,
                    text=True,
                )
                if install_result.returncode != 0:
                    print(f"WARNING: npm install failed. Frontend may not work.")
                    print(f"         {install_result.stderr[:200]}")

            frontend_cmd = [
                npm_cmd, "vite", "preview",
                "--host", "0.0.0.0",
                "--port", str(frontend_port),
                "--strictPort",
            ]
            frontend = subprocess.Popen(frontend_cmd, cwd=str(frontend_dir), **kwargs)
            processes.append(frontend)
            print(f"Frontend started on http://127.0.0.1:{frontend_port} (PID: {frontend.pid})")

    # Wait for servers to be ready
    if not args.frontend_only:
        print("Waiting for backend to be ready...", end="", flush=True)
        if wait_for_port(backend_port, timeout=15):
            print(" OK")
        else:
            print(" TIMEOUT")
            print("WARNING: Backend did not respond in time. Check logs above.")

    print("\nPress Ctrl+C to stop all servers.\n")

    # Keep main process alive
    try:
        while True:
            time.sleep(1)
            # Check if any child exited unexpectedly
            for proc in list(processes):
                if proc.poll() is not None:
                    print(f"WARNING: A server exited early (return code: {proc.returncode}).")
                    shutdown()
    except KeyboardInterrupt:
        shutdown()

    return 0


if __name__ == "__main__":
    sys.exit(main())
