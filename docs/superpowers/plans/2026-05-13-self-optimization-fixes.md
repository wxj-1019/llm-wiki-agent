# Self-Optimization System Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken self-update/self-optimization pipeline: stop MEMORY.md infinite duplication, close the reflection feedback loop, integrate all optimization steps into the scheduler, unify LLM configs, enable quality thresholds.

**Architecture:** Four layers of fixes — (1) reflect.py dedup to stop memory rot, (2) scheduler integration to run reflect/lint/heal/self_optimize automatically, (3) config unification across heal.py and auto_ingest.py, (4) cross-step data flow so lint results drive heal automatically.

**Tech Stack:** Python 3.10+, re/hashlib for dedup, existing litellm for LLM calls, schedule library for cron.

---

### Pre-flight: Current State

```
MEMORY.md:         193 lines, ~130 lines of duplicated content  ← BROKEN
optimize_history:  file does not exist                          ← NEVER RUN
scheduler weekly:  only archive + health + graph                ← MISSING lint/heal/reflect
auto_ingest:       min_quality defaults to 0                    ← DISABLED
heal LLM config:   hardcoded anthropic/claude-3-5-haiku-latest  ← INCONSISTENT
```

---

### Task 1: Fix reflect.py — Semantic Deduplication in merge_memory_section

**Files:**
- Modify: `tools/reflect.py:184-238`

**Problem:** `merge_memory_section()` appends new content to existing section body without checking if semantically identical content already exists. LLM outputs nearly identical text every run, causing the same "新来源 ingest 后需更新 overview.md" to appear 20+ times.

**Solution:** Before appending, extract key phrases from new_content, check if they already exist in the section body using normalized comparison (lowercase, strip punctuation). If ≥75% of key phrases already exist, skip the append.

- [ ] **Step 1: Add semantic dedup helper**

Add these two functions to `tools/reflect.py` after the existing `merge_memory_section` function (around line 201):

```python
def _extract_key_phrases(text: str, min_len: int = 8) -> set[str]:
    """Extract normalized key phrases for dedup comparison."""
    import re as _re
    # Split on Chinese/English punctuation and line breaks
    phrases = _re.split(r"[；;。，,、\n•\-]", text)
    result: set[str] = set()
    for p in phrases:
        p = _re.sub(r"[^\w\u4e00-\u9fff]", "", p).strip().lower()
        if len(p) >= min_len:
            result.add(p)
    return result


def _is_duplicate_content(existing_section: str, new_content: str, threshold: float = 0.6) -> bool:
    """Check if new_content is semantically duplicated in existing_section.
    
    Returns True if enough key phrases from new_content already exist
    in existing_section (Jaccard similarity >= threshold).
    """
    new_phrases = _extract_key_phrases(new_content)
    if not new_phrases:
        return False
    existing_phrases = _extract_key_phrases(existing_section)
    if not existing_phrases:
        return False
    intersection = new_phrases & existing_phrases
    # Asymmetric: what % of new phrases already exist
    overlap = len(intersection) / len(new_phrases)
    return overlap >= threshold
```

- [ ] **Step 2: Modify merge_memory_section to use dedup**

Replace the `merge_memory_section` function (lines 184-200) with this version:

```python
def merge_memory_section(
    existing: str, section_name: str, new_content: str
) -> str:
    """Merge new content into a named section, with semantic dedup.
    
    Only appends if the new content isn't already represented.
    Uses key-phrase overlap to detect semantic duplicates.
    """
    pattern = re.compile(
        rf"(## {re.escape(section_name)}\n)(.*?)(?=\n## |\Z)",
        re.DOTALL,
    )
    match = pattern.search(existing)
    if match:
        old_body = match.group(2).strip()
        # Check for semantic duplication
        if old_body and _is_duplicate_content(old_body, new_content):
            # Content already exists — skip append, return unchanged
            return existing
        # Not a duplicate — merge
        if old_body:
            merged = old_body.rstrip() + "\n- " + new_content.lstrip("- ")
        else:
            merged = "- " + new_content.lstrip("- ")
        return existing[: match.start(2)] + merged + "\n" + existing[match.end(2):]
    else:
        # Section doesn't exist yet — create it
        return existing.rstrip() + f"\n\n## {section_name}\n- {new_content}\n"
```

