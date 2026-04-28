#!/usr/bin/env python3
"""Start both frontend and backend servers."""
import subprocess
import sys
import os
from pathlib import Path

REPO = Path(__file__).parent


def main():
    kwargs = {}
    # Windows: CREATE_NEW_CONSOLE opens each server in its own terminal window
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_CONSOLE

    # Start backend API server
    backend = subprocess.Popen(
        [sys.executable, "tools/api_server.py"],
        cwd=str(REPO),
        **kwargs,
    )
    print(f"Backend API started on http://localhost:8000 (PID: {backend.pid})")

    # Start frontend dev server (uses Vite's configured port 3000)
    npm_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    # Ensure node_modules exists
    frontend_dir = REPO / "wiki-viewer"
    if not (frontend_dir / "node_modules").exists():
        print("Installing frontend dependencies...")
        subprocess.run(
            [npm_cmd, "install"],
            cwd=str(frontend_dir),
            check=True,
        )

    frontend = subprocess.Popen(
        [npm_cmd, "vite", "preview", "--host", "0.0.0.0", "--port", "3000"],
        cwd=str(frontend_dir),
        **kwargs,
    )
    print(f"Frontend started on http://localhost:3000 (PID: {frontend.pid})")

    print("\nPress Enter to stop all servers...")
    try:
        input()
    except EOFError:
        # Handle non-interactive environments gracefully
        print("Running in non-interactive mode. Servers are active.")
        print(f"  Backend: http://localhost:8000 (PID: {backend.pid})")
        print(f"  Frontend: http://localhost:3000 (PID: {frontend.pid})")
        return

    backend.terminate()
    frontend.terminate()
    print("Servers stopped.")


if __name__ == "__main__":
    main()
