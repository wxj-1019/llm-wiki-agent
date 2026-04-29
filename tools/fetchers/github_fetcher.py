#!/usr/bin/env python3
"""Fetch GitHub repository releases and trending repos for batch ingestion.

Usage:
    python tools/fetchers/github_fetcher.py --config config/github_sources.yaml [--token GITHUB_TOKEN]

Dependencies: none (uses stdlib only).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "github"


def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_urls": {}, "last_runs": {}}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _api_get(url: str, token: str | None = None, timeout: int = 30) -> Any:
    headers = {
        "User-Agent": "llm-wiki-agent/1.0",
        "Accept": "application/vnd.github+json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  ⚠️  API error: {e}", file=sys.stderr)
        return None


def _write_markdown(
    title: str,
    url: str,
    body: str,
    source_type: str,
    extra_frontmatter: dict[str, str] | None = None,
) -> Path | None:
    state = _load_state()
    if url in state["processed_urls"]:
        return None

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slug = "".join(c if c.isalnum() or c == "-" else "-" for c in title.lower())[:80]
    filename = f"{date_prefix}-{slug}.md"
    out_path = OUT_DIR / filename
    counter = 1
    while out_path.exists():
        out_path = OUT_DIR / f"{date_prefix}-{slug}-{counter}.md"
        counter += 1

    fm = {
        "title": title.replace('"', '\\"'),
        "source_url": url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source_type": source_type,
    }
    if extra_frontmatter:
        fm.update(extra_frontmatter)

    fm_lines = "\n".join(f'{k}: "{v}"' for k, v in fm.items())
    content = f"""---
{fm_lines}
---

{body}
"""
    out_path.write_text(content, encoding="utf-8")
    state["processed_urls"][url] = str(out_path.relative_to(REPO_ROOT).as_posix())
    _save_state(state)
    return out_path


def fetch_releases(repo: str, token: str | None, max_items: int) -> list[Path]:
    url = f"https://api.github.com/repos/{repo}/releases?per_page={max_items}"
    data = _api_get(url, token)
    if not isinstance(data, list):
        return []

    saved = []
    for rel in data:
        tag = rel.get("tag_name", "unknown")
        title = f"{repo} release {tag}"
        body = rel.get("body") or "No release notes provided."
        html_url = rel.get("html_url", f"https://github.com/{repo}/releases")
        p = _write_markdown(
            title=title,
            url=html_url,
            body=body,
            source_type="github_release",
            extra_frontmatter={"repo": repo, "tag": tag},
        )
        if p:
            saved.append(p)
    return saved


def fetch_repo_info(repo: str, token: str | None) -> list[Path]:
    url = f"https://api.github.com/repos/{repo}"
    data = _api_get(url, token)
    if not isinstance(data, dict):
        return []

    title = f"Project: {data.get('full_name', repo)}"
    body = f"""# {data.get('name', repo)}

{data.get('description', 'No description.')}

- Stars: {data.get('stargazers_count', 0)}
- Language: {data.get('language', 'Unknown')}
- Homepage: {data.get('homepage', 'N/A')}
- License: {data.get('license', {}).get('name', 'N/A')}

## README (first 2KB)
"""
    # Fetch full README
    readme_url = f"https://api.github.com/repos/{repo}/readme"
    readme_data = _api_get(readme_url, token)
    if isinstance(readme_data, dict):
        import base64
        try:
            readme_text = base64.b64decode(readme_data.get("content", "")).decode("utf-8", errors="ignore")
            if readme_text.strip():
                body += f"\n\n## README\n\n{readme_text}\n"
        except Exception:
            pass

    p = _write_markdown(
        title=title,
        url=data.get("html_url", f"https://github.com/{repo}"),
        body=body,
        source_type="github_repo",
        extra_frontmatter={"repo": repo, "language": str(data.get("language", ""))},
    )
    return [p] if p else []


def fetch_trending(
    languages: list[str],
    since_days: int,
    per_language: int,
    token: str | None,
) -> list[Path]:
    """Fetch trending/emerging repos from GitHub Search API.

    Uses `pushed:>DATE` to find recently active repos, sorted by stars.
    This approximates "trending" without scraping the Trending page.
    """
    since_date = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")
    saved: list[Path] = []

    for lang in languages:
        query_parts = [f"pushed:>{since_date}"]
        if lang and lang != "all":
            query_parts.append(f"language:{lang}")
        query = " ".join(query_parts)
        url = (
            "https://api.github.com/search/repositories?q="
            + urllib.parse.quote(query)
            + f"&sort=stars&order=desc&per_page={per_language}"
        )

        print(f"  Searching trending: lang={lang or 'all'} since={since_date}")
        data = _api_get(url, token)
        if not isinstance(data, dict):
            continue
        items = data.get("items", [])
        if not items:
            print(f"    → no results")
            continue

        for repo in items:
            full_name = repo.get("full_name")
            if not full_name:
                continue
            info_saved = fetch_repo_info(full_name, token)
            if info_saved:
                saved.extend(info_saved)
        print(f"    → {len(items)} repos found, {len(saved)} new file(s) so far")

    return saved


def run(config_path: Path, token: str | None, max_per_repo: int) -> int:
    try:
        import yaml
        cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except Exception:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))

    token = token or os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Warning: No GitHub token provided. API rate limit is 60 req/hr.", file=sys.stderr)

    total = 0

    # 1. Specific repos
    for item in cfg.get("repos", []):
        repo = item["repo"]
        kinds = item.get("kinds", ["info"])
        print(f"Fetching: {repo} ({', '.join(kinds)})")
        for kind in kinds:
            if kind == "releases":
                saved = fetch_releases(repo, token, max_per_repo)
            elif kind == "info":
                saved = fetch_repo_info(repo, token)
            else:
                saved = []
            if saved:
                print(f"  → {len(saved)} new file(s)")
                total += len(saved)
            else:
                print(f"  → no new data")

    # 2. Trending / emerging repos
    trending_cfg = cfg.get("trending")
    if trending_cfg and trending_cfg.get("enabled"):
        languages = trending_cfg.get("languages", ["all"])
        since_days = trending_cfg.get("since_days", 7)
        per_language = trending_cfg.get("per_language", 5)
        print(f"\nFetching trending repos (last {since_days} days, {per_language} per language)")
        saved = fetch_trending(languages, since_days, per_language, token)
        if saved:
            print(f"  → {len(saved)} new trending repo file(s)")
            total += len(saved)
        else:
            print(f"  → no new trending repos")

    state = _load_state()
    state["last_runs"]["github"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)
    print(f"\nDone. Total new files: {total}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch GitHub data for LLM Wiki Agent")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN"))
    parser.add_argument("--max-per-repo", type=int, default=5)
    args = parser.parse_args()
    sys.exit(run(args.config, args.token, args.max_per_repo))
