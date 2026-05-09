#!/usr/bin/env python3
"""LLM-powered content extractor for the wiki crawler pipeline.

Uses litellm to drive LLM-based content extraction, quality assessment,
summarization, and entity recognition.  Designed as the core "Intelligence
Layer" that sits behind the raw fetch + trafilatura pre-extraction.

Usage (library):
    from tools.fetchers.llm_extractor import LLMExtractor, ExtractionResult

    extractor = LLMExtractor(config)
    result = await extractor.extract(html, url, title)

Usage (CLI):
    python tools/fetchers/llm_extractor.py < html_file
    python tools/fetchers/llm_extractor.py --config config/scraper_config.yaml < html_file
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("llm_extractor")


# ── Errors ────────────────────────────────────────────────────────────
class LLMExtractionError(Exception):
    """Raised when an LLM call fails irrecoverably."""


class LLMNotConfiguredError(LLMExtractionError):
    """Raised when no LLM provider / API key is available."""


# ── Data classes ──────────────────────────────────────────────────────
@dataclass
class QualityAssessment:
    """Result of a quality check on extracted content."""

    score: int = 0  # 0-100
    is_article: bool = False
    is_navigation: bool = False
    is_error: bool = False
    is_blocked: bool = False
    issues: list[str] = field(default_factory=list)

    @classmethod
    def from_llm_output(cls, raw: str) -> "QualityAssessment":
        """Parse JSON output from the quality-check prompt."""
        try:
            data = _extract_json(raw)
            return cls(
                score=int(data.get("score", 0)),
                is_article=bool(data.get("is_article", False)),
                is_navigation=bool(data.get("is_navigation", False)),
                is_error=bool(data.get("is_error", False)),
                is_blocked=bool(data.get("is_blocked", False)),
                issues=data.get("issues", []),
            )
        except (json.JSONDecodeError, KeyError, ValueError):
            return cls(score=0, issues=[f"Failed to parse LLM output: {raw[:200]}"])


@dataclass
class ExtractionResult:
    """Full result of an LLM extraction pass."""

    content: str = ""                  # Clean Markdown body
    summary: str = ""                  # 2-3 sentence summary
    entities: list[str] = field(default_factory=list)  # Entity name strings
    extractor: str = "llm"             # llm | trafilatura | raw
    quality: QualityAssessment | None = None
    metadata: dict[str, str] = field(default_factory=dict)


# ── Config helpers ────────────────────────────────────────────────────
def _load_config(config_path: Path | None) -> dict[str, Any]:
    """Load scraper configuration from YAML, with sensible defaults."""
    default_config: dict[str, Any] = {
        "scraper": {
            "browser": {"enabled": False, "timeout": 30, "wait_for_selector": ""},
            "extraction": {
                "provider": "litellm",
                "model": "claude-haiku-4-5-20251001",
                "fallback_model": "claude-sonnet-4-6",
                "max_input_tokens": 6000,
                "max_output_tokens": 2000,
                "temperature": 0.1,
                "prompts": {},
            },
            "quality": {
                "min_content_length": 200,
                "trafilatura_bypass_length": 1000,
                "llm_min_quality_score": 30,
            },
            "rate_limit": {
                "max_concurrent": 3,
                "max_concurrent_http": 5,
                "requests_per_minute": 10,
                "retry_max": 3,
                "retry_backoff": "exponential",
            },
            "dedup": {"url_hash": True},
            "logging": {"level": "INFO", "file": "logs/scraper.log"},
        }
    }

    if config_path and config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            user = yaml.safe_load(f) or {}
        _deep_merge(default_config, user)

    return default_config


def _deep_merge(base: dict, override: dict) -> None:
    """Merge override dict into base dict recursively."""
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value


def _extract_json(text: str) -> dict:
    """Extract the first JSON object/array from LLM output text."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find JSON block in markdown code fences
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        try:
            return json.loads(m[1].strip())
        except json.JSONDecodeError:
            pass

    # Fallback: find first {...} or [...] (non-greedy with context)
    for pattern in [r"\{[^{}]*\}", r"\[[^\[\]]*\]"]:
        m = re.search(pattern, text)
        if m:
            try:
                return json.loads(m[0])
            except json.JSONDecodeError:
                continue

    # Last resort: try greedier match for nested structures
    for pattern in [r"\{[\s\S]*\}", r"\[[\s\S]*\]"]:
        m = re.search(pattern, text)
        if m:
            try:
                return json.loads(m[0])
            except json.JSONDecodeError:
                continue

    raise json.JSONDecodeError("No valid JSON found", text, 0)


def _truncate_html(html: str, max_tokens: int) -> str:
    """Truncate HTML to roughly *max_tokens* by keeping head + tail."""
    limit = max_tokens * 3
    if len(html) <= limit:
        return html
    half = limit // 2
    return html[:half] + chr(10)*2 + '<!-- ... truncated ... -->' + chr(10)*2 + html[-half:]