- [ ] **Step 3: Add MEMORY.md size guard**

Add after `merge_memory_section` (after new dedup version):

```python
MEMORY_MAX_CHARS = 2200


def _trim_memory_if_needed(memory_text: str) -> str:
    """If MEMORY.md exceeds MEMORY_MAX_CHARS, truncate oldest entries."""
    if len(memory_text) <= MEMORY_MAX_CHARS:
        return memory_text
    
    # Strategy: keep frontmatter + first 2 sections intact,
    # trim the Operation Log to last 5 entries
    lines = memory_text.split("\n")
    frontmatter_end = 0
    in_frontmatter = False
    for i, line in enumerate(lines):
        if line.strip() == "---":
            if not in_frontmatter:
                in_frontmatter = True
            else:
                frontmatter_end = i + 1
                break
    
    header = "\n".join(lines[:frontmatter_end])
    body = "\n".join(lines[frontmatter_end:])
    
    # If still too large, trim body proportionally
    while len(header) + len(body) > MEMORY_MAX_CHARS and len(body) > 200:
        # Remove oldest Operation Log entry
        op_log_marker = "## Operation Log"
        op_log_idx = body.find(op_log_marker)
        if op_log_idx >= 0:
            after_header = body[op_log_idx + len(op_log_marker):]
            entries = [e for e in after_header.strip().split("\n- [") if e.strip()]
            if len(entries) > 5:
                # Keep only last 5 entries
                kept = "\n- [" + "\n- [".join(entries[-5:])
                body = body[:op_log_idx + len(op_log_marker)] + kept
                continue
        # Fallback: cut body by 30%
        cut = int(len(body) * 0.7)
        body = body[:cut] + "\n\n> ... (older entries trimmed for token budget)\n"
        break
    
    return header + body
```

- [ ] **Step 4: Wire trim into update_memory_file**

Modify `update_memory_file` (around line 237), add one line before the return:

```python
    # After the frontmatter update, before returning:
    existing = _trim_memory_if_needed(existing)
    
    return existing
```

Insert this before the `return existing` at the end of `update_memory_file`.

- [ ] **Step 5: Clean up existing MEMORY.md**

```bash
python -c "
import re
from pathlib import Path
content = Path('wiki/.agent/MEMORY.md').read_text(encoding='utf-8')
# Remove all duplicate entries in Knowledge Organization Experience section
# Keep only unique bullet points
sections = re.split(r'(?=^## )', content, flags=re.MULTILINE)
new_sections = []
seen = set()
for sec in sections:
    if sec.startswith('## Knowledge Organization Experience'):
        lines = sec.split('\n')
        header = lines[0]
        bullets = []
        for line in lines[1:]:
            stripped = line.strip().lstrip('- ')
            norm = re.sub(r'[^\w\u4e00-\u9fff]', '', stripped).lower()
            if norm and norm not in seen and len(stripped) > 3:
                seen.add(norm)
                bullets.append(line)
        new_sections.append('\n'.join([header] + bullets))
    elif sec.startswith('## Operation Log'):
        lines = sec.split('\n')
        header = lines[0]
        log_entries = []
        log_seen = set()
        for line in lines[1:]:
            stripped = line.strip().lstrip('- ')
            if '[' in stripped:
                date_part = re.findall(r'\[\d{4}-\d{2}-\d{2}\]', stripped)
                key = '|'.join(date_part) if date_part else stripped
                if key not in log_seen and len(stripped) > 5:
                    log_seen.add(key)
                    log_entries.append(line)
        new_sections.append('\n'.join([header] + log_entries[-10:]))
    else:
        new_sections.append(sec)
new_content = '\n'.join(new_sections)
Path('wiki/.agent/MEMORY.md').write_text(new_content, encoding='utf-8')
print(f'Cleaned: {len(content)} -> {len(new_content)} chars')
"
```

