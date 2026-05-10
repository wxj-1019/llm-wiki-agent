#!/usr/bin/env python3
"""Auto-ingest fetched .md files directly into wiki/sources/ structured markdown.

Bypasses the batch pipeline for fast automated ingestion. Converts fetched
content into structured wiki source pages with quality scoring, entity detection,
near-duplicate filtering, and automatic [[wikilink]] generation.

Usage:
    python tools/auto_ingest.py                          # process all new fetched files
    python tools/auto_ingest.py --source web             # process only web fetches
    python tools/auto_ingest.py --dry-run                # preview without writing
    python tools/auto_ingest.py --file raw-inbox/fetched/web/2026-05-09-article.md
    python tools/auto_ingest.py --min-quality 40          # quality threshold (0-100)
    python tools/auto_ingest.py --verbose                # detailed per-file scoring
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import hashlib
import tempfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
FETCHED_DIR = REPO_ROOT / "raw-inbox" / "fetched"
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
WIKI_DIR = REPO_ROOT / "wiki"
SOURCES_DIR = WIKI_DIR / "sources"
ENTITIES_DIR = WIKI_DIR / "entities"
CONCEPTS_DIR = WIKI_DIR / "concepts"
INDEX_PATH = WIKI_DIR / "index.md"
LOG_PATH = WIKI_DIR / "log.md"


# ── State ───────────────────────────────────────────────────────────────────
def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "processed_urls": {}, "last_runs": {}, "url_meta": {},
        "content_hashes": {}, "auto_ingested": [],
        "auto_ingested_urls": [],
    }


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE_PATH)


# ── Frontmatter ─────────────────────────────────────────────────────────────
def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    match = re.match(r"^---\r?\n([\s\S]*?)\n---\r?\n?", text)
    if not match:
        return {}, text
    meta: dict[str, str] = {}
    for line in match.group(1).split("\n"):
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            meta[key] = val
    body = text[match.end():].strip()
    return meta, body


def _slugify(text: str, max_len: int = 80) -> str:
    text = text.strip()
    if not text:
        return "untitled"
    has_cjk = bool(re.search(r"[\u4e00-\u9fff]", text))
    if has_cjk:
        try:
            from pypinyin import lazy_pinyin
            slug = "-".join(lazy_pinyin(text)).lower()
            slug = re.sub(r"[^\w\s-]", "", slug)
            slug = re.sub(r"[-\s]+", "-", slug).strip("-")
            if slug and len(slug) >= 3:
                return slug[:max_len]
        except Exception:
            pass
        ascii_tokens = re.findall(r"[a-zA-Z0-9]+", text)
        ascii_part = "-".join(t.lower() for t in ascii_tokens if len(t) >= 2)
        short_hash = hashlib.md5(text.encode("utf-8")).hexdigest()[:6]
        slug = f"{ascii_part}-{short_hash}" if (ascii_part and len(ascii_part) >= 3) else f"article-{short_hash}"
        return slug[:max_len]
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[-\s]+", "-", slug).strip("-")
    return slug[:max_len] or "untitled"


def _safe_source_path(title: str) -> Path:
    base = _slugify(title)
    out = SOURCES_DIR / f"{base}.md"
    counter = 1
    while out.exists():
        out = SOURCES_DIR / f"{base}-{counter}.md"
        counter += 1
    return out


# ── Quality scoring ─────────────────────────────────────────────────────────
# Navigation noise indicators (high signal of non-content pages)
_NOISE_TITLE_PATTERNS = [
    r"^(首页|导航|网站地图|登录|注册)$",
    r"^(Home|Login|Register|Sitemap|Navigation)$",
]
_NOISE_BODY_PATTERNS = [
    (r"(登录\s*\|?\s*注册|忘记密码|记住我|验证码)", 50),
    (r"(Sign\s*In|Log\s*In|Create\s*Account|Forgot\s*Password)", 50),
    (r"(版权声明|免责声明|隐私政策|用户协议|服务条款)", 30),
    (r"(All Rights Reserved|Copyright\s+\d{4})", 20),
    (r"(<nav\b|<footer\b|<header\b)", 30),
    (r"(股票计算器|模拟炒股|自选股|手机客户端)", 25),
    (r"(新手炒股快速入门|教你快速了解股市)", 40),
]
_QUALITY_BODY_PATTERNS = [
    (r"#{1,3}\s+\S", 10),          # Has headings
    (r"\*\*[^*]+\*\*", 5),          # Has bold text
    (r"\[.+\]\(.+\)", 5),           # Has markdown links
    (r"^\s*[-*]\s+.+", 10),         # Has bullet lists
    (r"[A-Z][a-z]{2,}\s+[a-z]{2,}", 10),  # English prose patterns
    (r"[\u4e00-\u9fff]{10,}", 15),  # Substantive Chinese text blocks
    (r"\d{4}年\d{1,2}月", 15),      # Chinese dates (news articles)
    (r"[\u4e00-\u9fff][，。；：]", 10),  # Chinese punctuation (prose)
]


def _score_quality(title: str, body: str) -> tuple[float, str, list[str]]:
    """Score content quality 0-100. Returns (score, grade, reasons)."""
    score = 0.0
    reasons: list[str] = []
    body_len = len(body)

    # ── Penalties (noise detection) ──
    penalty = 0
    for pattern_str, p in _NOISE_BODY_PATTERNS:
        matches = re.findall(pattern_str, body, re.IGNORECASE)
        if matches:
            penalty += p * min(len(matches), 3)
            if p >= 40:
                reasons.append(f"Major noise: {pattern_str[:40]}... (matched {len(matches)} times)")

    for pattern_str in _NOISE_TITLE_PATTERNS:
        if re.match(pattern_str, title):
            penalty += 60
            reasons.append(f"Navigation title: '{title}'")

    # ── Rewards (content signals) ──
    reward = 0
    for pattern_str, r in _QUALITY_BODY_PATTERNS:
        matches = re.findall(pattern_str, body, re.MULTILINE)
        if matches:
            reward += min(r, len(matches) * 2)
    if reward > 0:
        reasons.append(f"Content signals: +{reward}")

    # ── Length scoring ──
    if body_len < 100:
        score -= 30
        reasons.append(f"Very short: {body_len} chars")
    elif body_len < 500:
        score += 10
        reasons.append(f"Short: {body_len} chars")
    elif body_len < 5000:
        score += 30
    else:
        score += 40

    # ── Structure scoring ──
    paragraphs = [p for p in body.split("\n\n") if len(p.strip()) > 20]
    if len(paragraphs) >= 5:
        score += 20
    elif len(paragraphs) >= 2:
        score += 10

    # Link density: too many links = likely navigation
    link_count = len(re.findall(r'https?://', body))
    if len(paragraphs) > 0:
        link_ratio = link_count / max(len(paragraphs), 1)
        if link_ratio > 3:
            penalty += 30
            reasons.append(f"Link farm: {link_count} links / {len(paragraphs)} paragraphs")
        elif link_ratio > 1:
            penalty += 10

    # ── Combine ──
    score = max(0, min(100, 50 + score + reward - penalty))

    if score >= 70:
        grade = "A"
    elif score >= 50:
        grade = "B"
    elif score >= 30:
        grade = "C"
    else:
        grade = "D (skip)"

    return round(score, 1), grade, reasons


# ── Entity detection ────────────────────────────────────────────────────────
# Common entity patterns for auto-detection
_ENTITY_PATTERNS: list[tuple[str, str]] = [
    # Chinese company/organization names (2-8 chars ending in 公司/集团/银行/证券/基金/科技/网络)
    (r"([\u4e00-\u9fff]{2,8}(?:公司|集团|银行|证券|基金|科技|网络|保险|通信|能源|汽车|医药|地产|控股|股份|有限|技术|数据|智能|互联))", "organization"),
    # English company names
    (r"\b(OpenAI|Google|Microsoft|Apple|Meta|Amazon|Tesla|NVIDIA|Anthropic|DeepMind|ByteDance|Alibaba|Tencent|Baidu|Huawei|Xiaomi|Bun|Deno|Vercel|Cloudflare|Databricks|Snowflake|Palantir|Anduril|SpaceX)\b", "organization"),
    # Stock codes (A-share 6 digits)
    (r"\b(\d{6}\.(?:SZ|SH|BJ))\b", "stock_code"),
    # Chinese stock names with code
    (r"([\u4e00-\u9fff]{2,6}(?:科技|股份|集团|控股|电子|医药|能源|汽车|银行|证券|保险|地产|通信|传媒|食品|饮料|家电|军工|化工|钢铁|有色|建材|农林|纺织|商业|旅游|环保|电力|燃气|水务|交通|物流|软件|硬件|半导体|光伏|锂电|风电|储能|氢能|生物|基因|医疗|器械|中药|创新药|疫苗|检测|试剂))", "organization"),
    # Technical terms / concepts (CapitalCase 2-5 words)
    (r"\b([A-Z][a-z]+(?:[A-Z][a-z]+){1,4})\b", "concept"),
    # Chinese technical concepts (with 大/微/多/超 prefix)
    (r"([大微多超][\u4e00-\u9fff]{2,6}(?:模型|系统|架构|平台|引擎|框架|算法|网络|协议|策略|方法|理论|定律|效应|原理|机制))", "concept"),
    # Well-known frameworks/tools
    (r"\b(React|Vue|Angular|Svelte|Next\.js|Nuxt|SvelteKit|Django|Flask|FastAPI|Spring|Rails|Laravel|PyTorch|TensorFlow|Keras|JAX|LLaMA|GPT|BERT|Transformer|Diffusion|GAN|RNN|LSTM|CNN|ResNet|ViT)\b", "technology"),
    # Chinese tech terms
    (r"([\u4e00-\u9fff]{2,6}(?:算法|模型|系统|平台|框架|引擎|架构|协议|网络|数据库|中间件|编译器|解释器|虚拟机|容器|集群|网关|代理|缓存|队列|调度|编排))", "concept"),
]


def _detect_entities(
    text: str, page_index: WikiPageIndex,
) -> list[dict[str, str]]:
    """Detect entities in text and cross-reference with wiki page index.

    Uses both regex patterns and the full wiki page index for matching.
    Returns list of {name, type, wikilink, existing, matched_page}.
    """
    entities: list[dict[str, str]] = []
    seen: set[str] = set()

    # Phase 1: Regex-based detection (catches well-known patterns)
    for pattern, etype in _ENTITY_PATTERNS:
        for match in re.finditer(pattern, text):
            name = match.group(1).strip()
            if not name or len(name) < 2:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)

            # Check against wiki index
            entry = page_index.lookup(name)
            wikilink = f"[[{entry.title}]]" if entry else f"[[{name}]]"
            entities.append({
                "name": name,
                "type": etype if not entry else entry.page_type,
                "wikilink": wikilink,
                "existing": entry is not None,
                "matched_page": entry.stem if entry else "",
            })

    # Phase 2: Full wiki page index scan for title mentions
    # (catches entities that regex patterns miss, like Apple, Tesla, etc.)
    body_lower = text.lower()
    for stem, entry in page_index._entries.items():
        title_lower = entry.title.lower()
        # Only match if title is substantive (3+ chars) and appears in text
        if len(entry.title) >= 3 and title_lower in body_lower:
            key = entry.title.lower()
            if key in seen:
                continue
            # Avoid matching common words
            if entry.title.lower() in {"the", "and", "for", "not", "are", "but", "all", "can", "new", "one", "two",
                                        "的", "是", "在", "有", "和", "了", "不", "人", "我", "他", "她", "它",
                                        "这", "那", "就", "也", "都", "要", "会", "能", "可", "对", "用", "与"}:
                continue
            seen.add(key)
            wikilink = f"[[{entry.title}]]"
            entities.append({
                "name": entry.title,
                "type": entry.page_type,
                "wikilink": wikilink,
                "existing": True,
                "matched_page": entry.stem,
            })

    # Deduplicate by matched_page
    deduped: list[dict[str, str]] = []
    seen_stems: set[str] = set()
    for e in entities:
        stem_key = e.get("matched_page", e["name"].lower())
        if stem_key not in seen_stems:
            seen_stems.add(stem_key)
            deduped.append(e)

    return deduped


# ── Content fingerprinting ──────────────────────────────────────────────────
def _content_fingerprint(text: str) -> str:
    """128-bit fingerprint of normalized content for near-duplicate detection."""
    normalized = re.sub(r"\s+", " ", text.lower())[:2048].strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]


# ── Summary generation ──────────────────────────────────────────────────────
def _generate_summary(body: str, max_chars: int = 300) -> str:
    """Extract the most representative sentences as a summary."""
    # Split into sentences
    sentences = re.split(r"(?<=[。！？.!?])\s*", body)
    candidates: list[tuple[str, float]] = []

    for s in sentences:
        s = s.strip()
        if len(s) < 20 or len(s) > 200:
            continue
        if s.startswith("#") or s.startswith("[") or s.startswith("http"):
            continue

        # Score sentence by informativeness
        score = 0.0
        # Prefer sentences with substantive words
        score += len(re.findall(r"[\u4e00-\u9fff]", s)) * 0.5  # Chinese chars
        score += len(re.findall(r"[A-Z][a-z]{3,}", s)) * 0.5  # English words
        # Prefer sentences with numbers (data-rich)
        score += len(re.findall(r"\d+", s)) * 0.3
        # Penalize very short
        if len(s) < 30:
            score *= 0.5
        candidates.append((s, score))

    # Sort by score, take top sentences
    candidates.sort(key=lambda x: -x[1])
    top = [c[0] for c in candidates[:4]]

    summary = " ".join(top)
    if len(summary) > max_chars:
        summary = summary[:max_chars - 3] + "..."
    return summary or "No summary could be generated."


# ── Key claims extraction ───────────────────────────────────────────────────
def _extract_key_claims(body: str) -> list[str]:
    """Extract claim-like sentences from body text."""
    claims: list[str] = []

    # First try: bullet points
    bullets = re.findall(r"^[-*]\s+(.{30,200})$", body, re.MULTILINE)
    if bullets:
        return [b.strip() for b in bullets[:10]]

    # Second: sentences with claim indicators
    claim_words_en = [
        "is a", "are a", "provides", "supports", "enables", "allows",
        "uses", "based on", "built", "designed", "implements", "consists",
        "features", "includes", "offers", "delivers", "achieves",
        "introduces", "proposes", "demonstrates", "shows", "reveals",
    ]
    claim_words_cn = [
        "是", "提供", "支持", "实现", "基于", "使用", "采用",
        "集成", "包括", "涵盖", "具备", "拥有", "达到", "突破",
        "推出", "发布", "宣布", "表示", "认为", "指出", "强调",
        "核心", "关键", "重要", "主要", "最大", "首次",
    ]

    sentences = re.split(r"(?<=[。！？.!?])\s*", body)
    for s in sentences:
        s = s.strip()
        if len(s) < 30 or len(s) > 250:
            continue
        s_lower = s.lower()
        if any(w in s_lower for w in claim_words_en) or any(w in s for w in claim_words_cn):
            claims.append(s)
            if len(claims) >= 8:
                break

    return claims


# ── Source page builder ─────────────────────────────────────────────────────
def _build_source_page(
    fm: dict[str, str], body: str,
    entities: list[dict[str, str]],
    quality: tuple[float, str, list[str]],
) -> str:
    title = fm.get("title", "Untitled").replace('"', '\\"')
    source_url = fm.get("source_url", "")
    source_type = fm.get("source_type", "web")
    tags = fm.get("tags", source_type)
    fetched_at = fm.get("fetched_at", datetime.now(timezone.utc).isoformat())
    author = fm.get("author", "")
    sitename = fm.get("sitename", "")
    published = fm.get("published", fm.get("date", ""))
    extractor = fm.get("extractor", "auto")

    q_score, q_grade, q_reasons = quality

    # Clean body
    cleaned_body = body
    if cleaned_body.startswith("## Summary"):
        cleaned_body = re.sub(r"^## Summary\s*\n*", "", cleaned_body, count=1).strip()

    # Generate summary
    summary = _generate_summary(cleaned_body)

    # Extract key claims
    claims = _extract_key_claims(cleaned_body)

    lines: list[str] = []

    # ── Frontmatter ──
    yaml_pairs = [
        f'title: "{title}"',
        "type: source",
        f"tags: [{tags}]",
        f"date: {fetched_at[:10]}",
    ]
    if source_url:
        yaml_pairs.append(f'source_url: "{source_url}"')
    if author:
        yaml_pairs.append(f'author: "{author}"')
    if sitename:
        yaml_pairs.append(f'sitename: "{sitename}"')
    if published:
        yaml_pairs.append(f'published: "{published}"')
    yaml_pairs.append(f"quality_score: {q_score}")
    yaml_pairs.append(f"extractor: \"{extractor}\"")

    lines.append("---")
    lines.extend(yaml_pairs)
    lines.append("---\n")

    # ── Summary ──
    lines.append("## Summary\n")
    lines.append(summary)
    lines.append("")

    # ── Key Claims ──
    lines.append("## Key Claims\n")
    if claims:
        for claim in claims:
            lines.append(f"- {claim}")
    else:
        lines.append(f"- Auto-ingested {source_type} content from {sitename or source_url}.")
    lines.append("")

    # ── Entities Detected ──
    if entities:
        lines.append("## Detected Entities\n")
        existing_entities = [e for e in entities if e["existing"]]
        new_entities = [e for e in entities if not e["existing"]]
        if existing_entities:
            lines.append("### Linked to existing wiki pages\n")
            for e in existing_entities[:15]:
                lines.append(f"- {e['wikilink']} ({e['type']})")
            lines.append("")
        if new_entities:
            lines.append("### Suggested new pages\n")
            for e in new_entities[:10]:
                lines.append(f"- {e['wikilink']} ({e['type']}) — {e['name']}")
            lines.append("")

    # ── Connections ──
    lines.append("## Connections\n")
    if source_url:
        lines.append(f"- Source: {source_url}")
    if sitename:
        lines.append(f"- Site: {sitename}")

    # Group existing entities by type for better organization
    existing_by_type: dict[str, list[str]] = {}
    for e in entities:
        if e["existing"]:
            existing_by_type.setdefault(e["type"], []).append(e["wikilink"])

    if existing_by_type:
        for etype, links in sorted(existing_by_type.items()):
            unique_links = list(dict.fromkeys(links))[:6]  # dedup, cap at 6
            lines.append(f"- {etype.title()}s: {' · '.join(unique_links)}")

    # Suggest new entities as connection opportunities
    new_entities = [e for e in entities if not e["existing"]]
    if new_entities:
        new_names = [e["name"] for e in new_entities[:8]]
        lines.append(f"- Suggested pages: {', '.join(new_names)}")
    lines.append("")

    # ── Full Content ──
    lines.append("## Full Content\n")
    lines.append(cleaned_body)
    lines.append("")

    # ── Quality Assessment ──
    lines.append("## Quality Assessment\n")
    lines.append(f"- Score: {q_score}/100 (Grade: {q_grade})")
    lines.append(f"- Reasons: {'; '.join(q_reasons) if q_reasons else 'Standard quality'}")
    lines.append("")

    # ── Contradictions ──
    lines.append("## Contradictions\n")
    lines.append("None detected (auto-ingested).")

    return "\n".join(lines)


# ── Index / Log ─────────────────────────────────────────────────────────────
def _update_index(source_title: str, source_slug: str, summary: str) -> bool:
    """Add source entry to wiki/index.md. Returns True if added."""
    content = INDEX_PATH.read_text(encoding="utf-8") if INDEX_PATH.exists() else ""
    short_summary = (summary[:80] + "...") if len(summary) > 80 else summary
    entry_line = f"- [{source_title}](sources/{source_slug}.md) — {short_summary}\n"

    # Check if already exists
    if f"(sources/{source_slug}.md)" in content:
        return False

    sources_marker = "## Sources\n"
    if sources_marker in content:
        idx = content.index(sources_marker) + len(sources_marker)
        # Insert as first entry after the header
        content = content[:idx] + entry_line + content[idx:]
    else:
        # Find Entities section to insert before
        entities_marker = "\n## Entities\n"
        if entities_marker in content:
            idx = content.index(entities_marker)
            content = content[:idx] + f"\n## Sources\n{entry_line}" + content[idx:]
        else:
            content += f"\n## Sources\n{entry_line}"

    _atomic_write(INDEX_PATH, content)
    return True


def _update_log(title: str, source_slug: str, quality_grade: str) -> None:
    """Append to wiki/log.md."""
    today = datetime.now().strftime("%Y-%m-%d")
    entry = (
        f'\n## [{today}] auto-ingest | {title}\n\n'
        f'Auto-ingested from fetched content → [[{title}|sources/{source_slug}]]. '
        f'Quality: {quality_grade}.\n'
    )

    if LOG_PATH.exists():
        content = LOG_PATH.read_text(encoding="utf-8")
        parts = content.split("---", 2)
        if len(parts) >= 3:
            content = parts[0] + "---" + parts[1] + "---" + entry + parts[2]
        else:
            content += entry
    else:
        content = f"# Wiki Log\n\n> Append-only chronological record.\n\n---\n{entry}"

    _atomic_write(LOG_PATH, content)


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, str(path))
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# ── Wiki page index ─────────────────────────────────────────────────────────
@dataclass
class WikiPageEntry:
    """Lightweight representation of a wiki page for entity matching."""
    stem: str
    title: str
    page_type: str
    tags: list[str]
    wikilinks: list[str]  # [[wikilinks]] referenced by this page
    path: str


class WikiPageIndex:
    """In-memory index of all wiki pages for fast entity lookup.

    Builds a multi-key index: stem, title, tags, and wikilink targets
    are all searchable. Supports fuzzy matching via prefix/substring.
    """

    def __init__(self, wiki_dir: Path):
        self._entries: dict[str, WikiPageEntry] = {}  # stem → entry
        self._title_index: dict[str, str] = {}  # normalized title → stem
        self._stem_lower: dict[str, str] = {}  # lowercase stem → original stem
        self._tag_index: dict[str, set[str]] = {}  # tag → {stems}
        self._build(wiki_dir)

    def _build(self, wiki_dir: Path) -> None:
        """Scan all wiki subdirectories and build the index."""
        for subdir_name in ["sources", "entities", "concepts"]:
            subdir = wiki_dir / subdir_name
            if not subdir.exists():
                continue
            for f in subdir.glob("*.md"):
                try:
                    text = f.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                fm, _ = _parse_frontmatter(text)
                title = fm.get("title", f.stem)
                page_type = fm.get("type", subdir_name.rstrip("s"))
                tags_str = fm.get("tags", "")
                tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []

                # Extract wikilinks from body
                wikilinks = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", text)

                entry = WikiPageEntry(
                    stem=f.stem,
                    title=title,
                    page_type=page_type,
                    tags=tags,
                    wikilinks=wikilinks,
                    path=str(f.relative_to(wiki_dir.parent).as_posix()),
                )
                self._entries[f.stem] = entry

                # Title index
                self._title_index[self._norm(title)] = f.stem
                # Also index stem as title alias
                self._title_index[self._norm(f.stem)] = f.stem

                # Stem lowercase index
                self._stem_lower[f.stem.lower()] = f.stem
                self._stem_lower[f.stem.lower().replace("-", "").replace("_", "")] = f.stem

                # Tag index
                for tag in tags:
                    self._tag_index.setdefault(tag.lower(), set()).add(f.stem)

    @staticmethod
    def _norm(s: str) -> str:
        """Normalize a string for comparison: lowercase, strip spaces/punctuation."""
        return re.sub(r"[^\w\u4e00-\u9fff]", "", s.lower())

    def lookup(self, name: str) -> WikiPageEntry | None:
        """Find a wiki page by name, title, or stem. Returns None if not found."""
        n = self._norm(name)
        # Direct title match
        stem = self._title_index.get(n)
        if stem and stem in self._entries:
            return self._entries[stem]
        # Stem match (case-insensitive)
        stem = self._stem_lower.get(name.lower())
        if stem and stem in self._entries:
            return self._entries[stem]
        stem = self._stem_lower.get(name.lower().replace(" ", ""))
        if stem and stem in self._entries:
            return self._entries[stem]
        # Substring match in titles
        for title_norm, s in self._title_index.items():
            if n in title_norm or title_norm in n:
                if s in self._entries:
                    return self._entries[s]
        return None

    def lookup_by_tag(self, tag: str) -> list[WikiPageEntry]:
        """Find pages by tag."""
        stems = self._tag_index.get(tag.lower(), set())
        return [self._entries[s] for s in stems if s in self._entries]

    def get_all_stems(self) -> set[str]:
        return set(self._entries.keys())

    def get_related(self, stem: str) -> list[WikiPageEntry]:
        """Get pages that link to the given page (reverse wikilinks)."""
        related: list[WikiPageEntry] = []
        for entry in self._entries.values():
            if stem in entry.wikilinks or any(
                self._norm(wl) == self._norm(stem) for wl in entry.wikilinks
            ):
                related.append(entry)
        return related

    def fuzzy_search(self, name: str, threshold: float = 0.6) -> list[tuple[WikiPageEntry, float]]:
        """Fuzzy search for pages by title or stem. Returns (entry, score)."""
        n = self._norm(name)
        results: list[tuple[WikiPageEntry, float]] = []
        for entry in self._entries.values():
            title_n = self._norm(entry.title)
            stem_n = self._norm(entry.stem)
            score = 0.0
            # Exact substring match
            if n in title_n or title_n in n:
                score = 0.9
            elif n in stem_n or stem_n in n:
                score = 0.8
            else:
                # Simple Jaccard on character bigrams
                a_bigrams = {n[i:i+2] for i in range(len(n)-1)}
                b_bigrams = {title_n[i:i+2] for i in range(len(title_n)-1)}
                if a_bigrams and b_bigrams:
                    intersection = a_bigrams & b_bigrams
                    union = a_bigrams | b_bigrams
                    score = len(intersection) / len(union) if union else 0.0
            if score >= threshold:
                results.append((entry, score))
        results.sort(key=lambda x: -x[1])
        return results

    def __len__(self) -> int:
        return len(self._entries)


def _load_existing_page_names() -> set[str]:
    """Deprecated: kept for backward compat. Use WikiPageIndex instead."""
    names: set[str] = set()
    for subdir in [SOURCES_DIR, ENTITIES_DIR, CONCEPTS_DIR]:
        if not subdir.exists():
            continue
        for f in subdir.glob("*.md"):
            names.add(f.stem)
    return names


# ── File discovery ──────────────────────────────────────────────────────────
def _find_fetched_files(source_filter: str | None = None) -> list[Path]:
    if not FETCHED_DIR.exists():
        return []
    files: list[Path] = []
    for subdir in sorted(FETCHED_DIR.iterdir()):
        if not subdir.is_dir():
            continue
        if source_filter and subdir.name != source_filter:
            continue
        files.extend(sorted(subdir.glob("*.md")))
    return files


# ── Main logic ──────────────────────────────────────────────────────────────
def run(
    source_filter: str | None = None,
    single_file: Path | None = None,
    dry_run: bool = False,
    min_quality: float = 0,
    verbose: bool = False,
) -> int:
    state = _load_state()
    auto_ingested = set(state.get("auto_ingested", []))
    auto_ingested_urls = set(state.get("auto_ingested_urls", []))
    # Build full wiki page index for smart entity matching
    page_index = WikiPageIndex(WIKI_DIR)
    existing_page_stems = page_index.get_all_stems()

    if single_file:
        files = [single_file]
    else:
        files = _find_fetched_files(source_filter)

    new_files = [
        f for f in files
        if str(f.relative_to(REPO_ROOT).as_posix()) not in auto_ingested
    ]

    if not new_files:
        print("No new fetched files to auto-ingest.")
        return 0

    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    ENTITIES_DIR.mkdir(parents=True, exist_ok=True)

    # Lazy-init search engine for FTS indexing
    _search_engine = None

    def _get_search_engine():
        nonlocal _search_engine
        if _search_engine is None:
            from tools.search_engine import WikiSearchEngine
            _search_engine = WikiSearchEngine()
            # Mark stale so it picks up new pages
            _search_engine.check_stale()
        return _search_engine

    stats: dict[str, Any] = {
        "total": len(new_files),
        "success": 0, "skipped": 0, "quality_blocked": 0,
        "duplicate_content": 0, "grades": Counter(),
        "entities_found": 0,
    }
    content_fingerprints: set[str] = set()
    index_updated = False
    log_updated = 0
    entities_created = 0
    pages_for_graph: list[Path] = []  # Track pages for batch graph rebuild

    def _create_entity_stub(entity_name: str, entity_type: str, source_page: str) -> bool:
        """Create a minimal entity page stub if it doesn't exist."""
        slug = _slugify(entity_name)
        ent_path = ENTITIES_DIR / f"{slug}.md"
        if ent_path.exists():
            return False
        today = datetime.now().strftime("%Y-%m-%d")
        stub = (
            f"---\n"
            f'title: "{entity_name}"\n'
            f"type: entity\n"
            f"tags: [auto-ingested]\n"
            f"date: {today}\n"
            f'source: "{source_page}"\n'
            f"---\n\n"
            f"## Summary\n\n"
            f"Auto-detected entity from [[{source_page}]].\n\n"
            f"## Connections\n\n"
            f"- Auto-detected during ingestion of [[{source_page}]]\n"
        )
        ent_path.write_text(stub, encoding="utf-8")
        # Register in page_index for subsequent batch lookups
        new_entry = WikiPageEntry(
            stem=slug, title=entity_name, page_type="entity",
            tags=["auto-ingested"], wikilinks=[], path=f"wiki/entities/{slug}.md",
        )
        page_index._entries[slug] = new_entry
        page_index._title_index[page_index._norm(entity_name)] = slug
        page_index._stem_lower[slug.lower()] = slug
        # Add to index
        index_content = INDEX_PATH.read_text(encoding="utf-8") if INDEX_PATH.exists() else ""
        entity_entry = f"- [{entity_name}](entities/{slug}.md) — auto-detected entity\n"
        entities_marker = "## Entities\n"
        if entities_marker in index_content:
            idx = index_content.index(entities_marker) + len(entities_marker)
            index_content = index_content[:idx] + entity_entry + index_content[idx:]
        else:
            index_content += f"\n## Entities\n{entity_entry}"
        _atomic_write(INDEX_PATH, index_content)
        return True

    def _trigger_graph_rebuild() -> bool:
        """Trigger a background graph rebuild. Returns True if launched."""
        import subprocess
        try:
            subprocess.Popen(
                [sys.executable, str(REPO_ROOT / "tools" / "build_graph.py")],
                cwd=str(REPO_ROOT),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return True
        except Exception:
            return False

    print(f"Processing {len(new_files)} file(s)...\n")

    for f in new_files:
        try:
            text = f.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  [SKIP] Cannot read {f.name}: {e}")
            stats["skipped"] += 1
            continue

        fm, body = _parse_frontmatter(text)
        title = fm.get("title", "Untitled")
        source_url = fm.get("source_url", "")

        if len(body) < 50:
            print(f"  [SKIP] Body too short ({len(body)} chars): {f.name}")
            stats["skipped"] += 1
            continue

        # URL dedup
        if source_url and source_url in auto_ingested_urls:
            print(f"  [SKIP] URL already auto-ingested: {source_url}")
            stats["skipped"] += 1
            continue

        # Content fingerprint dedup
        fp = _content_fingerprint(body)
        if fp in content_fingerprints:
            print(f"  [SKIP] Near-duplicate content: {f.name}")
            stats["duplicate_content"] += 1
            continue
        content_fingerprints.add(fp)

        # Quality scoring
        q_score, q_grade, q_reasons = _score_quality(title, body)
        if q_score < min_quality:
            print(f"  [SKIP] Quality {q_score}/100 below threshold {min_quality}: {f.name}")
            stats["quality_blocked"] += 1
            continue

        if q_grade == "D (skip)":
            print(f"  [SKIP] Noise detected (grade D): {f.name}")
            if verbose:
                for r in q_reasons:
                    print(f"         {r}")
            stats["quality_blocked"] += 1
            continue

        stats["grades"][q_grade] += 1

        # Entity detection using wiki page index
        entities = _detect_entities(body, page_index)

        if dry_run:
            slug = _slugify(title)
            entity_hint = f" [{len(entities)} entities]" if entities else ""
            print(f"  [DRY] {f.name} -> wiki/sources/{slug}.md [Q={q_grade}:{q_score}]{entity_hint}")
            if verbose and q_reasons:
                for r in q_reasons:
                    print(f"        {r}")
            stats["success"] += 1
            continue

        # Build and write
        source_page = _build_source_page(fm, body, entities, (q_score, q_grade, q_reasons))
        out_path = _safe_source_path(title)
        out_path.write_text(source_page, encoding="utf-8")

        entity_str = f" [{len(entities)} entities]" if entities else ""
        print(f"  [OK] {f.name} -> {out_path.name} [Q={q_grade}:{q_score}]{entity_str}")
        if verbose and q_reasons:
            for r in q_reasons:
                print(f"       {r}")

        # Update index
        slug = out_path.stem
        description = fm.get("description", "")
        summary_text = description or _generate_summary(body)
        if _update_index(title, slug, summary_text):
            index_updated = True

        # Update log
        _update_log(title, slug, q_grade)
        log_updated += 1

        # Track
        rel = str(f.relative_to(REPO_ROOT).as_posix())
        auto_ingested.add(rel)
        if source_url:
            auto_ingested_urls.add(source_url)

        # ── FTS5 indexing: add new page to search index ──
        try:
            se = _get_search_engine()
            wiki_rel_path = str(out_path.relative_to(REPO_ROOT).as_posix())
            se.update_page(wiki_rel_path, source_page)
        except Exception as e:
            if verbose:
                print(f"       [WARN] FTS index update failed: {e}")

        # ── Entity stub creation: create pages for new entities ──
        new_entities = [e for e in entities if not e["existing"]]
        for ent in new_entities[:10]:  # Cap at 10 per page to avoid spam
            if _create_entity_stub(ent["name"], ent["type"], out_path.stem):
                entities_created += 1
                if verbose:
                    print(f"       [ENTITY] Created: {ent['name']} ({ent['type']})")

        pages_for_graph.append(out_path)
        stats["success"] += 1
        stats["entities_found"] += len(entities)

    # ── Post-batch: trigger graph rebuild if any pages were ingested ──
    if pages_for_graph and not dry_run:
        print(f"\nTriggering knowledge graph rebuild for {len(pages_for_graph)} new page(s)...")
        graph_ok = _trigger_graph_rebuild()
        if graph_ok:
            print("  [OK] Graph rebuild launched in background")
        else:
            print("  [WARN] Graph rebuild failed to start")

    # Persist state
    state["auto_ingested"] = sorted(auto_ingested)
    state["auto_ingested_urls"] = sorted(auto_ingested_urls)
    state.setdefault("last_runs", {})["auto_ingest"] = datetime.now(timezone.utc).isoformat()
    if not dry_run:
        _save_state(state)

    # Summary
    print(f"\n{'='*60}")
    print(f"Auto-ingest complete:")
    print(f"  Total files:     {stats['total']}")
    print(f"  Success:         {stats['success']}")
    print(f"  Skipped:         {stats['skipped']}")
    print(f"  Quality blocked: {stats['quality_blocked']}")
    print(f"  Duplicates:      {stats['duplicate_content']}")
    print(f"  Entities found:  {stats['entities_found']}")
    print(f"  Entity stubs:    {entities_created}")
    if stats["grades"]:
        grade_str = ", ".join(f"{g}:{c}" for g, c in sorted(stats["grades"].items()))
        print(f"  Quality grades:  {grade_str}")
    print(f"  Graph rebuild:   {'triggered' if pages_for_graph else 'skipped'}")
    print(f"{'='*60}")

    return 0


# ── CLI ─────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Auto-ingest fetched .md files directly into wiki/sources/"
    )
    parser.add_argument("--source", help="Filter by source type subdir (e.g. web, rss, arxiv)")
    parser.add_argument("--file", type=Path, help="Auto-ingest a single fetched file")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--min-quality", type=float, default=0,
                        help="Minimum quality score 0-100 (default: 0, no filter)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Show detailed quality scores and entity info")
    args = parser.parse_args()
    return run(
        source_filter=args.source, single_file=args.file,
        dry_run=args.dry_run, min_quality=args.min_quality,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    sys.exit(main())