# ── Prompt templates ──────────────────────────────────────────────────
CONTENT_EXTRACTION_PROMPT = """\
You are a professional content extraction assistant. Extract the main body from the HTML below and output clean Markdown.

Rules:
1. Remove navigation links, sidebars, footers, ads, comment sections, and recommended reading
2. Preserve the original heading hierarchy (h1-h6)
3. Preserve tables, lists, code blocks, and other structured content
4. For images, keep the alt text and note [Image: alt text]
5. If the page is mainly a list of links or navigation, respond "NOT_ARTICLE: <reason>"
6. Output ONLY the Markdown body, no explanations

Prioritize content inside <article> tags; fall back to <main>; then <body>.

---
HTML source:
{html}
---
"""

SUMMARIZATION_PROMPT = '''\
Please summarize the core content of the following article in 2-3 sentences.
Output only the summary text, no titles, tags, or explanations.

---
{content}
---
'''

ENTITY_EXTRACTION_PROMPT = '''\
Extract key entities from the following article. Output a JSON array:
[
  {{
    "name": "entity name",
    "type": "person|organization|project|concept|technology",
    "context": "one sentence of context from the article"
  }}
]

Entity types:
- person: individual people
- organization: companies, institutions, organizations
- project: projects, products
- concept: concepts, methodologies, theories
- technology: tech stacks, frameworks, tools, programming languages

Output ONLY the JSON array, no explanations.

---
{content}
---
'''