Expected: MEMORY.md shrinks from ~193 lines to ~40-50 lines.

- [ ] **Step 6: Verify MEMORY.md dedup**

```bash
python -c "
content = open('wiki/.agent/MEMORY.md', encoding='utf-8').read()
lines = [l for l in content.split('\n') if '新来源 ingest 后需更新' in l]
print(f'Duplicated phrases found: {len(lines)} (should be 1)')
"
```

Expected: `Duplicated phrases found: 1` (only one occurrence per unique phrase).

---

### Task 2: Inject MEMORY.md as System Context into Auto-Ingest

**Files:**
- Modify: `tools/auto_ingest.py` (add MEMORY injection before LLM calls in entity generation)

**Note:** `auto_ingest.py` does not directly call LLM (entity stubs are template-based without LLM). The MEMORY.md is primarily for the agent-based `ingest.py` which is called via subprocess. However, `heal.py` does call LLM — we'll inject MEMORY.md there in Task 6.

For now, verify that `ingest.py` (called as subprocess from scheduler) can access MEMORY.md context. Since `ingest.py` is an external script executed by subprocess, and the AGENTS.md instructions say "the agent reads MEMORY.md", the agent ingesting SHOULD read MEMORY.md as system context. We'll ensure this by adding a reference in the scheduler's maintenance step.

This task is deferred — the real MEMORY.md injection happens at the agent level (AGENTS.md already instructs agents to read wiki/.agent/ context). The scheduler calls tools via subprocess which don't auto-read MEMORY.md — but that's by design (subprocess tools are deterministic, agents handle context).

---

### Task 3: Add reflect + lint + heal + self_optimize to Scheduler

**Files:**
- Modify: `tools/scheduler.py:213-219` (maintenance function)
- Modify: `tools/scheduler.py:254-268` (schedule entries)

- [ ] **Step 1: Add new composite job functions**

Add these functions after the existing `_maintenance` function (around line 219):

```python
def _reflect_and_learn() -> int:
    """Post-ingest reflection: analyze patterns, update MEMORY.md."""
    return _run([PYTHON, "tools/reflect.py", "--last", "10", "--suggest-skills"])


def _lint_check() -> int:
    """Content quality checks: orphans, broken links, missing entities."""
    return _run([PYTHON, "tools/lint.py", "--save"])


def _heal_entities() -> int:
    """Auto-heal missing entity pages."""
    return _run([PYTHON, "tools/heal.py"])


def _self_optimize_full() -> int:
    """Full self-optimization pipeline: health → heal → lint → graph → refresh."""
    return _run([PYTHON, "tools/self_optimize.py", "--auto-fix"])
```

- [ ] **Step 2: Replace _maintenance with expanded version**

Replace the existing `_maintenance` function (lines 213-219):

```python
def _maintenance() -> int:
    """Weekly maintenance — full optimization cycle."""
    results = _run(
        [PYTHON, "tools/archive_stale.py"],
        [PYTHON, "tools/health.py", "--save"],
        [PYTHON, "tools/lint.py", "--save"],
        [PYTHON, "tools/heal.py"],
        [PYTHON, "tools/reflect.py", "--last", "5"],
        [PYTHON, "tools/build_graph.py"],
    )
    return results
```

- [ ] **Step 3: Add wrapped maintenance job**

Add after the existing `maintenance()` function (around line 251):

```python
def self_optimize_daily() -> None:
    """Daily lightweight optimization: heal missing entities."""
    run_job("heal_daily", _heal_entities)
```

- [ ] **Step 4: Update schedule entries**

Replace the schedule section (lines 254-268) with:

