#!/usr/bin/env python3
"""Agent Memory Ledger — persistent task memory for AI agents.

Usage:
    python tools/memory.py start "Refactor auth module" --target wiki/concepts/Auth.md
    python tools/memory.py update S-20260505-001 --notes "Added OAuth2 flow diagram"
    python tools/memory.py finish S-20260505-001 --summary "Completed auth refactor"
    python tools/memory.py resume S-20260505-001
    python tools/memory.py list
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

REPO = Path(__file__).parent.parent
MEMORY = REPO / "wiki" / "memory"
SESSIONS = MEMORY / "sessions"
DECISIONS = MEMORY / "decisions.md"
_SAFE_SESSION_RE = re.compile(r'^[A-Z]-\d{8}-\d{3}$')


def _validate_session_id(sid: str) -> str:
    if not _SAFE_SESSION_RE.match(sid):
        raise ValueError(f"Invalid session_id: {sid!r}")
    return sid


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _next_id(prefix: str) -> str:
    today = datetime.now().strftime("%Y%m%d")
    existing = list(SESSIONS.glob(f"{prefix}-{today}-*.md"))
    seq = len(existing) + 1
    return f"{prefix}-{today}-{seq:03d}"


def _frontmatter(data: dict) -> str:
    lines = ["---"]
    for k, v in data.items():
        if isinstance(v, list):
            lines.append(f"{k}:")
            for item in v:
                lines.append(f"  - {item}")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def start(goal: str, target: Optional[str] = None) -> str:
    """Start a new task session. Returns session_id."""
    SESSIONS.mkdir(parents=True, exist_ok=True)
    sid = _next_id("S")
    path = SESSIONS / f"{sid}.md"

    fm = {
        "session_id": sid,
        "date": _today(),
        "goal": goal,
        "target": target or "",
        "status": "active",
        "started_at": _now(),
        "updated_at": _now(),
        "decisions": [],
        "changed_paths": [],
    }

    body = f"""{_frontmatter(fm)}
# Session {sid}: {goal}

## Goal
{goal}

{"## Target\n" + target + "\n" if target else ""}## Progress Log

### [{_now()}] Started
Session initialized.

## Decisions

## Changed Files

## Notes

"""
    path.write_text(body, encoding="utf-8")
    print(f"Started session {sid}: {goal}")
    return sid


def update(
    session_id: str,
    notes: Optional[str] = None,
    decisions: Optional[list[str]] = None,
    changed_paths: Optional[list[str]] = None,
) -> bool:
    _validate_session_id(session_id)
    path = SESSIONS / f"{session_id}.md"
    if not path.exists():
        print(f"Error: Session {session_id} not found", file=sys.stderr)
        return False

    content = path.read_text(encoding="utf-8")

    fm_end = content.find("\n---\n", 4)
    if fm_end == -1:
        fm_end = len(content)
    fm_part = content[:fm_end + 5]
    body_part = content[fm_end + 5:]

    fm_part = re.sub(
        r"^updated_at: .*$", f"updated_at: {_now()}", fm_part, flags=re.M
    )

    # Append to progress log
    log_entry = f"\n### [{_now()}] Update\n"
    if notes:
        log_entry += f"{notes}\n"
    if decisions:
        for d in decisions:
            log_entry += f"- **Decision**: {d}\n"
            if "## Decisions\n" in body_part:
                body_part = body_part.replace(
                    "## Decisions\n", f"## Decisions\n- {d}\n"
                )
    if changed_paths:
        for p in changed_paths:
            log_entry += f"- **Changed**: `{p}`\n"
            if "## Changed Files\n" in body_part:
                body_part = body_part.replace(
                    "## Changed Files\n", f"## Changed Files\n- `{p}`\n"
                )

    if "## Notes\n" in body_part:
        body_part = body_part.replace("## Notes\n", log_entry + "\n## Notes\n")
    else:
        body_part += log_entry

    content = fm_part + body_part

    path.write_text(content, encoding="utf-8")
    print(f"Updated session {session_id}")
    return True


def finish(session_id: str, summary: str) -> bool:
    _validate_session_id(session_id)
    path = SESSIONS / f"{session_id}.md"
    if not path.exists():
        print(f"Error: Session {session_id} not found", file=sys.stderr)
        return False

    content = path.read_text(encoding="utf-8")
    content = re.sub(r"^status: active$", "status: finished", content, flags=re.M)
    content = re.sub(
        r"^updated_at: .*$", f"updated_at: {_now()}", content, flags=re.M
    )

    finish_block = f"""
