#!/usr/bin/env python3
"""Fetch arXiv papers via the HTTP API, download PDFs, convert to markdown,
and perform LLM-powered structured analysis.

Phase 2 pipeline:
  1. Query arXiv Atom API for each configured search
  2. Download PDF via <link title="pdf"> with 120s timeout
  3. Convert PDF to markdown via pymupdf4llm (fast) or fitz raw text fallback
  4. Run LLM structured extraction (research_question, method, key_findings, etc.)
  5. Dedup by arXiv ID before processing
  6. Async concurrent processing with semaphore(3)
  7. Fall back to metadata+abstract if PDF download/conversion fails

Usage:
    python tools/fetchers/arxiv_fetcher.py --config config/arxiv_sources.yaml [--max-results 20]

Dependencies: litellm (for LLM extraction), pymupdf4llm or PyMuPDF (optional, for PDF).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tools.fetchers._common import (
    REPO_ROOT,
    escape_yaml_value,
    load_config,
    load_state,
    safe_write_path,
    save_state,
)
from tools.fetchers.llm_extractor import LLMExtractor, _extract_json

OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "arxiv"

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}

STRUCTURED_EXTRACTION_PROMPT = """\
Analyze the following research paper text and extract structured information.
Output a JSON object with exactly these fields:
- "research_question": main research question or objective (string)
- "method": methodology used (string)
- "key_findings": list of key findings (list of strings, max 5)
- "benchmarks": list of benchmarks or datasets used (list of strings)
- "limitations": list of limitations mentioned or implied (list of strings, max 5)
- "novel_contributions": list of novel contributions (list of strings, max 5)
- "related_work_comparison": how this work compares to prior art (string)

Output ONLY valid JSON. No explanations, no markdown fences.

