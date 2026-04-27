#!/usr/bin/env python3
"""Start both frontend and backend servers."""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).parent

def main():
    # Start backend API server
    backend = subprocess.Popen(
        [sys.executable, "tools/api_server.py"],
        cwd=str(REPO),
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )
    print(f"Backend API started on http://localhost:8000 (PID: {backend.pid})")

    # Start frontend preview server
    frontend = subprocess.Popen(
        ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"],
        cwd=str(REPO / "wiki-viewer"),
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )
    print(f"Frontend started on http://localhost:3000 (PID: {frontend.pid})")

    print("\nPress Enter to stop all servers...")
    input()

    backend.terminate()
    frontend.terminate()
    print("Servers stopped.")

if __name__ == "__main__":
    main()
