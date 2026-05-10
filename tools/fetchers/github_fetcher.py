#!/usr/bin/env python3
"""Fetch GitHub repository info, releases, and trending repos for batch ingestion.

Enhanced with full README fetching, directory tree analysis, dependency scanning,
CHANGELOG parsing, and optional LLM-powered architecture summaries.

Usage:
    python tools/fetchers/github_fetcher.py --config config/github_sources.yaml [--token GITHUB_TOKEN] [--llm]

Dependencies: none (uses stdlib only). Optional: litellm (for --llm).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from tools.fetchers._common import (
    REPO_ROOT,
    load_config,
    load_state,
    safe_write_path,
    save_state,
)

OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "github"

DEP_FILES = ("package.json", "pyproject.toml", "requirements.txt")


class GitHubRepoMetrics:
    """Track per-repo activity for adaptive check frequency."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "github_repo_metrics.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            self._state = json.loads(self._state_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            self._state = {}

    def record(self, repo: str, commits_since_last: int = 0):
        if repo not in self._state:
            self._state[repo] = {
                "check_count": 0, "total_commits": 0,
                "avg_commits": 0, "last_checked": "",
                "consecutive_zero": 0,
            }
        info = self._state[repo]
        info["check_count"] = info.get("check_count", 0) + 1
        info["total_commits"] = info.get("total_commits", 0) + commits_since_last
        info["last_checked"] = datetime.now(timezone.utc).isoformat()
        if commits_since_last == 0:
            info["consecutive_zero"] = info.get("consecutive_zero", 0) + 1
        else:
            info["consecutive_zero"] = 0
        n = info["check_count"]
        info["avg_commits"] = round(info["total_commits"] / n, 1) if n > 0 else 0
        self._save()

    def get_check_frequency(self, repo: str) -> str:
        info = self._state.get(repo)
        if not info:
            return "daily"
        avg = info.get("avg_commits", 0)
        zero = info.get("consecutive_zero", 0)
        if zero >= 14:
            return "monthly"
        if avg < 0.5 or zero >= 5:
            return "weekly"
        return "daily"

    def _save(self):
        tmp = self._state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._state_file)