### [{_now()}] Finished

## Summary
{summary}
"""
    content = content.replace("## Notes\n", f"## Notes\n{finish_block}")
    path.write_text(content, encoding="utf-8")

    # Append to decisions.md
    _append_decision(session_id, summary)
    print(f"Finished session {session_id}")
    return True


def _append_decision(session_id: str, summary: str) -> None:
    DECISIONS.parent.mkdir(parents=True, exist_ok=True)
    if not DECISIONS.exists():
        DECISIONS.write_text(
            "---\ntitle: \"Agent Decisions Log\"\ntype: synthesis\n---\n\n",
            encoding="utf-8",
        )

    today = datetime.now().strftime("%Y%m%d")
    existing = DECISIONS.read_text(encoding="utf-8")
    count = existing.count(f"### D-{today}-")
    seq = count + 1
    did = f"D-{today}-{seq:03d}"
    entry = f"""\n### {did}

- **Session**: {session_id}
- **Date**: {_today()}
- **Summary**: {summary}

"""
    with DECISIONS.open("a", encoding="utf-8") as f:
        f.write(entry)


def resume(session_id: str) -> dict:
    _validate_session_id(session_id)
    path = SESSIONS / f"{session_id}.md"
    if not path.exists():
        return {"error": f"Session {session_id} not found"}

    content = path.read_text(encoding="utf-8")
    # Extract frontmatter
    fm_match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    fm = {}
    if fm_match:
        for line in fm_match.group(1).split("\n"):
            if ":" in line and not line.startswith("  "):
                k, v = line.split(":", 1)
                fm[k.strip()] = v.strip()

    # Extract recent progress
    progress = []
    for m in re.finditer(r"### \[(.+?)\] (.+?)\n(.*?)(?=\n### |\n## |$)", content, re.DOTALL):
        progress.append({
            "time": m.group(1),
            "action": m.group(2),
            "content": m.group(3).strip(),
        })

    return {
        "session_id": session_id,
        "goal": fm.get("goal", ""),
        "target": fm.get("target", ""),
        "status": fm.get("status", "unknown"),
        "progress": progress[-5:],  # Last 5 entries
        "full_path": str(path.relative_to(REPO)),
    }


def list_sessions(status_filter: Optional[str] = None) -> list[dict]:
    """List all sessions, optionally filtered by status."""
    results = []
    for path in sorted(SESSIONS.glob("S-*.md"), reverse=True):
        content = path.read_text(encoding="utf-8")
        fm_match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
        fm = {}
        if fm_match:
            for line in fm_match.group(1).split("\n"):
                if ":" in line and not line.startswith("  "):
                    k, v = line.split(":", 1)
                    fm[k.strip()] = v.strip()

        if status_filter and fm.get("status") != status_filter:
            continue

        results.append({
            "session_id": fm.get("session_id", path.stem),
            "date": fm.get("date", ""),
            "goal": fm.get("goal", ""),
            "status": fm.get("status", "unknown"),
            "target": fm.get("target", ""),
        })
    return results


# ── CLI ──

def main() -> int:
    parser = argparse.ArgumentParser(description="Agent Memory Ledger")
    sub = parser.add_subparsers(dest="cmd")

    p_start = sub.add_parser("start", help="Start a new session")
    p_start.add_argument("goal")
    p_start.add_argument("--target", default=None)

    p_update = sub.add_parser("update", help="Update a session")
    p_update.add_argument("session_id")
    p_update.add_argument("--notes", default=None)
    p_update.add_argument("--decisions", nargs="*", default=None)
    p_update.add_argument("--changed", nargs="*", dest="changed_paths", default=None)

    p_finish = sub.add_parser("finish", help="Finish a session")
    p_finish.add_argument("session_id")
    p_finish.add_argument("--summary", required=True)

    p_resume = sub.add_parser("resume", help="Resume a session")
    p_resume.add_argument("session_id")

    p_list = sub.add_parser("list", help="List sessions")
    p_list.add_argument("--status", default=None)

    args = parser.parse_args()

    if args.cmd == "start":
        start(args.goal, args.target)
    elif args.cmd == "update":
        update(args.session_id, args.notes, args.decisions, args.changed_paths)
    elif args.cmd == "finish":
        finish(args.session_id, args.summary)
    elif args.cmd == "resume":
        data = resume(args.session_id)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    elif args.cmd == "list":
        sessions = list_sessions(args.status)
        print(json.dumps(sessions, ensure_ascii=False, indent=2))
    else:
        parser.print_help()
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