```python
# --- Schedule ---
# GitHub trending: every day at 00:00, then auto compile & ingest at 00:30
schedule.every().day.at("00:00").do(fetch_github_and_ingest)

# RSS & arXiv & Web with auto-ingest: every morning
schedule.every().day.at("08:00").do(rss_fetch_and_ingest)
schedule.every().day.at("08:30").do(arxiv_fetch_and_ingest)
schedule.every().day.at("08:45").do(web_fetch_and_ingest)

# Refresh monitor: check for upstream changes twice daily
schedule.every().day.at("14:00").do(monitor_and_refresh_job)
schedule.every().day.at("20:00").do(monitor_and_refresh_job)

# Daily heal: fix missing entity pages (lightweight)
schedule.every().day.at("22:00").do(self_optimize_daily)

# Weekly maintenance: Sunday night full optimization cycle
# Order: archive → health → lint → heal → reflect → graph
schedule.every().sunday.at("23:00").do(maintenance)
```

- [ ] **Step 5: Verify scheduler loads without errors**

```bash
python -c "import tools.scheduler; print('OK: scheduler imports successfully')"
```

---

### Task 4: Enable Quality Threshold in Auto-Ingest & Scheduler

**Files:**
- Modify: `tools/auto_ingest.py:1015` (change default min_quality)
- Modify: `tools/scheduler.py:185-203` (pass min_quality in web/rss/arxiv fetch-and-ingest)

- [ ] **Step 1: Change auto_ingest default min_quality**

In `tools/auto_ingest.py`, change line 1015:

```python
    parser.add_argument("--min-quality", type=float, default=30,
                        help="Minimum quality score 0-100 (default: 30, skip noise)")
```

- [ ] **Step 2: Update scheduler composite functions to pass quality threshold**

Modify `_web_fetch_and_ingest` (line 185):

```python
def _web_fetch_and_ingest() -> int:
    """Fetch web pages, then auto-ingest them directly into wiki/sources/."""
    fetched = fetch_web()
    cmd = [PYTHON, "tools/auto_ingest.py", "--source", "web", "--min-quality", "30"]
    result = subprocess.run(cmd, cwd=str(REPO_ROOT))
    ingested = 1 if result.returncode == 0 else 0
    return fetched + ingested
```

Modify `_rss_fetch_and_ingest` (line 192):

```python
def _rss_fetch_and_ingest() -> int:
    """Fetch RSS feeds, then auto-ingest into wiki/sources/."""
    fetched = fetch_rss()
    cmd = [PYTHON, "tools/auto_ingest.py", "--source", "rss", "--min-quality", "30"]
    result = subprocess.run(cmd, cwd=str(REPO_ROOT))
    ingested = 1 if result.returncode == 0 else 0
    return fetched + ingested
```

Modify `_arxiv_fetch_and_ingest` (line 199):

```python
def _arxiv_fetch_and_ingest() -> int:
    """Fetch arXiv papers, then auto-ingest into wiki/sources/."""
    fetched = fetch_arxiv()
    cmd = [PYTHON, "tools/auto_ingest.py", "--source", "arxiv", "--min-quality", "30"]
    result = subprocess.run(cmd, cwd=str(REPO_ROOT))
    ingested = 1 if result.returncode == 0 else 0
    return fetched + ingested
```

- [ ] **Step 3: Add `import subprocess` at top if not already imported**

Check `scheduler.py` line 18: `import subprocess` is already imported. No change needed.

- [ ] **Step 4: Verify the changes**

```bash
python -c "
from tools.scheduler import _web_fetch_and_ingest, _rss_fetch_and_ingest, _arxiv_fetch_and_ingest
print('OK: scheduler composite functions import successfully')
"
```

---

### Task 5: Unify heal.py LLM Config with shared.llm

**Files:**
- Modify: `tools/heal.py:35-122` (replace inline LLM config with shared.llm import)

- [ ] **Step 1: Replace the entire inline LLM fallback block**

In `tools/heal.py`, the current structure is:
- Lines 35-38: try `from tools.shared.llm import _load_llm_config, call_llm, LLMUnavailableError`
- Lines 38-121: `except ImportError:` fallback with inline implementations

Replace the entire fallback (lines 38-121) with a minimal version that raises clear errors. Replace lines 38-121:

```python
except ImportError:
    # If shared.llm is not available, provide minimal stubs that fail clearly
    class LLMUnavailableError(Exception):
        """LLM is not available — litellm or shared.llm not installed."""
        pass

    def _load_llm_config() -> dict:
        cfg_path = REPO_ROOT / "config" / "llm.yaml"
        defaults = {
            "provider": "anthropic",
            "model": os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest"),
        }
        if cfg_path.exists():
            try:
                import yaml
                data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
                return {**defaults, **data}
            except Exception:
                pass
        return defaults

    def call_llm(prompt: str, **kwargs) -> str:
        try:
            import litellm
        except ImportError as exc:
            raise LLMUnavailableError("litellm not installed. Run: pip install litellm") from exc
        cfg = _load_llm_config()
        model = kwargs.get("model", os.getenv("LLM_MODEL", cfg.get("model", "claude-3-5-sonnet-latest")))
        max_tokens = kwargs.get("max_tokens", 1500)
        resp = litellm.completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content
```

Key changes:
- Removed hardcoded `default_model = "anthropic/claude-3-5-haiku-latest"` — now uses `LLM_MODEL` env or `llm.yaml` config
- Removed manual `provider/` prefix logic — litellm handles this from config
- Simplified retry logic (already handled by litellm internally)
- Removed `model_env`/`default_model` params from the signature since we now use config

- [ ] **Step 2: Update call_llm calls in heal_missing_entities**

In `heal_missing_entities` (around line 257), the call is:
```python
result = call_llm(prompt)
```
This works fine with the new simplified signature (all params have defaults). No change needed.

- [ ] **Step 3: Verify heal.py imports**

```bash
python -c "from tools.heal import call_llm, _load_llm_config; print('OK: heal.py LLM config imports successfully')"
```

---

### Task 6: Self-Optimize Lint→Heal Data Flow

**Files:**
- Modify: `tools/self_optimize.py:83-115` (run_heal to accept lint results)
- Modify: `tools/self_optimize.py:344-359` (main orchestration to pass lint→heal)

- [ ] **Step 1: Make run_heal accept optional lint result**

Modify `run_heal` signature and body (lines 83-115):

```python
def run_heal(health_result: dict, lint_result: dict | None = None, dry_run: bool = True) -> dict:
    """Heal missing entity pages. Optionally driven by lint results."""
    print("\n" + "=" * 50)
    print("Step 2: Heal Missing Pages")
    print("=" * 50)

    result = {"would_create": 0, "created": 0}

    try:
        from tools.heal import heal_missing_entities
        import io
        import contextlib

        # If lint found missing entities, log them before healing
        if lint_result and lint_result.get("missing_entities", 0) > 0:
            print(f"  Lint found {lint_result['missing_entities']} missing entities")
            print(f"  Proceeding with auto-heal...")

        f = io.StringIO()
        try:
            with contextlib.redirect_stdout(f):
                heal_missing_entities(dry_run=dry_run)
            output = f.getvalue()
            print(f"  {'[DRY RUN] ' if dry_run else ''}Heal output:")
            for line in output.strip().split("\n")[:10]:
                print(f"    {line}")
        except SystemExit:
            pass

        _log_step("heal", "success", {"dry_run": dry_run})
    except ImportError:
        print("  [SKIP] heal.py not available")
        _log_step("heal", "skipped", {"reason": "import error"})
    except Exception as e:
        print(f"  [ERROR] Heal failed: {e}")
        _log_step("heal", "error", {"error": str(e)[:200]})

    return result
```

- [ ] **Step 2: Update main() orchestration to pass lint→heal**

In `main()` (around lines 344-359), modify the orchestration:

```python
    health_result = {}
    lint_result = {}

    if scope in ("health", "all"):
        health_result = run_health(dry_run=dry_run)

    if scope in ("lint", "all"):
        lint_result = run_lint(dry_run=dry_run)

    if scope in ("heal", "all"):
        run_heal(health_result, lint_result=lint_result if lint_result else None, dry_run=dry_run)

    if scope in ("graph", "all"):
        run_graph_build(dry_run=dry_run)

    if scope in ("refresh", "all"):
        run_refresh(dry_run=dry_run)
```

