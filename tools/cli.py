#!/usr/bin/env python3
"""Unified CLI for LLM Wiki Agent.

Usage:
    wiki ingest <path>                  Ingest a source document
    wiki search <query>                 Search wiki pages
    wiki health [--save]                Run structural health check
    wiki lint [--save]                  Run content quality lint
    wiki build-graph [--open]           Build knowledge graph
    wiki memory start <goal>            Start agent memory session
    wiki memory update <id> --notes <n> Update session
    wiki memory finish <id> --summary <s> Finish session
    wiki memory list [--status <s>]     List sessions
    wiki context build <goal>           Build context pack
    wiki server [--host <h>] [--port <p>] Start API server
    wiki watch [--poll]                 Watch raw/ for changes
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent


def _run_py(script: str, *args: str) -> int:
    cmd = [sys.executable, str(REPO / "tools" / script), *args]
    return subprocess.call(cmd)


def main() -> int:
    parser = argparse.ArgumentParser(prog="wiki", description="LLM Wiki Agent CLI")
    sub = parser.add_subparsers(dest="cmd")

    # ingest
    p_ingest = sub.add_parser("ingest", help="Ingest a source document")
    p_ingest.add_argument("path")

    # search
    p_search = sub.add_parser("search", help="Search wiki pages")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=20)

    # health
    p_health = sub.add_parser("health", help="Run structural health check")
    p_health.add_argument("--save", action="store_true")
    p_health.add_argument("--json", action="store_true")

    # lint
    p_lint = sub.add_parser("lint", help="Run content quality lint")
    p_lint.add_argument("--save", action="store_true")

    # build-graph
    p_graph = sub.add_parser("build-graph", help="Build knowledge graph")
    p_graph.add_argument("--open", action="store_true")
    p_graph.add_argument("--no-infer", action="store_true")

    # memory
    p_mem = sub.add_parser("memory", help="Agent memory commands")
    m_sub = p_mem.add_subparsers(dest="mem_cmd")
    m_start = m_sub.add_parser("start", help="Start a session")
    m_start.add_argument("goal")
    m_start.add_argument("--target", default="")
    m_update = m_sub.add_parser("update", help="Update a session")
    m_update.add_argument("session_id")
    m_update.add_argument("--notes", required=True)
    m_finish = m_sub.add_parser("finish", help="Finish a session")
    m_finish.add_argument("session_id")
    m_finish.add_argument("--summary", required=True)
    m_list = m_sub.add_parser("list", help="List sessions")
    m_list.add_argument("--status", default="")

    # context
    p_ctx = sub.add_parser("context", help="Context pack commands")
    c_sub = p_ctx.add_subparsers(dest="ctx_cmd")
    c_build = c_sub.add_parser("build", help="Build a context pack")
    c_build.add_argument("goal")
    c_build.add_argument("--target", default="")
    c_build.add_argument("--budget", type=int, default=8000)
    c_build.add_argument("--save", action="store_true")

    # server
    p_server = sub.add_parser("server", help="Start API server")
    p_server.add_argument("--host", default="127.0.0.1")
    p_server.add_argument("--port", type=int, default=8000)

    # watch
    p_watch = sub.add_parser("watch", help="Watch raw/ for changes")
    p_watch.add_argument("--poll", action="store_true")

    # version
    sub.add_parser("version", help="Show version")

    args = parser.parse_args()

    if args.cmd == "ingest":
        return _run_py("ingest.py", args.path)
    elif args.cmd == "search":
        return _run_py("search_engine.py", "--query", args.query, "--limit", str(args.limit))
    elif args.cmd == "health":
        extra = []
        if args.save:
            extra.append("--save")
        if args.json:
            extra.append("--json")
        return _run_py("health.py", *extra)
    elif args.cmd == "lint":
        extra = ["--save"] if args.save else []
        return _run_py("lint.py", *extra)
    elif args.cmd == "build-graph":
        extra = []
        if args.open:
            extra.append("--open")
        if args.no_infer:
            extra.append("--no-infer")
        return _run_py("build_graph.py", *extra)
    elif args.cmd == "memory":
        if args.mem_cmd == "start":
            return _run_py("memory.py", "start", args.goal, "--target", args.target)
        elif args.mem_cmd == "update":
            return _run_py("memory.py", "update", args.session_id, "--notes", args.notes)
        elif args.mem_cmd == "finish":
            return _run_py("memory.py", "finish", args.session_id, "--summary", args.summary)
        elif args.mem_cmd == "list":
            return _run_py("memory.py", "list", "--status", args.status)
        else:
            p_mem.print_help()
            return 1
    elif args.cmd == "context":
        if args.ctx_cmd == "build":
            extra = [args.goal, "--target", args.target, "--budget", str(args.budget)]
            if args.save:
                extra.append("--save")
            return _run_py("context.py", "build", *extra)
        else:
            p_ctx.print_help()
            return 1
    elif args.cmd == "server":
        return _run_py("api_server.py", "--host", args.host, "--port", str(args.port))
    elif args.cmd == "watch":
        extra = ["--poll"] if args.poll else []
        return _run_py("watcher.py", *extra)
    elif args.cmd == "version":
        print("LLM Wiki Agent CLI 2.0")
        return 0
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