---
Paper text:
{text}
---
"""


class PDFQualityChecker:
    """Pre-check PDF text quality before LLM extraction."""

    @staticmethod
    def check(text: str) -> dict:
        """Return quality metrics for extracted PDF text.

        Returns:
            {
                "entropy": float,       # text diversity (Shannon entropy)
                "english_ratio": float, # ratio of ASCII letters
                "paragraphs": int,      # number of paragraph blocks
                "pass": bool,           # whether quality is acceptable
                "reason": str           # reason if failing
            }
        """
        import math
        if not text or len(text) < 100:
            return {"entropy": 0, "english_ratio": 0, "paragraphs": 0, "pass": False, "reason": "text too short"}

        freq: dict[str, int] = {}
        for ch in text.lower():
            freq[ch] = freq.get(ch, 0) + 1
        total = len(text)
        entropy = -sum((c / total) * math.log2(c / total) for c in freq.values())

        letters = sum(1 for ch in text if ch.isascii() and ch.isalpha())
        english_ratio = letters / max(total, 1)

        paragraphs = len([p for p in text.split("\n\n") if len(p.strip()) > 50])

        pass_check = entropy > 3.0 and english_ratio > 0.3 and paragraphs > 5
        reason = []
        if entropy <= 3.0:
            reason.append(f"low entropy ({entropy:.1f})")
        if english_ratio <= 0.3:
            reason.append(f"low english ratio ({english_ratio:.1%})")
        if paragraphs <= 5:
            reason.append(f"few paragraphs ({paragraphs})")

        return {
            "entropy": round(entropy, 2),
            "english_ratio": round(english_ratio, 3),
            "paragraphs": paragraphs,
            "pass": pass_check,
            "reason": ", ".join(reason) if reason else "ok",
        }


def _extract_text(node: ET.Element | None, path: str) -> str:
    if node is None:
        return ""
    child = node.find(path, NS)
    return (child.text or "").strip() if child is not None else ""


def _extract_arxiv_id(id_url: str) -> str:
    m = re.search(r"(\d{4}\.\d{4,5}(?:v\d+)?)", id_url)
    if m:
        return m.group(1)
    return id_url.rstrip("/").rsplit("/", 1)[-1]


def _extract_pdf_url(entry: ET.Element) -> str | None:
    for link in entry.findall("atom:link", NS):
        if link.get("title") == "pdf":
            return link.get("href")
    return None


def _fetch_atom(query: str, max_results: int) -> ET.Element | None:
    url = (
        "https://export.arxiv.org/api/query?"
        + urllib.parse.urlencode({
            "search_query": query,
            "start": 0,
            "max_results": max_results,
            "sortBy": "submittedDate",
            "sortOrder": "descending",
        })
    )
    req = urllib.request.Request(url, headers={"User-Agent": "llm-wiki-agent/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return ET.fromstring(resp.read())
    except Exception as e:
        print(f"  arXiv API error: {e}", file=sys.stderr)
        return None


async def _download_pdf(pdf_url: str) -> bytes | None:
    try:
        req = urllib.request.Request(pdf_url, headers={"User-Agent": "llm-wiki-agent/1.0"})
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(
            None, lambda: urllib.request.urlopen(req, timeout=120).read(),
        )
        return data
    except Exception as e:
        print(f"  PDF download failed: {e}", file=sys.stderr)
        return None


def _pdf_to_markdown(pdf_bytes: bytes) -> str | None:
    try:
        import pymupdf4llm
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        try:
            md_text = pymupdf4llm.to_markdown(tmp_path)
            return md_text if md_text and len(md_text.strip()) > 100 else None
        finally:
            Path(tmp_path).unlink(missing_ok=True)
    except ImportError:
        pass
    except Exception as e:
        print(f"  pymupdf4llm conversion failed: {e}", file=sys.stderr)
    try:
        import fitz
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        try:
            doc = fitz.open(tmp_path)
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            return text if text and len(text.strip()) > 100 else None
        finally:
            Path(tmp_path).unlink(missing_ok=True)
    except ImportError:
        print("  Neither pymupdf4llm nor PyMuPDF available, skipping PDF conversion", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  fitz text extraction failed: {e}", file=sys.stderr)
        return None


async def _run_structured_extraction(
    text: str, extractor: LLMExtractor,
) -> dict[str, Any] | None:
    truncated = text[:24000]
    prompt = STRUCTURED_EXTRACTION_PROMPT.format(text=truncated)
    try:
        raw = await extractor._call_llm(prompt, title="arxiv-structured")
        return _extract_json(raw)
    except Exception as e:
        print(f"  LLM structured extraction failed: {e}", file=sys.stderr)
        return None


def _format_structured_section(data: dict[str, Any]) -> str:
    lines = ["## Structured Analysis", ""]
    rq = data.get("research_question")
    if rq:
        lines.append(f"**Research Question:** {rq}")
        lines.append("")
    method = data.get("method")
    if method:
        lines.append(f"**Method:** {method}")
        lines.append("")
    for label, key in [
        ("Key Findings", "key_findings"),
        ("Benchmarks", "benchmarks"),
        ("Limitations", "limitations"),
        ("Novel Contributions", "novel_contributions"),
    ]:
        items = data.get(key, [])
        if items:
            lines.append(f"**{label}:**")
            for item in items:
                lines.append(f"- {item}")
            lines.append("")
    rwc = data.get("related_work_comparison")
    if rwc:
        lines.append(f"**Related Work Comparison:** {rwc}")
        lines.append("")
    return "\n".join(lines)


async def _process_entry(
    entry: ET.Element,
    query_label: str,
    state: dict[str, Any],
    extractor: LLMExtractor,
    sem: asyncio.Semaphore,
) -> Path | None:
    async with sem:
        return await _process_entry_inner(entry, query_label, state, extractor)


async def _process_entry_inner(
    entry: ET.Element,
    query_label: str,
    state: dict[str, Any],
    extractor: LLMExtractor,
) -> Path | None:
    id_url = _extract_text(entry, "atom:id")
    url = id_url.replace("http://arxiv.org/abs/", "https://arxiv.org/abs/")
    arxiv_id = _extract_arxiv_id(url)

    if arxiv_id in state.get("arxiv_ids", {}):
        return None
    if url in state.get("processed_urls", {}):
        return None

    title = _extract_text(entry, "atom:title")
    summary = _extract_text(entry, "atom:summary")
    published = _extract_text(entry, "atom:published")

    authors = []
    for author in entry.findall("atom:author", NS):
        name = _extract_text(author, "atom:name")
        if name:
            authors.append(name)

    categories = []
    for cat in entry.findall("atom:category", NS):
        term = cat.get("term")
        if term:
            categories.append(term)

    full_text: str | None = None
    extractor_label = "metadata"

    pdf_url = _extract_pdf_url(entry)
    if pdf_url:
        print(f"  Downloading PDF for {arxiv_id}...", file=sys.stderr)
        pdf_bytes = await _download_pdf(pdf_url)
        if pdf_bytes:
            full_text = _pdf_to_markdown(pdf_bytes)
            if full_text:
                extractor_label = "pdf"
                print(f"  PDF converted ({len(full_text)} chars) for {arxiv_id}", file=sys.stderr)

    structured: dict[str, Any] | None = None
    if full_text:
        print(f"  Running LLM structured extraction for {arxiv_id}...", file=sys.stderr)
        structured = await _run_structured_extraction(full_text, extractor)
        if structured:
            extractor_label = "llm"

    body_parts = [
        f"# {title}",
        "",
        f"**Authors:** {', '.join(authors)}",
        f"**Categories:** {', '.join(categories)}",
        f"**Published:** {published}",
        f"**URL:** {url}",
        "",
        "## Abstract",
        "",
        summary,
    ]

    if full_text and extractor_label in ("pdf", "llm"):
        body_parts.append("")
        body_parts.append("## Full Text")
        body_parts.append("")
        body_parts.append(full_text)

    if structured:
        body_parts.append("")
        body_parts.append(_format_structured_section(structured))

    body = "\n".join(body_parts)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = safe_write_path(OUT_DIR, title)

    fm = {
        "title": escape_yaml_value(title),
        "source_url": escape_yaml_value(url),
        "published": published,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source_type": "arxiv",
        "query_label": query_label,
        "authors": escape_yaml_value(", ".join(authors)),
        "categories": escape_yaml_value(", ".join(categories)),
        "extractor": extractor_label,
    }
    fm_lines = "\n".join(f'{k}: "{v}"' for k, v in fm.items())
    content = f"---\n{fm_lines}\n---\n\n{body}\n"

    out_path.write_text(content, encoding="utf-8")
    state.setdefault("arxiv_ids", {})[arxiv_id] = str(
        out_path.relative_to(REPO_ROOT).as_posix()
    )
    state["processed_urls"][url] = str(out_path.relative_to(REPO_ROOT).as_posix())
    return out_path


async def _async_run(config_path: Path, max_results: int) -> int:
    cfg = load_config(config_path)
    queries = cfg.get("queries", [])
    if not queries:
        print("No queries configured.", file=sys.stderr)
        return 1

    total = 0
    state = load_state()
    state.setdefault("arxiv_ids", {})

    llm_config: dict[str, Any] = {}
    extractor = LLMExtractor(llm_config)
    sem = asyncio.Semaphore(3)

    for q in queries:
        label = q.get("label", "unnamed")
        query = q["query"]
        print(f"Fetching arXiv: {label} ({query})")
        feed = _fetch_atom(query, max_results)
        if feed is None:
            continue

        entries = feed.findall("atom:entry", NS)
        tasks = [
            _process_entry(entry, label, state, extractor, sem)
            for entry in entries
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        saved = [r for r in results if isinstance(r, Path)]
        errors = [r for r in results if isinstance(r, Exception)]
        for e in errors:
            print(f"  Error processing entry: {e}", file=sys.stderr)

        if saved:
            print(f"  -> {len(saved)} new papers")
            total += len(saved)
        else:
            print("  -> no new papers")

    state["last_runs"]["arxiv"] = datetime.now(timezone.utc).isoformat()
    save_state(state)
    print(f"\nDone. Total new papers: {total}")
    return 0


def run(config_path: Path, max_results: int) -> int:
    return asyncio.run(_async_run(config_path, max_results))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch arXiv papers for LLM Wiki Agent")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--max-results", type=int, default=10)
    args = parser.parse_args()
    sys.exit(run(args.config, args.max_results))
