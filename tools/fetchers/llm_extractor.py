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
import hashlib
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

# Load .env file if present (for local API key configuration)
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
_env_path = REPO_ROOT / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path, override=False)

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# ── Logging ──────────────────────────────────────────────────────────
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
class Entity:
    """Named entity recognized from content, with type and wiki link suggestion."""

    name: str = ""
    type: str = ""          # person|organization|project|concept|technology
    context: str = ""       # one sentence of context from the article
    wikilink: str = ""      # suggested wiki page name for [[wikilink]]

    def __str__(self) -> str:
        return self.name

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "type": self.type, "context": self.context, "wikilink": self.wikilink}


@dataclass
class ExtractionResult:
    """Full result of an LLM extraction pass."""

    content: str = ""                  # Clean Markdown body
    summary: str = ""                  # 2-3 sentence summary
    entities: list[Entity] = field(default_factory=list)  # Named entities with metadata
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
                "model": os.getenv("LLM_MODEL", "deepseek/deepseek-chat"),
                "fallback_model": os.getenv("LLM_MODEL_FAST", "deepseek/deepseek-chat"),
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
    """Extract the first JSON object/array from LLM output text.

    Uses brace-counting to correctly handle nested structures.
    """
    text = text.strip()
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find JSON block in markdown code fences
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Brace-counting search for nested JSON
    def _find_json_block(s: str) -> str | None:
        for start_char, end_char in (("{", "}"), ("[", "]")):
            start = s.find(start_char)
            if start == -1:
                continue
            depth = 0
            for i in range(start, len(s)):
                if s[i] == start_char:
                    depth += 1
                elif s[i] == end_char:
                    depth -= 1
                    if depth == 0:
                        return s[start:i + 1]
        return None

    block = _find_json_block(text)
    if block:
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError("No valid JSON found", text, 0)


def _truncate_html(html: str, max_tokens: int) -> str:
    """Truncate HTML to roughly *max_tokens* by keeping head + tail."""
    limit = max_tokens * 3
    if len(html) <= limit:
        return html
    half = limit // 2
    return html[:half] + chr(10) * 2 + '<!-- ... truncated ... -->' + chr(10) * 2 + html[-half:]


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
    "context": "one sentence of context from the article",
    "wikilink": "SuggestedWikiPageName"
  }}
]

Entity types:
- person: individual people
- organization: companies, institutions, organizations
- project: projects, products
- concept: concepts, methodologies, theories
- technology: tech stacks, frameworks, tools, programming languages

wikilink rules:
- Use TitleCase without spaces (e.g. "OpenAI", "MachineLearning", "React")
- This will be used as [[wikilink]] in markdown

Output ONLY the JSON array, no explanations.