def _api_get(url: str, token: str | None = None, timeout: int = 30, max_retries: int = 3) -> Any:
    headers = {
        "User-Agent": "llm-wiki-agent/1.0",
        "Accept": "application/vnd.github+json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    for attempt in range(max_retries):
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 403:
                reset_time = e.headers.get("X-RateLimit-Reset")
                remaining = e.headers.get("X-RateLimit-Remaining")
                if remaining == "0" and reset_time:
                    wait = int(reset_time) - int(time.time()) + 1
                    if 0 < wait < 300 and attempt < max_retries - 1:
                        print(f"  Rate limited, waiting {wait}s...")
                        time.sleep(wait)
                        continue
            if e.code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                sleep = 2 ** attempt
                print(f"  [RETRY] HTTP {e.code}, wait {sleep}s")
                time.sleep(sleep)
                continue
            print(f"  API error: {e}", file=sys.stderr)
            return None
        except Exception as e:
            if attempt < max_retries - 1:
                sleep = 2 ** attempt
                time.sleep(sleep)
                continue
            print(f"  API error: {e}", file=sys.stderr)
            return None
    return None


def _raw_get(url: str, timeout: int = 30) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "llm-wiki-agent/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return None


def _fetch_readme(repo: str, token: str | None) -> str:
    readme_url = f"https://raw.githubusercontent.com/{repo}/HEAD/README.md"
    text = _raw_get(readme_url)
    if text and text.strip():
        return text
    return ""


def _fetch_tree(repo: str, token: str | None) -> list[dict[str, Any]]:
    for branch in ("main", "master"):
        url = f"https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1"
        data = _api_get(url, token)
        if isinstance(data, dict) and isinstance(data.get("tree"), list):
            return data["tree"]
    return []


def _summarize_tree(tree: list[dict[str, Any]]) -> str:
    dirs: set[str] = set()
    top_files: list[str] = []
    for entry in tree:
        path = entry.get("path", "")
        if not path:
            continue
        parts = path.split("/")
        if len(parts) == 1:
            top_files.append(parts[0])
        elif len(parts) == 2:
            dirs.add(parts[0])
    lines = []
    if top_files:
        lines.append("**Root files:** " + ", ".join(top_files[:20]))
    if dirs:
        lines.append("**Top-level directories:** " + ", ".join(sorted(dirs)))
    return "\n".join(lines)


def _find_dep_files(tree: list[dict[str, Any]]) -> list[str]:
    found = []
    for entry in tree:
        name = entry.get("path", "")
        for dep in DEP_FILES:
            if name == dep or name.endswith("/" + dep):
                found.append(name)
                break
    return found


def _fetch_dep_content(repo: str, paths: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for p in paths:
        url = f"https://raw.githubusercontent.com/{repo}/HEAD/{p}"
        text = _raw_get(url)
        if text and text.strip():
            result[p] = text
    return result


def _summarize_deps(contents: dict[str, str]) -> str:
    lines = []
    for path, content in contents.items():
        basename = path.rsplit("/", 1)[-1]
        if basename == "package.json":
            try:
                pkg = json.loads(content)
                deps = list(pkg.get("dependencies", {}).keys())
                dev_deps = list(pkg.get("devDependencies", {}).keys())
                lines.append(f"**{path}** (npm)")
                if deps:
                    lines.append("  Dependencies: " + ", ".join(deps[:30]))
                if dev_deps:
                    lines.append("  DevDependencies: " + ", ".join(dev_deps[:30]))
            except json.JSONDecodeError:
                lines.append(f"**{path}** — (could not parse)")
        elif basename == "pyproject.toml":
            dep_names = []
            in_deps = False
            for line in content.splitlines():
                stripped = line.strip()
                if stripped.startswith("dependencies"):
                    in_deps = True
                    continue
                if in_deps:
                    if stripped.startswith("["):
                        in_deps = False
                        continue
                    name = stripped.split(">=")[0].split("<=")[0].split("==")[0].split("~=")[0].split("!=")[0].strip().strip("\"'")
                    if name and not name.startswith("#"):
                        dep_names.append(name)
            lines.append(f"**{path}** (Python)")
            if dep_names:
                lines.append("  Dependencies: " + ", ".join(dep_names[:30]))
        elif basename == "requirements.txt":
            dep_names = []
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                name = line.split(">=")[0].split("<=")[0].split("==")[0].split("~=")[0].split("!=")[0].strip()
                if name:
                    dep_names.append(name)
            lines.append(f"**{path}** (pip)")
            if dep_names:
                lines.append("  Dependencies: " + ", ".join(dep_names[:30]))
    return "\n".join(lines) if lines else ""


def _fetch_changelog(repo: str, tree: list[dict[str, Any]]) -> str | None:
    changelog_entry = None
    for entry in tree:
        name = entry.get("path", "")
        if name == "CHANGELOG.md" or name.endswith("/CHANGELOG.md"):
            changelog_entry = name
            break
    if not changelog_entry:
        return None
    url = f"https://raw.githubusercontent.com/{repo}/HEAD/{changelog_entry}"
    text = _raw_get(url)
    if not text or not text.strip():
        return None
    entries: list[str] = []
    for line in text.splitlines():
        if line.startswith("## ") or line.startswith("# "):
            entries.append(line)
            if len(entries) >= 3:
                break
    if not entries:
        return None
    sections: list[str] = []
    current_header = ""
    current_lines: list[str] = []
    header_count = 0
    for line in text.splitlines():
        if line.startswith("## ") or line.startswith("# "):
            if current_header and header_count <= 3:
                sections.append(current_header + "\n" + "\n".join(current_lines))
            current_header = line
            current_lines = []
            header_count += 1
            if header_count > 3:
                break
        elif current_header:
            current_lines.append(line)
    if current_header and header_count <= 3:
        sections.append(current_header + "\n" + "\n".join(current_lines))
    return "\n\n".join(sections)


async def _llm_summarize(body: str, repo: str) -> str:
    from tools.fetchers.llm_extractor import LLMExtractor

    extractor = LLMExtractor()
    prompt = (
        "Analyze the following GitHub repository information and provide a concise "
        "project architecture summary (3-5 paragraphs). Cover: purpose, tech stack, "
        "code organization, and notable patterns.\n\n"
        f"Repository: {repo}\n\n{body}"
    )
    return await extractor.summarize(prompt)


def _write_markdown(
    title: str,
    url: str,
    body: str,
    source_type: str,
    state: dict[str, Any],
    extra_frontmatter: dict[str, str] | None = None,
) -> Path | None:
    if url in state.get("processed_urls", {}):
        return None

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = safe_write_path(OUT_DIR, title)

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
    return out_path


def fetch_releases(repo: str, token: str | None, max_items: int, state: dict[str, Any]) -> list[Path]:
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
            state=state,
            extra_frontmatter={"repo": repo, "tag": tag},
        )
        if p:
            saved.append(p)
    return saved


def fetch_repo_info(repo: str, token: str | None, state: dict[str, Any], use_llm: bool = False) -> list[Path]:
    url = f"https://api.github.com/repos/{repo}"
    data = _api_get(url, token)
    if not isinstance(data, dict):
        return []

    title = f"Project: {data.get('full_name', repo)}"
    body_parts: list[str] = []
    body_parts.append(f"# {data.get('name', repo)}\n")
    body_parts.append(f"{data.get('description', 'No description.')}\n")
    body_parts.append(
        f"- Stars: {data.get('stargazers_count', 0)}\n"
        f"- Language: {data.get('language', 'Unknown')}\n"
        f"- Homepage: {data.get('homepage', 'N/A')}\n"
        f"- License: {data.get('license', {}).get('name', 'N/A')}\n"
    )

    readme_text = _fetch_readme(repo, token)
    if readme_text:
        body_parts.append("\n## README\n\n" + readme_text + "\n")

    tree = _fetch_tree(repo, token)
    if tree:
        tree_summary = _summarize_tree(tree)
        if tree_summary:
            body_parts.append("\n## Directory Structure\n\n" + tree_summary + "\n")

        dep_paths = _find_dep_files(tree)
        if dep_paths:
            dep_contents = _fetch_dep_content(repo, dep_paths)
            dep_summary = _summarize_deps(dep_contents)
            if dep_summary:
                body_parts.append("\n## Dependencies\n\n" + dep_summary + "\n")

        changelog = _fetch_changelog(repo, tree)
        if changelog:
            body_parts.append("\n## CHANGELOG (latest)\n\n" + changelog + "\n")

    body = "\n".join(body_parts)

    if use_llm:
        try:
            llm_summary = asyncio.run(_llm_summarize(body, repo))
            if llm_summary:
                body += "\n\n## LLM Architecture Summary\n\n" + llm_summary + "\n"
        except Exception as e:
            print(f"  LLM summary failed: {e}", file=sys.stderr)

    p = _write_markdown(
        title=title,
        url=data.get("html_url", f"https://github.com/{repo}"),
        body=body,
        source_type="github_repo",
        state=state,
        extra_frontmatter={"repo": repo, "language": str(data.get("language", ""))},
    )
    return [p] if p else []


def fetch_trending(
    languages: list[str],
    since_days: int,
    per_language: int,
    token: str | None,
    state: dict[str, Any],
    use_llm: bool = False,
) -> list[Path]:
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
            print("    -> no results")
            continue

        for repo in items:
            full_name = repo.get("full_name")
            if not full_name:
                continue
            info_saved = fetch_repo_info(full_name, token, state, use_llm=use_llm)
            if info_saved:
                saved.extend(info_saved)
        print(f"    -> {len(items)} repos found, {len(saved)} new file(s) so far")

    return saved


def run(config_path: Path, token: str | None, max_per_repo: int, use_llm: bool = False) -> int:
    cfg = load_config(config_path)
    token = token or os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Warning: No GitHub token provided. API rate limit is 60 req/hr.", file=sys.stderr)

    total = 0
    state = load_state()

    for item in cfg.get("repos", []):
        repo = item["repo"]
        kinds = item.get("kinds", ["info"])
        print(f"Fetching: {repo} ({', '.join(kinds)})")
        for kind in kinds:
            if kind == "releases":
                saved = fetch_releases(repo, token, max_per_repo, state)
            elif kind == "info":
                saved = fetch_repo_info(repo, token, state, use_llm=use_llm)
            else:
                saved = []
            if saved:
                print(f"  -> {len(saved)} new file(s)")
                total += len(saved)
            else:
                print("  -> no new data")

    trending_cfg = cfg.get("trending")
    if trending_cfg and trending_cfg.get("enabled"):
        languages = trending_cfg.get("languages", ["all"])
        since_days = trending_cfg.get("since_days", 7)
        per_language = trending_cfg.get("per_language", 5)
        print(f"\nFetching trending repos (last {since_days} days, {per_language} per language)")
        saved = fetch_trending(languages, since_days, per_language, token, state, use_llm=use_llm)
        if saved:
            print(f"  -> {len(saved)} new trending repo file(s)")
            total += len(saved)
        else:
            print("  -> no new trending repos")

    state["last_runs"]["github"] = datetime.now(timezone.utc).isoformat()
    save_state(state)
    print(f"\nDone. Total new files: {total}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch GitHub data for LLM Wiki Agent")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN"))
    parser.add_argument("--max-per-repo", type=int, default=5)
    parser.add_argument("--llm", action="store_true", default=False)
    args = parser.parse_args()
    sys.exit(run(args.config, args.token, args.max_per_repo, use_llm=args.llm))