Note: the order changes from `health → heal → lint → graph → refresh` to `health → lint → heal → graph → refresh`. This ensures lint results are available when heal runs.

- [ ] **Step 3: Update the docstring at top**

Change the Step order comment (lines 2-3):

```python
"""Self-optimization orchestrator — diagnose → fix → prevent loop.

Pipeline: health → lint → heal → graph → refresh
"""
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run health check**

```bash
python tools/health.py
```

Expected: Passes with no critical errors (may show known stub files).

- [ ] **Step 2: Run self-optimize in dry-run mode**

```bash
python tools/self_optimize.py --dry-run --scope all
```

Expected: All 5 steps execute in order (health → lint → heal → graph → refresh), no import errors.

- [ ] **Step 3: Verify scheduler dry-run**

```bash
python -c "
from tools.scheduler import maintenance, self_optimize_daily
print('Scheduler functions OK')
# Check schedule entries
from tools import scheduler
print(f'Scheduled jobs: {len(scheduler.schedule.jobs)}')
for j in scheduler.schedule.jobs:
    print(f'  {j}')
"
```

Expected: Shows all scheduled jobs including the new `heal_daily` and updated `maintenance`.

- [ ] **Step 4: Verify reflect.py dedup logic**

```bash
python -c "
from tools.reflect import _extract_key_phrases, _is_duplicate_content
# Test: identical content should be detected as dup
body = '新来源 ingest 后需更新 overview.md 的交叉引用；每个来源页面至少包含 Summary、Key Claims、Connections 三个段落'
assert _is_duplicate_content(body, body), 'FAIL: identical content not detected as dup'
# Test: different content should not be dup
assert not _is_duplicate_content(body, '完全不同的内容关于机器学习'), 'FAIL: different content wrongly detected as dup'
print('OK: dedup logic works correctly')
"
```

- [ ] **Step 5: Verify MEMORY.md is clean**

```bash
python -c "
content = open('wiki/.agent/MEMORY.md', encoding='utf-8').read()
# Check no triplicates
from collections import Counter
import re
phrases = re.findall(r'- (.+?)(?:\n|$)', content)
counts = Counter(p.strip() for p in phrases if len(p.strip()) > 10)
dups = {k: v for k, v in counts.items() if v > 1}
if dups:
    print(f'WARN: {len(dups)} duplicate phrases still present')
    for k, v in list(dups.items())[:3]:
        print(f'  ({v}x) {k[:80]}...')
else:
    print('OK: No duplicate phrases in MEMORY.md')
print(f'Total size: {len(content)} chars (limit: 2200)')
"
```

Expected: `OK: No duplicate phrases in MEMORY.md` and size ≤ 2200 chars.

---

### Rollback Plan

If any fix causes issues:
1. `reflect.py` changes: revert `merge_memory_section` to original version
2. `scheduler.py` changes: restore original `_maintenance` and schedule
3. `auto_ingest.py` quality threshold: revert to `default=0`
4. `heal.py` LLM config: restore original fallback block
5. `self_optimize.py` orchestration: revert to original step order

All changes are isolated to their respective files with no cross-file dependencies.

---

### Summary of Changes

| File | Change | Risk |
|------|--------|------|
| `tools/reflect.py` | +2 dedup functions, modified merge, +MEMORY trim | Low — additive |
| `wiki/.agent/MEMORY.md` | Cleanup of duplicates (one-time script) | Low — data cleanup |
| `tools/scheduler.py` | +5 job functions, expanded maintenance, +daily heal | Medium — changes schedule |
| `tools/auto_ingest.py` | default min_quality 0→30 | Low — one-line change |
| `tools/heal.py` | Remove hardcoded model, use shared config | Low — simplifies |
| `tools/self_optimize.py` | Reorder steps (lint before heal), pass lint→heal | Medium — changes flow |