---
{content}
---
'''


class ExtractionCache:
    """Cache LLM extraction results by content hash."""

    def __init__(self, cache_dir: Path | None = None):
        self._cache_dir = cache_dir or (REPO_ROOT / "state" / "llm_cache")
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._ttl_days = 7

    def get(self, content_hash: str) -> dict | None:
        cache_file = self._cache_dir / content_hash[:2] / f"{content_hash}.json"
        if not cache_file.exists():
            return None
        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            cached_at = data.get("cached_at", 0)
            if time.time() - cached_at > self._ttl_days * 86400:
                cache_file.unlink(missing_ok=True)
                return None
            return data
        except (json.JSONDecodeError, OSError):
            return None

    def put(self, content_hash: str, result: dict, model: str = "", tokens_used: int = 0):
        sub_dir = self._cache_dir / content_hash[:2]
        sub_dir.mkdir(parents=True, exist_ok=True)
        cache_file = sub_dir / f"{content_hash}.json"
        data = {
            "cached_at": time.time(),
            "model": model,
            "tokens_used": tokens_used,
            "content": result.get("content", ""),
            "summary": result.get("summary", ""),
            "entities": result.get("entities", []),
        }
        cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    def cleanup(self, max_age_days: int = 30) -> int:
        removed = 0
        cutoff = time.time() - max_age_days * 86400
        for sub_dir in self._cache_dir.iterdir():
            if not sub_dir.is_dir():
                continue
            for cache_file in sub_dir.glob("*.json"):
                try:
                    data = json.loads(cache_file.read_text(encoding="utf-8"))
                    if data.get("cached_at", 0) < cutoff:
                        cache_file.unlink()
                        removed += 1
                except (json.JSONDecodeError, OSError):
                    cache_file.unlink(missing_ok=True)
                    removed += 1
        return removed


class ContentClassifier:
    """Rule-based content complexity classifier (no LLM needed)."""

    @staticmethod
    def classify(html: str) -> str:
        """Return 'simple', 'complex', or 'default'.

        Rules:
        - text/markup ratio > 0.5 AND has <article> → 'simple'
        - text/markup ratio < 0.2 OR heavy nav/footer → 'complex'
        - else → 'default'
        """
        import re
        text_chars = len(re.sub(r'<[^>]+>', '', html))
        markup_chars = len(html)
        ratio = text_chars / max(markup_chars, 1)

        has_article = "<article" in html.lower()
        has_heavy_nav = html.lower().count("<nav") > 2 or html.lower().count("<footer") > 2

        if ratio > 0.5 and has_article:
            return "simple"
        if ratio < 0.2 or has_heavy_nav:
            return "complex"
        return "default"

    @staticmethod
    def get_model_for_complexity(complexity: str, routing_config: dict | None = None) -> str | None:
        """Return model name for given complexity level."""
        cfg = routing_config or {}
        return cfg.get(complexity)


# ── Main class ────────────────────────────────────────────────────────
class LLMExtractor:
    """LLM-powered content extractor using litellm as the backend."""

    def __init__(self, config: dict[str, Any] | None = None):
        cfg = config or {}
        scraper = cfg.get("scraper", {})
        self._extraction_cfg = scraper.get("extraction", {})
        self._quality_cfg = scraper.get("quality", {})
        self._rate_limit_cfg = scraper.get("rate_limit", {})

        self.model = self._extraction_cfg.get("model", os.getenv("LLM_MODEL", "deepseek/deepseek-chat"))
        self.fallback_model = self._extraction_cfg.get("fallback_model", os.getenv("LLM_MODEL_FAST", "deepseek/deepseek-chat"))
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
        self._extraction_cache = ExtractionCache()
        self._routing_config = self._extraction_cfg.get("model_routing", {})

    async def extract(self, html: str, url: str = "", title: str = "") -> ExtractionResult:
        """Extract clean Markdown content from an HTML page via LLM."""
        # 0. Quick pre-check for tiny/error pages
        if len(html) < 100:
            return ExtractionResult(
                content="", summary="", extractor="raw",
                quality=QualityAssessment(score=0, is_error=True, issues=["HTML too short"]),
            )

        # 0.5 Check content hash cache
        content_hash = hashlib.sha256(html.encode("utf-8")).hexdigest()
        cached = self._extraction_cache.get(content_hash)
        if cached and cached.get("content"):
            logger.info(f"Extraction cache hit | hash={content_hash[:12]}")
            return ExtractionResult(
                content=cached["content"],
                summary=cached.get("summary", ""),
                entities=[
                    Entity(name=e.get("name",""), type=e.get("type",""), context=e.get("context",""), wikilink=e.get("wikilink",""))
                    for e in cached.get("entities", [])
                    if isinstance(e, dict)
                ],
                extractor="llm_cached",
                quality=QualityAssessment(score=70, is_article=True),
                metadata={"url": url, "title": title},
            )

        # 0.6 Select model based on content complexity
        complexity = ContentClassifier.classify(html)
        routed_model = ContentClassifier.get_model_for_complexity(complexity, self._routing_config)
        if routed_model:
            logger.info(f"Model routing | complexity={complexity} model={routed_model}")
            original_model = self.model
            self.model = routed_model

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

        # Cache the result
        try:
            entity_dicts = [{"name": e.name, "type": e.type, "context": e.context, "wikilink": e.wikilink} for e in entities]
            self._extraction_cache.put(content_hash, {
                "content": content,
                "summary": summary,
                "entities": entity_dicts,
            }, model=self.model)
        except Exception:
            pass

        return ExtractionResult(
            content=content, summary=summary, entities=entities,
            extractor="llm", quality=quality,
            metadata={"url": url, "title": title},
        )

    async def batch_scrape(
        self,
        items: list[dict[str, str]],
        max_concurrent: int = 3,
    ) -> list[ExtractionResult]:
        """Scrape multiple URLs concurrently with rate limiting.

        Args:
            items: list of {"url": str, "html": str, "title": str} dicts.
            max_concurrent: max simultaneous LLM calls.

        Returns:
            list of ExtractionResult in same order as input.
        """
        import asyncio

        semaphore = asyncio.Semaphore(max_concurrent)

        async def _one(item: dict[str, str]) -> ExtractionResult:
            async with semaphore:
                return await self.extract(
                    html=item.get("html", ""),
                    url=item.get("url", ""),
                    title=item.get("title", ""),
                )

        return await asyncio.gather(*(_one(item) for item in items))

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

    async def extract_entities(self, content: str) -> list[Entity]:
        """Extract named entities with type, context and wikilink from content."""
        if len(content) < 200:
            return []

        truncated = content[: self.max_input_tokens * 3]
        prompt = self._entity_extraction_prompt.format(content=truncated)
        try:
            raw = await self._call_llm(prompt, title="entities")
            items = _extract_json(raw)
            if isinstance(items, list):
                return [
                    Entity(
                        name=str(item.get("name", "")).strip(),
                        type=str(item.get("type", "")).strip(),
                        context=str(item.get("context", "")).strip(),
                        wikilink=str(item.get("wikilink", "")).strip(),
                    )
                    for item in items
                    if isinstance(item, dict) and item.get("name")
                ]
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
        key_env_vars = [
            ("anthropic", "ANTHROPIC_API_KEY"),
            ("claude", "ANTHROPIC_API_KEY"),
            ("gpt", "OPENAI_API_KEY"),
            ("openai", "OPENAI_API_KEY"),
            ("gemini", "GEMINI_API_KEY"),
            ("deepseek", "DEEPSEEK_API_KEY"),
        ]
        for prefix, var in key_env_vars:
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
                print(f"- {e.name} ({e.type}) — {e.wikilink or 'no wikilink'}")

    import asyncio
    asyncio.run(run())


if __name__ == "__main__":
    main()
