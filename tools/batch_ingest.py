#!/usr/bin/env python3
"""Ingest compiled batch files into the wiki, then archive them.

Wraps tools/ingest.py with coordination logic:
- Scans raw-inbox/batches/*.md
- Calls ingest.py for each batch
- On success, moves file to raw-inbox/batches/archived/
- Updates raw-inbox/state.json

Usage:
    python tools/batch_ingest.py [--dry-run] [--skip-archive]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
BATCH_DIR = REPO_ROOT / "raw-inbox" / "batches"
ARCHIVE_DIR = REPO_ROOT / "raw-inbox" / "batches" / "archived"
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
INGEST_SCRIPT = REPO_ROOT / "tools" / "ingest.py"


def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_urls": {}, "last_runs": {}, "compiled": [], "ingested_batches": []}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def run(dry_run: bool, skip_archive: bool) -> int:
    state = _load_state()
    ingested = set(state.get("ingested_batches", []))

    if not BATCH_DIR.exists():
        print("No batches directory found.")
        return 0

    batches = sorted(p for p in BATCH_DIR.glob("*.md") if p.is_file())
    if not batches:
        print("No batch files to ingest.")
        return 0

    success_count = 0
    fail_count = 0

    for batch_path in batches:
        rel = str(batch_path.relative_to(REPO_ROOT).as_posix())
        if rel in ingested:
            print(f"Skip (already ingested): {batch_path.name}")
            continue

        print(f"Ingesting: {batch_path.name}")
        if dry_run:
            print(f"  [dry-run] would call: python {INGEST_SCRIPT} {batch_path}")
            success_count += 1
            continue

        # Run ingest.py via subprocess to respect its self-contained design
        result = subprocess.run(
            [sys.executable, str(INGEST_SCRIPT), str(batch_path)],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )

        if result.returncode != 0:
            print(f"  ❌ Failed: {batch_path.name}")
            if result.stderr:
                print(result.stderr[:500], file=sys.stderr)
            fail_count += 1
            continue

        print(f"  ✅ Success: {batch_path.name}")
        success_count += 1
        ingested.add(rel)

        if not skip_archive:
            ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
            dest = ARCHIVE_DIR / batch_path.name
            counter = 1
            while dest.exists():
                dest = ARCHIVE_DIR / f"{batch_path.stem}-{counter}{batch_path.suffix}"
                counter += 1
            batch_path.rename(dest)

    state["ingested_batches"] = sorted(ingested)
    state["last_runs"]["batch_ingest"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)

    print(f"\nDone. Success: {success_count}, Failed: {fail_count}")
    return 1 if fail_count > 0 else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest compiled batch files into the wiki")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-archive", action="store_true",
                        help="Keep batch files in place after ingestion")
    args = parser.parse_args()
    sys.exit(run(args.dry_run, args.skip_archive))