# ── Main class ────────────────────────────────────────────────────────
class LLMExtractor:
    """LLM-powered content extractor using litellm as the backend."""

    def __init__(self, config: dict[str, Any] | None = None):
        cfg = config or {}
        scraper = cfg.get("scraper", {})
        self._extraction_cfg = scraper.get("extraction", {})
        self._quality_cfg = scraper.get("quality", {})
        self._rate_limit_cfg = scraper.get("rate_limit", {})

        self.model = self._extraction_cfg.get("model", "claude-haiku-4-5-20251001")
        self.fallback_model = self._extraction_cfg.get("fallback_model", "claude-sonnet-4-6")
        self.provider = self._extraction_cfg.get("provider", "litellm")
        self.max_input_tokens = self._extraction_cfg.get("max_input_tokens", 6000)
        self.max_output_tokens = self._extraction_cfg.get("max_output_tokens", 2000)
        self.temperature = self._extraction_cfg.get("temperature", 0.1)

        # Load custom prompts if any
        prompts = self._extraction_cfg.get("prompts", {})
        self._content_extraction_prompt = prompts.get(
            "content_extraction", CONTENT_EXTRACTION_PROMPT
        )
        self._summarization_prompt = prompts.get(
            "summarization", SUMMARIZATION_PROMPT
        )
        self._entity_extraction_prompt = prompts.get(
            "entity_extraction", ENTITY_EXTRACTION_PROMPT
        )

        self._check_credentials()


    async def extract(self, html: str, url: str = "", title: str = "") -> ExtractionResult:
        """Extract clean Markdown content from an HTML page via LLM."""
        # 0. Quick pre-check for tiny/error pages
        if len(html) < 100:
            return ExtractionResult(
                content="", summary="", extractor="raw",
                quality=QualityAssessment(score=0, is_error=True, issues=["HTML too short"]),
            )

        # 1. Truncate if needed
        truncated = _truncate_html(html, self.max_input_tokens)

        # 2. LLM content extraction
        prompt = self._content_extraction_prompt.format(html=truncated)
        try:
            raw_output = await self._call_llm(prompt, title=f"extract:{title}")
        except LLMExtractionError:
            return ExtractionResult(
                content="", summary="", extractor="raw",
                quality=QualityAssessment(score=0, is_error=True,
                                         issues=["LLM call failed"]),
            )

        # 3. Check for NOT_ARTICLE marker
        if raw_output.startswith("NOT_ARTICLE:"):
            reason = raw_output[len("NOT_ARTICLE:"):].strip()
            return ExtractionResult(
                content="", summary="", extractor="raw",
                quality=QualityAssessment(
                    score=0, is_navigation=True,
                    issues=[f"LLM判定非文章: {reason}"]
                ),
            )

        content = raw_output.strip()

        # 4. Basic quality assessment
        quality = QualityAssessment(score=70, is_article=True, issues=[])
        min_len = self._quality_cfg.get("min_content_length", 200)
        if len(content) < min_len:
            quality.score = 20
            quality.is_article = False
            quality.issues.append(f"Content too short: {len(content)} chars")

        # 5. Summarize and extract entities (run in parallel)
        import asyncio
        summary, entities = await asyncio.gather(
            self.summarize(content),
            self.extract_entities(content),
        )

        return ExtractionResult(
            content=content, summary=summary, entities=entities,
            extractor="llm", quality=quality,
            metadata={"url": url, "title": title},
        )

    async def quality_check(self, content: str, url: str = "") -> QualityAssessment:
        """Heuristic quality assessment on pre-extracted content (free, no LLM)."""
        if len(content) < self._quality_cfg.get("min_content_length", 200):
            return QualityAssessment(score=10, issues=["Content too short"])

        length_score = min(80, len(content) // 50)
        has_structure = bool(re.search(r"^#{1,3}\s", content, re.MULTILINE))
        struct_bonus = 15 if has_structure else 0
        score = min(100, length_score + struct_bonus)

        return QualityAssessment(
            score=score, is_article=score >= 40,
            issues=[] if score >= 40 else ["Low heuristic quality score"],
        )

    async def summarize(self, content: str) -> str:
        """Generate a 2-3 sentence summary of the content."""
        if len(content) < 200:
            return ""

        truncated = content[: self.max_input_tokens * 3]
        prompt = self._summarization_prompt.format(content=truncated)
        try:
            return (await self._call_llm(prompt, title="summarize")).strip()
        except LLMExtractionError:
            return ""

    async def extract_entities(self, content: str) -> list[str]:
        """Extract named entity names from content."""
        if len(content) < 200:
            return []

        truncated = content[: self.max_input_tokens * 3]
        prompt = self._entity_extraction_prompt.format(content=truncated)
        try:
            raw = await self._call_llm(prompt, title="entities")
            items = _extract_json(raw)
            if isinstance(items, list):
                return [item.get("name", "") for item in items if isinstance(item, dict)]
            return []
        except (LLMExtractionError, json.JSONDecodeError):
            return []


    async def _call_llm(self, prompt: str, title: str = "") -> str:
        """Call litellm acompletion. Returns text content, raises LLMExtractionError."""
        import litellm

        messages = [{"role": "user", "content": prompt}]

        try:
            response = await litellm.acompletion(
                model=self.model,
                messages=messages,
                max_tokens=self.max_output_tokens,
                temperature=self.temperature,
            )
            choice = response.choices[0]
            content = choice.message.content
            return (content or "").strip()

        except litellm.exceptions.APIError as e:
            logger.error(f"LLM API error [{title}]: {e}")
            if self.fallback_model and self.fallback_model != self.model:
                try:
                    logger.info(f"Retrying with fallback model: {self.fallback_model}")
                    response = await litellm.acompletion(
                        model=self.fallback_model,
                        messages=messages,
                        max_tokens=self.max_output_tokens,
                        temperature=self.temperature,
                    )
                    choice = response.choices[0]
                    content = choice.message.content
                    return (content or "").strip()
                except Exception:
                    raise LLMExtractionError(str(e)) from e
            raise LLMExtractionError(str(e)) from e

        except Exception as e:
            logger.error(f"LLM call failed [{title}]: {e}")
            raise LLMExtractionError(str(e)) from e

    def _check_credentials(self) -> None:
        """Log a warning if the required API key is not set."""
        model_lower = self.model.lower()
        key_env_vars = {
            "claude": "ANTHROPIC_API_KEY",
            "gpt": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }
        for prefix, var in key_env_vars.items():
            if prefix in model_lower and not os.environ.get(var):
                logger.warning(
                    f"Model '{self.model}' may require {var} env var, which is not set"
                )
                break


# ── CLI ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="LLM Content Extractor - extract clean Markdown from HTML",
    )
    parser.add_argument("--config", type=Path, help="Path to scraper_config.yaml")
    parser.add_argument("--html", type=Path, help="Read HTML from file (default: stdin)")
    parser.add_argument("--url", default="", help="Source URL (for metadata)")
    parser.add_argument("--summarize", action="store_true", help="Also generate summary")
    parser.add_argument("--entities", action="store_true", help="Also extract entities")
    args = parser.parse_args()

    if args.html:
        html = args.html.read_text(encoding="utf-8")
    else:
        html = sys.stdin.read()

    # Resolve config path relative to repo root
    repo_root = Path(__file__).parent.parent.parent
    if args.config:
        config_path = args.config if args.config.is_absolute() else repo_root / args.config
    else:
        config_path = repo_root / "config" / "scraper_config.yaml"
    config = _load_config(config_path)

    async def run():
        extractor = LLMExtractor(config)
        result = await extractor.extract(html, url=args.url)
        print(result.content)
        if args.summarize and result.summary:
            print("\n---\n## Summary\n")
            print(result.summary)
        if args.entities and result.entities:
            print("\n---\n## Entities\n")
            for e in result.entities:
                print(f"- {e}")

    import asyncio
    asyncio.run(run())


if __name__ == "__main__":
    main()
