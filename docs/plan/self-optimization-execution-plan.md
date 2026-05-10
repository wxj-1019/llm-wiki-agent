# LLM Wiki Agent — 自优化功能详细执行方案 v2

> 基于 `self-optimization-plan.md` 深度分析，结合代码库实际状态制定
> 生成日期: 2026-05-10
> 更新日期: 2026-05-10

---

## 一、执行总览

本方案将自优化计划拆分为 **5 个批次、20 个独立任务**，每个任务包含：
- 精确的文件变更列表和修改位置
- 可直接执行的实现规格（函数签名、数据结构、接口定义）
- 明确的验收标准和测试方法
- 前置依赖关系

**核心架构决策：**

| 决策 | 选择 | 理由 |
|------|------|------|
| 指标存储 | `state/metrics.db`（SQLite） | 与 `search.db` 分离，避免耦合；SQLite 无需额外服务 |
| 状态文件 | `state/*.json` | 简单配置/策略用 JSON，高频数据用 SQLite |
| 反馈模式 | 自动诊断 + `--auto-fix` 显式开启 | 安全：默认只报告，不修改 wiki |
| 断路器粒度 | 按模型级别 | 不同模型提供商独立断路，避免单一故障级联 |
| 缓存策略 | 写入时即时失效 + 自适应 TTL | 平衡一致性和性能 |

**现有代码库关键事实：**
- `tools/shared/llm.py` (123 行)：仅有 `call_llm()` + 简单重试，无断路器/预算/错误分类
- `tools/shared/wiki.py` (181 行)：已有统一 wikilink/frontmatter/读写接口，缓存 TTL 5s
- `tools/search_engine.py` (483 行)：FTS5 搜索，已有 CJK 修复，无查询分析
- `tools/api_server.py`：无页面缓存，无搜索分析，速率限制 60 req/min 硬编码
- `tools/scheduler.py`：静态调度，无历史感知
- `tools/fetchers/`：各抓取器独立运行，无共享协调

---

## 二、任务依赖图

```
第一层（无依赖，可并行启动）:
  ┌─ 1.1 LLM 断路器 + 预算追踪 ─────────────────┐
  ├─ 1.2 搜索查询分析 + 零结果反馈               │
  ├─ 1.3 调度器自适应 + 指标追踪                 │
  └─ 1.4 LLM 提取成本路由 + 内容缓存             │
                                                 ▼
第二层（依赖第一层 metrics.db）:
  ┌─ 2.1 self_optimize.py 编排器 ◄── 依赖 1.1    │
  ├─ 2.2 lint→heal 桥接          ◄── 依赖 2.1    │
  ├─ 2.3 API 缓存 + 自动 FTS5   ◄── 依赖 1.2    │
  ├─ 2.4 知识图谱增量推理                         │
  ├─ 2.5 页面质量评分系统                         │
  └─ 2.6 域名提取策略学习                         │
                                                 ▼
第三层（依赖第二层）:
  ┌─ 3.1 跨抓取器协调层          ◄── 依赖 2.6    │
  ├─ 3.2 RSS 抓取器自适应        ◄── 依赖 3.1    │
  ├─ 3.3 arXiv 质量预检          ◄── 依赖 3.1    │
  └─ 3.4 GitHub 自适应           ◄── 依赖 3.1    │
                                                 ▼
第四层（可并行，前端为主）:
  ┌─ 4.1 页面缓存 + wikilinks 预加载              │
  ├─ 4.2 离线模式                ◄── 依赖 4.1    │
  ├─ 4.3 HTTP 错误语义分类                        │
  ├─ 4.4 Skill 使用统计 + 自动禁用                │
  └─ 4.5 Reflect 增强 + 自动模板建议              │
                                                 ▼
第五层（收尾，依赖所有前序）:
  ┌─ 5.1 跨工具代码一致性审计                     │
  ├─ 5.2 自适应阈值框架                           │
  ├─ 5.3 MCP 健康监控                             │
  └─ 5.4 增量导出                                 │
```

---

## 三、详细任务规格

---

### 第一批：P0 — 止血（省钱 + 防静默故障）

> 前置依赖：无
> 预计影响：LLM 成本降低 30-50%，静默故障消除
> 验证方式：每个任务独立验证，不影响现有功能

---

#### 任务 1.1：LLM 断路器 + 预算追踪 + 错误分类

**优先级：** P0 — 最高优先级
**修改文件：**
- `tools/shared/llm.py` — 在现有 `call_llm()` 前注入断路器和预算检查
- 新建 `state/` 目录（自动创建）

**现有代码关键节点：**
- `call_llm()` 第 95-122 行：现有重试循环，需要在重试前加入断路器检查
- `LLMUnavailableError` 第 43-45 行：已有，断路器 OPEN 时复用此异常
- `_get_logger()` 第 13-19 行：已有日志器，断路器事件使用同一日志器

**新增类规格：**

```python
class LLMCircuitBreaker:
    """Per-model circuit breaker.
    
    States: CLOSED → OPEN → HALF_OPEN → CLOSED
    """
    def __init__(
        self,
        failure_threshold: int = 5,
        cooldown_seconds: int = 60,
        state_file: Path | None = None,  # state/circuit_breaker.json
    ): ...
    
    def check(self, model: str) -> None:
        """Raise LLMUnavailableError if circuit is OPEN for this model."""
    
    def record_success(self, model: str) -> None:
        """Record successful call; transition HALF_OPEN → CLOSED."""
    
    def record_failure(self, model: str, error: Exception) -> None:
        """Record failure; classify error and increment counter.
        
        Transient errors (429, 5xx, ConnectionError, Timeout):
            Increment failure counter.
        Permanent errors (401, 403, 400):
            Log but do NOT increment counter (avoid false circuit breaking).
        """
    
    def get_status(self, model: str) -> dict:
        """Return {state, failures, last_failure, cooldown_remaining}."""
    
    def _load_state(self) -> dict: ...
    def _save_state(self) -> None: ...


class LLMBudgetTracker:
    """Daily LLM cost tracker with warning thresholds."""
    
    def __init__(
        self,
        daily_budget_usd: float = 5.0,
        warning_threshold: float = 0.8,  # 80% triggers warning
        state_file: Path | None = None,  # state/budget_tracker.json
    ): ...
    
    def check_budget(self, estimated_tokens: int = 0) -> bool:
        """Return True if under budget. Check + reset if new day."""
    
    def record_usage(
        self, model: str, prompt_tokens: int, completion_tokens: int, 
        latency_ms: float
    ) -> None:
        """Record actual token usage. Log warning if approaching limit."""
    
    def get_summary(self) -> dict:
        """Return {daily_budget, current_spend, percent_used, remaining_usd, ...}"""
    
    def _get_model_cost(self, model: str) -> tuple[float, float]:
        """Return (input_cost_per_1k, output_cost_per_1k) for model."""


class LLMErrorClassifier:
    """Classify LLM errors as transient or permanent."""
    
    TRANSIENT = {429, 500, 502, 503, 504}
    PERMANENT = {400, 401, 403, 404}
    
    @staticmethod
    def classify(error: Exception) -> str:
        """Return 'transient', 'permanent', or 'unknown'."""
```

**`call_llm()` 改造方案：**

```python
# 模块级单例
_circuit_breaker: LLMCircuitBreaker | None = None
_budget_tracker: LLMBudgetTracker | None = None

def _get_circuit_breaker() -> LLMCircuitBreaker:
    global _circuit_breaker
    if _circuit_breaker is None:
        _circuit_breaker = LLMCircuitBreaker(
            state_file=REPO_ROOT / "state" / "circuit_breaker.json"
        )
    return _circuit_breaker

def _get_budget_tracker() -> LLMBudgetTracker:
    global _budget_tracker
    if _budget_tracker is None:
        _budget_tracker = LLMBudgetTracker(
            state_file=REPO_ROOT / "state" / "budget_tracker.json"
        )
    return _budget_tracker

# 在 call_llm() 中，completion() 调用前：
cb = _get_circuit_breaker()
bt = _get_budget_tracker()
cb.check(model)              # 断路器检查（OPEN 时立即抛出）
bt.check_budget()            # 预算检查（超限时日志警告，不阻塞）

# 在 completion() 成功后：
cb.record_success(model)
bt.record_usage(model, prompt_tokens, completion_tokens, elapsed_ms)

# 在 completion() 失败后：
error_type = LLMErrorClassifier.classify(e)
if error_type == "transient":
    cb.record_failure(model, e)  # 只有瞬时错误才计入断路器
```

**状态文件格式：**

```json
// state/circuit_breaker.json
{
  "models": {
    "anthropic/claude-3-5-sonnet-latest": {
      "state": "CLOSED",
      "consecutive_failures": 0,
      "last_failure": null,
      "opened_at": null
    }
  }
}

// state/budget_tracker.json
{
  "daily_budget_usd": 5.0,
  "current_spend": 0.42,
  "last_reset_date": "2026-05-10",
  "today_calls": 15,
  "today_tokens": 45000
}
```

**验收标准：**
1. `python -c "from tools.shared.llm import LLMCircuitBreaker, LLMBudgetTracker, LLMErrorClassifier"` 成功
2. 模拟连续 5 次 500 错误后，第 6 次调用立即抛出 `LLMUnavailableError`（不等待重试）
3. 401/403 错误不触发断路器计数
4. `state/budget_tracker.json` 自动创建，记录每日消耗
5. 超过 80% 预算时日志出现 WARNING
6. 现有 `call_llm()` 功能无回归（`python tools/health.py` 通过）

---

#### 任务 1.2：搜索查询分析 + 零结果反馈

**优先级：** P0
**修改文件：**
- `tools/search_engine.py` — 添加查询日志记录
- `tools/api_server.py` — `/api/search/fts` 响应增加 `did_you_mean` 字段

**现有代码关键节点：**
- `search_engine.py` `search()` 方法：FTS5 查询入口，需要在此注入日志
- `search_engine.py` `_build_fts_query()`：查询构建，已修复 CJK
- `api_server.py` `/api/search/fts` 端点：FTS 搜索 API

**新增规格：**

```python
# search_engine.py 中新增

class SearchAnalytics:
    """Record search queries for analysis."""
    
    def __init__(self, db_path: Path | None = None):
        # state/search_analytics.db (SQLite)
        # CREATE TABLE IF NOT EXISTS search_queries (
        #     id INTEGER PRIMARY KEY,
        #     timestamp TEXT,
        #     query TEXT,
        #     result_count INTEGER,
        #     source TEXT,        -- 'api', 'fts', 'chat', 'mcp'
        #     latency_ms REAL,
        #     did_you_mean TEXT   -- NULL if not applicable
        # )
        ...
    
    def record(
        self, query: str, result_count: int, source: str,
        latency_ms: float, did_you_mean: str | None = None
    ) -> None: ...
    
    def get_zero_result_queries(self, days: int = 7) -> list[dict]:
        """Return top zero-result queries for data gap analysis."""
    
    def get_stats(self, days: int = 7) -> dict:
        """Return {total_queries, zero_result_rate, top_queries, ...}"""


class FuzzyMatcher:
    """Suggest corrections for zero-result queries."""
    
    def __init__(self):
        self._term_cache: list[str] | None = None
        self._cache_time: float = 0
    
    def suggest(self, query: str, threshold: int = 2) -> str | None:
        """Return closest match if edit distance ≤ threshold, else None.
        
        Optimization: Only trigger on zero results. Cache FTS5 term list
        for 5 minutes. Use rapidfuzz if available, else difflib.
        """
    
    def _get_terms(self) -> list[str]:
        """Extract unique terms from FTS5 index."""
```

**集成点：**

```python
# WikiSearchEngine.search() 方法中，在返回结果前：
analytics = self._get_analytics()
analytics.record(
    query=query,
    result_count=len(results),
    source=source,  # 需要新增参数
    latency_ms=elapsed_ms
)

# api_server.py /api/search/fts 端点中：
if not results:
    matcher = FuzzyMatcher()
    suggestion = matcher.suggest(q)
    if suggestion:
        analytics.record(..., did_you_mean=suggestion)
        response["did_you_mean"] = suggestion
```

**验收标准：**
1. 搜索 "Transfomer"（拼写错误）→ 返回 0 结果 + `did_you_mean: "Transformer"`
2. `state/search_analytics.db` 自动创建且有 `search_queries` 表
3. `python -c "from tools.search_engine import SearchAnalytics; ..."` 可导入
4. 零结果查询在 7 天后可统计 TOP 10

---

#### 任务 1.3：调度器自适应 + 指标追踪

**优先级：** P0
**修改文件：**
- `tools/scheduler.py` — 注入指标收集和自适应规则

**新增规格：**

```python
class JobMetrics:
    """Track scheduler job execution metrics."""
    
    def __init__(self, db_path: Path | None = None):
        # state/scheduler_metrics.db
        # CREATE TABLE IF NOT EXISTS job_runs (
        #     id INTEGER PRIMARY KEY,
        #     job_name TEXT,
        #     timestamp TEXT,
        #     status TEXT,        -- 'success', 'failure', 'skipped'
        #     duration_sec REAL,
        #     items_count INTEGER,
        #     error_message TEXT
        # )
        ...
    
    def record(self, job_name: str, status: str, duration: float,
               items: int = 0, error: str = "") -> None: ...
    
    def get_consecutive_failures(self, job_name: str) -> int: ...
    def get_consecutive_zero_results(self, job_name: str) -> int: ...
    def get_average_items(self, job_name: str, runs: int = 10) -> float: ...
    def get_health_panel(self) -> str:
        """Return formatted table of all job health status."""


class AdaptiveScheduler:
    """Decide whether a job should run based on history."""
    
    def __init__(self, metrics: JobMetrics): ...
    
    def should_run(self, job_name: str) -> tuple[bool, str]:
        """Return (should_run, reason).
        
        Rules:
        - consecutive_failures >= 3 → skip, reason: "consecutive failures"
        - consecutive_zero_results >= 7 → skip, reason: "no results for 7 runs"
        - items > avg * 3 AND avg > 5 → run but flag for review
        - After skip: consecutive 3 successes → auto-restore
        """
```

**新增调度项：**
- 每周一 10:00 → `health --fix`
- 每周三 10:00 → `lint`（仅报告）
- 每月 1 号 → `reflect`

**`--status` 命令：**
```bash
python tools/scheduler.py --status
# 输出：
# Job Health Panel
# ═══════════════════════════════════════════
# Job              │ Status  │ Last Run   │ Avg Items │ Failures
# ─────────────────┼─────────┼────────────┼───────────┼─────────
# rss_fetcher      │ ✅ OK   │ 05-10 08:00│    12.3   │    0
# arxiv_fetcher    │ ⚠️ Skip │ 05-09 09:30│     0.0   │    7 (0 results)
# batch_compile    │ ✅ OK   │ 05-06 09:30│    45.2   │    0
# health_fix       │ ✅ OK   │ 05-06 10:00│     3.0   │    0
```

**验收标准：**
1. `python tools/scheduler.py --status` 输出各 job 健康面板
2. 模拟连续 3 次失败后，第 4 次被跳过且日志有警告
3. `state/scheduler_metrics.db` 有 `job_runs` 表

---

#### 任务 1.4：LLM 提取成本路由 + 内容哈希缓存

**优先级：** P0
**修改文件：**
- `tools/fetchers/llm_extractor.py` — 注入缓存和模型路由

**新增规格：**

```python
class ExtractionCache:
    """Cache LLM extraction results by content hash."""
    
    def __init__(self, cache_dir: Path | None = None):
        # state/llm_cache/{sha256[:2]}/{sha256}.json
        self._cache_dir = cache_dir or (REPO_ROOT / "state" / "llm_cache")
        self._ttl_days = 7
    
    def get(self, content_hash: str) -> dict | None:
        """Return cached result if exists and not expired."""
    
    def put(self, content_hash: str, result: dict, model: str, 
            tokens_used: int) -> None:
        """Cache extraction result."""
    
    def cleanup(self, max_age_days: int = 30) -> int:
        """Remove expired cache entries. Return count removed."""


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
    
    @staticmethod
    def get_model_for_complexity(complexity: str, routing_config: dict) -> str:
        """Return model name for given complexity level."""


# routing_config from state/model_routing.json:
# {"simple": "deepseek/deepseek-chat", "complex": "claude-3-5-sonnet-latest", "default": "deepseek/deepseek-chat"}
```

**集成点：**
```python
# llm_extractor.py extract() 方法改造：
# 1. 计算 content_hash = sha256(html_body)
# 2. 缓存命中 → 直接返回
# 3. 缓存未命中 → ContentClassifier.classify(html) → 选择模型
# 4. LLM 调用 → 缓存结果
```

**验收标准：**
1. 相同 HTML 内容第二次提取 → 日志显示 "cache hit"，无 LLM 调用
2. 简单 HTML 页面 → 日志显示使用便宜模型
3. `state/llm_cache/` 目录自动创建

---

### 第二批：P1 — 闭环自动化

> 前置依赖：任务 1.1（metrics.db）、任务 1.2（搜索分析）
> 预计影响：人工介入减少 80%，诊断→修复闭环形成

---

#### 任务 2.1：self_optimize.py 编排器

**优先级：** P1 — 核心编排器
**新建文件：** `tools/self_optimize.py`

**完整流程规格：**

```python
#!/usr/bin/env python3
"""Self-optimization orchestrator — diagnose → fix → prevent loop."""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
STATE_DIR = REPO_ROOT / "state"
HISTORY_FILE = STATE_DIR / "optimize_history.jsonl"


def run_health(dry_run: bool = False) -> dict:
    """Run health checks. Return {stubs, index_sync, log_coverage, issues}."""
    # Import and call health.py core functions (not subprocess)
    from tools.health import run_all_checks
    return run_all_checks(json_output=True)


def run_heal(issues: list[dict], dry_run: bool = False) -> dict:
    """Heal missing pages. Return {pages_created, pages_skipped}."""
    from tools.heal import heal_missing
    return heal_missing(issues, dry_run=dry_run)


def run_lint(dry_run: bool = False) -> dict:
    """Run content quality checks. Return structured issues."""
    from tools.lint import run_all_lint_checks
    return run_all_lint_checks(json_output=True)


def fix_broken_links(issues: list[dict], dry_run: bool = False) -> dict:
    """Fix or flag broken [[wikilinks]]. Return {fixed, flagged}."""
    # For auto-fixable: remove broken links, keep display text
    # For non-auto-fixable: add [BROKEN] flag
    ...


def generate_suggested_sources(data_gaps: list[dict]) -> Path:
    """Generate raw-inbox/suggested_sources.yaml from lint data gaps."""
    ...


def run_refresh(dry_run: bool = False) -> dict:
    """Refresh stale source documents."""
    from tools.refresh import refresh_stale
    return refresh_stale(dry_run=dry_run)


def run_graph_diff(dry_run: bool = False) -> dict:
    """Incremental graph update."""
    from tools.build_graph import build_incremental
    return build_incremental(diff_only=dry_run)


def run_reflect(dry_run: bool = False) -> dict:
    """Analyze ingestion patterns and suggest improvements."""
    from tools.reflect import analyze_patterns
    return analyze_patterns(dry_run=dry_run)


def log_step(step: str, status: str, details: dict) -> None:
    """Append step result to optimize_history.jsonl."""
    entry = {
        "timestamp": datetime.now().isoformat(),
        "step": step,
        "status": status,
        **details
    }
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Self-optimization orchestrator")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Only report, don't fix (default)")
    parser.add_argument("--auto-fix", action="store_true",
                        help="Automatically fix issues")
    parser.add_argument("--scope", choices=["health", "lint", "graph", "refresh", "reflect", "all"],
                        default="all", help="Only optimize specified subsystem")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    
    dry_run = not args.auto_fix
    
    # Execute pipeline based on scope
    # Each step: run → log → feed results to next step
    ...
```

**CLI 接口：**
```bash
# 预演模式（默认）— 只报告不执行
python tools/self_optimize.py --dry-run

# 自动修复模式
python tools/self_optimize.py --auto-fix

# 仅优化指定子系统
python tools/self_optimize.py --auto-fix --scope health

# 详细输出
python tools/self_optimize.py --dry-run --verbose
```

**验收标准：**
1. `python tools/self_optimize.py --dry-run` 输出完整诊断报告
2. `python tools/self_optimize.py --auto-fix --scope health` 自动修复空桩
3. `state/optimize_history.jsonl` 有执行记录
4. 不修改任何 wiki 内容（dry-run 模式）

---

#### 任务 2.2：lint → heal 自动桥接

**优先级：** P1
**修改文件：**
- `tools/lint.py` — 增加 `--json` 输出和 `auto_fixable` 标记
- `tools/heal.py` — 接受 lint 输出，支持概念页生成

**lint.py 改造：**

```python
# 新增结构化输出格式
# 每个 issue 包含：
{
    "type": "missing_entity" | "broken_link" | "orphan" | "data_gap" | "sparse_page",
    "severity": "high" | "medium" | "low",
    "page": "concepts/Transformer.md",
    "detail": "Referenced by 5 pages but doesn't exist",
    "auto_fixable": True,  # heal.py 可以处理的标记
    "ref_count": 5  # 被引用次数，用于优先级排序
}
```

**heal.py 扩展：**

```python
# 新增参数
# --from-lint <json_file>  接受 lint 输出
# --concept                支持概念页生成（不仅限实体）
# --priority               按引用数排序

def heal_from_lint(issues: list[dict], dry_run: bool = False) -> dict:
    """Generate pages from lint issues.
    
    Priority order:
    1. Pages referenced by 5+ other pages (missing_entities with high ref_count)
    2. Pages referenced by 3+ pages
    3. Other missing pages
    
    Supports both entity and concept page generation.
    """
```

**验收标准：**
1. `python tools/lint.py --json` 输出结构化 JSON
2. `python tools/heal.py --from-lint issues.json --dry-run` 报告会生成的页面
3. 高引用数的缺失实体优先处理

---

#### 任务 2.3：API 页面缓存 + 自动 FTS5 重建

**优先级：** P1
**修改文件：**
- `tools/api_server.py` — 添加 LRU 缓存和自动 FTS5 触发
- `tools/search_engine.py` — 新增 `update_page()` 增量更新方法

**缓存规格：**

```python
# api_server.py 中新增
from functools import lru_cache
from threading import Lock

_page_cache: dict[str, tuple[str, float]] = {}  # path -> (content, fetched_at)
_page_cache_lock = Lock()
_PAGE_CACHE_MAX = 256
_PAGE_CACHE_TTL = 300  # 5 minutes

def _get_cached_page(path: str) -> str | None:
    """Get page from cache if valid."""
    with _page_cache_lock:
        if path in _page_cache:
            content, fetched_at = _page_cache[path]
            if time.time() - fetched_at < _PAGE_CACHE_TTL:
                return content
    return None

def _invalidate_page_cache(path: str) -> None:
    """Invalidate specific page cache entry."""
    with _page_cache_lock:
        _page_cache.pop(path, None)

def _invalidate_all_cache() -> None:
    """Clear entire page cache."""
    with _page_cache_lock:
        _page_cache.clear()
```

**search_engine.py 增量更新：**

```python
# WikiSearchEngine 新增方法
def update_page(self, page_path: str, content: str) -> None:
    """Update a single page in the FTS5 index without full rebuild.
    
    1. DELETE FROM wiki_pages WHERE path = ?
    2. Extract title and plain text from content
    3. INSERT new row
    """
```

**速率限制自适应：**
```python
# 当前：RATE_LIMIT = 60  # hardcoded
# 改为：
class AdaptiveRateLimit:
    def __init__(self, initial: int = 60, min_rate: int = 20, max_rate: int = 120):
        self.current = initial
        self.min = min_rate
        self.max = max_rate
        self._429_count = 0
        self._total_count = 0
        self._last_adjust = time.time()
    
    def record_response(self, status_code: int) -> None:
        self._total_count += 1
        if status_code == 429:
            self._429_count += 1
        # Adjust every 10 minutes
        if time.time() - self._last_adjust > 600:
            self._adjust()
    
    def _adjust(self) -> None:
        rate = self._429_count / max(self._total_count, 1)
        if rate > 0.05:  # >5% 429 rate
            self.current = max(self.min, int(self.current * 0.7))
        elif rate < 0.01:  # <1% 429 rate
            self.current = min(self.max, int(self.current * 1.2))
        self._429_count = 0
        self._total_count = 0
        self._last_adjust = time.time()
```

**验收标准：**
1. 连续请求同一页面 → 第二次响应时间 < 5ms
2. ingest 新文件后 → FTS5 自动更新
3. 速率限制在高 429 率时自动降低

---

#### 任务 2.4：知识图谱增量推理

**优先级：** P1
**修改文件：**
- `tools/build_graph.py` — 添加增量 diff 和推理预算

**新增规格：**

```python
# --diff 标志
def diff_graph(old_graph: dict, new_graph: dict) -> dict:
    """Compare old and new graph, return changes.
    
    Returns:
        {
            "added_nodes": [...],
            "removed_nodes": [...],
            "added_edges": [...],
            "removed_edges": [...],
            "stats": {"nodes_delta": int, "edges_delta": int}
        }
    """

# --max-infer N 推理预算
def prioritize_inference(candidates: list[str], graph: dict, 
                         max_infer: int = 20) -> list[str]:
    """Rank pages for inference priority.
    
    Priority:
    1. Hub nodes (degree > μ+2σ)
    2. Bridge nodes (high betweenness centrality)
    3. New pages (added since last build)
    4. Others
    
    Return top max_infer pages.
    """

# 推理上下文裁剪
def build_inference_context(target_page: str, graph: dict, 
                            max_context: int = 30) -> list[str]:
    """Select top-30 most relevant pages for inference context.
    
    Based on existing edge proximity (pages connected to target's neighbors).
    """
```

**验收标准：**
1. `python tools/build_graph.py --diff` 输出增量变化
2. `--max-infer 5` 限制推理调用为 5 次
3. 重复运行时，未变化的页面跳过推理

---

#### 任务 2.5：页面质量评分系统

**优先级：** P1
**新建文件：** `tools/shared/quality.py`

```python
#!/usr/bin/env python3
"""Page quality scoring system."""
from __future__ import annotations

from pathlib import Path


def score_page(path: Path) -> dict:
    """Score a wiki page on multiple quality dimensions.
    
    Returns:
        {
            "total": 0-100,
            "dimensions": {
                "completeness": 0-20,    # frontmatter 完整度
                "link_density": 0-20,    # wikilinks / content length
                "freshness": 0-20,       # last_updated 距今天数
                "content_depth": 0-20,   # 字符数、代码块、引用
                "cross_reference": 0-20  # 被引用次数
            },
            "suggestions": [
                "Add more [[wikilinks]] (currently 1, recommended ≥3)",
                "Update last_updated date (currently 45 days old)",
                ...
            ]
        }
    """
    ...


def score_all_pages() -> list[dict]:
    """Score all wiki pages. Return sorted by total score (ascending)."""
    ...


def get_quality_summary() -> dict:
    """Return quality distribution summary.
    
    Returns:
        {
            "total_pages": int,
            "avg_score": float,
            "distribution": {"excellent(80+)": n, "good(60-80)": n, "poor(<60)": n},
            "worst_10": [{"path": str, "score": int, "top_issue": str}]
        }
    """
```

**评分规则明细：**

| 维度 | 满分 | 规则 |
|------|------|------|
| completeness | 20 | 有 title(+5) type(+5) tags(+3) sources(+3) last_updated(+4) |
| link_density | 20 | wikilinks 数：0→0, 1→5, 2→10, 3→15, 4+→20 |
| freshness | 20 | 0-7天→20, 8-30天→15, 31-90天→10, 91-365天→5, >365→0 |
| content_depth | 20 | chars: >500→5, >1000→10, >2000→15, >3000→20; +代码块+2, +引用+2(上限20) |
| cross_reference | 20 | 被引用次数：0→0, 1→5, 2→10, 3→15, 4+→20 |

**验收标准：**
1. `python -c "from tools.shared.quality import score_page; print(score_page(Path('wiki/concepts/Transformer.md')))"` 输出评分
2. 评分包含各维度分数和改进建议
3. `lint.py` 可调用 `score_all_pages()` 获取低分页面列表

---

#### 任务 2.6：域名提取策略学习

**优先级：** P1
**修改文件：**
- `tools/fetchers/web_fetcher.py` — 注入域名策略学习
- `tools/fetchers/_common.py` — 添加域名策略存储

**策略存储格式：**

```json
// state/domain_strategy.json
{
  "arxiv.org": {
    "best_engine": "trafilatura",
    "success_count": 45,
    "failure_count": 2,
    "avg_quality": 82.5,
    "fast_path": true,
    "last_updated": "2026-05-10"
  }
}
```

**学习逻辑：**
```python
class DomainStrategy:
    def __init__(self, state_file: Path | None = None): ...
    
    def get_fast_path(self, domain: str) -> str | None:
        """Return best engine for domain if fast_path is active."""
    
    def record_result(self, domain: str, engine: str, success: bool, 
                      quality: float = 0.0) -> None:
        """Record extraction result. Update strategy if needed.
        
        Fast path activation: 5+ consecutive successes with same engine
        Fast path deactivation: failure after fast_path active
        Skip engine: 3+ consecutive failures
        """
    
    def should_skip_engine(self, domain: str, engine: str) -> bool:
        """Check if engine should be skipped for this domain."""
```

**验收标准：**
1. `state/domain_strategy.json` 自动创建
2. 已学习域名跳过中间层直接使用最优引擎
3. 失败时自动降级到完整级联

---

### 第三批：P1-P2 — 抓取器智能升级

> 前置依赖：任务 2.6（域名策略学习）
> 预计影响：抓取效率提升 30%，无效抓取减少

---

#### 任务 3.1：跨抓取器协调层

**优先级：** P1-P2
**修改文件：**
- `tools/fetchers/_common.py` — 添加共享状态和协调逻辑

**新增组件：**

```python
class RetryStateManager:
    """Shared retry state across all fetchers."""
    # state/retry_state.json
    # {url: {retries: int, last_attempt: str, next_retry: str}}
    
    def should_retry(self, url: str) -> tuple[bool, str]: ...
    def record_attempt(self, url: str, success: bool) -> None: ...


class ContentFingerprint:
    """Detect duplicate content via SHA256."""
    # state/content_fingerprints.json
    # {sha256: {count: int, first_seen: str, urls: [str]}}
    
    def check_and_record(self, content: str, url: str) -> tuple[bool, int]:
        """Return (is_duplicate, occurrence_count).
        
        If count >= 3, extend fetch interval to 7 days for this URL.
        """


class DomainHealthTracker:
    """Track per-domain failure rates."""
    # state/domain_health.json
    
    def record(self, domain: str, success: bool) -> None: ...
    def is_dead(self, domain: str) -> bool:
        """Return True if failure_rate > 50% AND attempts > 10."""


class GlobalRateLimiter:
    """Token bucket rate limiter shared across fetchers."""
    
    def __init__(self, rpm: int = 60): ...
    def acquire(self, timeout: float = 10.0) -> bool:
        """Wait for token. Return True if acquired, False if timeout."""
```

**验收标准：**
1. 同一 URL 在 cooldown 期间不被重复抓取
2. 死源被自动标记
3. 全局速率限制生效

---

#### 任务 3.2：RSS 抓取器自适应

**优先级：** P2
**修改文件：**
- `tools/fetchers/rss_fetcher.py`

```python
class RSSFeedMetrics:
    # state/rss_feed_metrics.json
    def record(self, feed_url: str, success: bool, duration: float, 
               items: int) -> None: ...
    def should_skip(self, feed_url: str) -> tuple[bool, str]: ...
    def get_concurrency(self, feed_url: str) -> int:
        """Return 1-3 based on avg response time."""
```

---

#### 任务 3.3：arXiv 质量预检

**优先级：** P2
**修改文件：**
- `tools/fetchers/arxiv_fetcher.py`

```python
class PDFQualityChecker:
    """Pre-check PDF content quality before LLM extraction."""
    
    @staticmethod
    def check(text: str) -> dict:
        """Return {entropy, english_ratio, paragraphs, pass: bool}.
        
        Thresholds:
        - entropy > 3.0 (text diversity)
        - english_ratio > 0.3 (valid content ratio)
        - paragraphs > 5 (structure)
        """
```

---

#### 任务 3.4：GitHub 抓取器自适应

**优先级：** P2
**修改文件：**
- `tools/fetchers/github_fetcher.py`

```python
class GitHubRepoMetrics:
    # state/github_repo_metrics.json
    def record(self, repo: str, commits_since_last: int) -> None: ...
    def get_check_frequency(self, repo: str) -> str:
        """Return 'daily', 'weekly', or 'monthly'."""
```

---

### 第四批：P2 — 前端体验飞跃

> 前置依赖：无（可与前三批并行）
> 预计影响：离线可用，导航速度提升 5x

---

#### 任务 4.1：页面内容缓存 + wikilinks 预加载

**优先级：** P2
**修改文件：**
- `wiki-viewer/src/stores/wikiStore.ts`

**新增 store 状态：**

```typescript
interface PageCache {
  content: string;
  fetchedAt: number;
}

// wikiStore 中新增
pageCache: Map<string, PageCache> = new Map();
PAGE_CACHE_MAX = 100;
PAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Actions
getCachedPage(slug: string): string | null;
setCachedPage(slug: string, content: string): void;
preloadLinkedPages(content: string): void; // parse [[wikilinks]] → preload top 5
```

**预加载逻辑：**
```typescript
preloadLinkedPages(content: string) {
  const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
  const targets = wikilinks.slice(0, 5).map(l => l.slice(2, -2));
  for (const target of targets) {
    if (!this.pageCache.has(target)) {
      // Low priority fetch using requestIdleCallback or setTimeout
      requestIdleCallback(() => {
        fetchPageContent(target).then(c => this.setCachedPage(target, c));
      });
    }
  }
}
```

**验收标准：**
1. 点击 wikilink 到已预加载页面 → 瞬间渲染
2. 搜索同一关键词两次 → 第二次无网络请求
3. 缓存 5 分钟后自动过期

---

#### 任务 4.2：离线模式

**优先级：** P2
**修改文件：**
- `wiki-viewer/src/stores/wikiStore.ts`
- `wiki-viewer/vite.config.ts`

**离线检测：**
```typescript
isOffline: boolean = false;
heartbeatFailures: number = 0;

startHeartbeat() {
  setInterval(async () => {
    try {
      await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
      this.heartbeatFailures = 0;
      if (this.isOffline) this.isOffline = false;
    } catch {
      this.heartbeatFailures++;
      if (this.heartbeatFailures >= 3) this.isOffline = true;
    }
  }, 30000);
}
```

**离线降级：**
- 页面内容 → 从 `pageCache` 渲染
- 搜索 → 使用 Fuse.js 本地搜索（`@/lib/search` 已有）
- 聊天 → 显示 "离线模式不可用"
- 图谱 → 使用缓存的 `graph.json`

---

#### 任务 4.3：HTTP 错误语义分类

**优先级：** P2
**新建/修改文件：** `wiki-viewer/src/lib/apiUtils.ts`（或修改已有错误处理）

```typescript
export type ErrorCategory = 
  | 'auth-failure'    // 401, 403
  | 'not-found'       // 404
  | 'rate-limited'    // 429
  | 'server-error'    // 5xx
  | 'network-error'   // fetch failure
  | 'timeout';        // AbortTimeout

export function classifyError(error: unknown): ErrorCategory { ... }

export function getErrorMessage(category: ErrorCategory): string {
  // Return i18n key for user-facing message
}

export function useApiError() {
  // React Hook: auto-classify errors + Toast notification
  // 429 → auto-retry with backoff
}
```

---

#### 任务 4.4：Skill 使用统计 + 自动禁用

**优先级：** P2
**修改文件：**
- `tools/skill_engine.py`

```python
class SkillUsageTracker:
    # state/skill_usage.json
    # {skill_name: {last_used: str, use_count_30d: int, disabled: bool}}
    
    def record_use(self, skill_name: str) -> None: ...
    def auto_disable_idle(self, idle_days: int = 30) -> list[str]:
        """Disable skills unused for idle_days. Return disabled list."""
    def get_stats(self) -> dict: ...
```

---

#### 任务 4.5：Reflect 增强 + 自动模板建议

**优先级：** P2
**修改文件：**
- `tools/reflect.py`

```python
# 加入 scheduler 每月计划
# MEMORY.md 中超过 90 天未被引用的学习 → 标记 [ARCHIVED]
# 高置信度内容模式 → 自动建议写入 config/ingest_templates.yaml

def suggest_templates(dry_run: bool = False) -> list[dict]:
    """Analyze successful ingestions and suggest templates.
    
    Returns:
        [{"domain": "meeting", "confidence": 0.85, "template": {...}}, ...]
    """
```

---

### 第五批：P3 — 长期稳定

> 前置依赖：所有前序批次
> 预计影响：代码一致性、可维护性提升

---

#### 任务 5.1：跨工具代码一致性审计

**优先级：** P3
**修改文件：**
- `tools/health.py` — 替换内联 `extract_wikilinks` 为 `tools/shared/wiki.py`
- `tools/lint.py` — 替换内联 wikilink 正则
- `tools/build_graph.py` — 替换内联 frontmatter 解析
- `tools/mcp_server.py` — 替换 `_read_page`/`_list_pages`

**审计清单：**

| 工具 | 内联实现 | 替换为 |
|------|----------|--------|
| `health.py` | `extract_wikilinks` 内联 | `tools.shared.wiki.extract_wikilinks` |
| `lint.py` | wikilink 解析正则 | `tools.shared.wiki.extract_wikilinks` |
| `build_graph.py` | frontmatter 解析 | `tools.shared.wiki.extract_frontmatter_*` |
| `mcp_server.py` | `_read_page`/`_list_pages` | `tools.shared.wiki.read_file`/`all_wiki_pages` |

**验证方法：**
```bash
# 每个替换后运行
python tools/health.py

# 检查是否还有内联正则
grep -r "\[\[" tools/*.py | grep -v shared | grep -v "__pycache__"
```

**验收标准：**
1. 所有工具统一使用 `tools/shared/wiki.py`
2. 无内联 wikilink 正则
3. health/lint/build_graph 功能无回归

---

#### 任务 5.2：自适应阈值框架

**优先级：** P3
**新建文件：** `tools/shared/thresholds.py`

```python
#!/usr/bin/env python3
"""Adaptive threshold framework — centralized threshold management."""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
THRESHOLDS_FILE = REPO_ROOT / "state" / "thresholds.json"

DEFAULTS = {
    "quality_thresholds": {"good": 70, "acceptable": 40},
    "concurrency": {"default": 3, "max": 10},
    "retry": {"default": 2, "max": 5},
    "cache_ttl": {"default": 5, "stable": 60, "active": 1},
    "debounce": 5,
    "timeout": 30,
    "max_input_tokens": 6000,
}

def get_threshold(key: str, default=None):
    """Read threshold from state/thresholds.json with fallback to DEFAULTS."""
    ...

def update_threshold(key: str, value) -> None:
    """Update threshold in state/thresholds.json."""
    ...

def auto_adjust(metrics: dict) -> None:
    """Adjust thresholds based on historical metrics.
    
    Examples:
    - 90% pages quality > 80 → raise 'good' threshold to 75
    - Cache hit rate > 80% → increase cache_ttl
    """
```

**验收标准：**
1. 所有硬编码阈值通过 `get_threshold()` 读取
2. `state/thresholds.json` 可手动覆盖
3. 有足够数据后自动调整

---

#### 任务 5.3：MCP 健康监控

**优先级：** P3
**修改文件：**
- `tools/mcp_manager.py`

```python
class MCPHealthMonitor:
    # state/mcp_health.json
    # {server_name: {consecutive_failures: int, last_failure: str, disabled: bool}}
    
    def record_start(self, server_name: str, success: bool) -> None: ...
    def should_disable(self, server_name: str) -> bool:
        """Return True if consecutive_failures >= 3."""
    def get_health_panel(self) -> str: ...
```

---

#### 任务 5.4：导出依赖感知增量更新

**优先级：** P3
**修改文件：**
- `tools/export_agent_kit.py`

```python
def build_dependency_graph(export_dir: Path) -> dict:
    """Track import dependencies between exported files."""
    ...

def incremental_export(changed_files: list[Path], export_dir: Path) -> list[Path]:
    """Only re-export changed files and their dependents."""
    ...
```

---

## 四、新建文件清单

| 文件 | 类型 | 说明 | 任务 |
|------|------|------|------|
| `tools/self_optimize.py` | Python | 闭环自优化编排器 | 2.1 |
| `tools/shared/quality.py` | Python | 页面质量评分系统 | 2.5 |
| `tools/shared/thresholds.py` | Python | 自适应阈值框架 | 5.2 |
| `state/metrics.db` | SQLite | LLM + 搜索指标数据库 | 1.1, 1.2 |
| `state/circuit_breaker.json` | JSON | 断路器状态 | 1.1 |
| `state/budget_tracker.json` | JSON | 预算追踪状态 | 1.1 |
| `state/search_analytics.db` | SQLite | 搜索查询分析 | 1.2 |
| `state/scheduler_metrics.db` | SQLite | 调度器指标 | 1.3 |
| `state/domain_strategy.json` | JSON | 域名提取策略 | 2.6 |
| `state/domain_health.json` | JSON | 域名健康状态 | 3.1 |
| `state/retry_state.json` | JSON | 共享重试状态 | 3.1 |
| `state/rss_feed_metrics.json` | JSON | RSS feed 指标 | 3.2 |
| `state/github_repo_metrics.json` | JSON | GitHub repo 指标 | 3.4 |
| `state/skill_usage.json` | JSON | Skill 使用统计 | 4.4 |
| `state/mcp_health.json` | JSON | MCP 健康状态 | 5.3 |
| `state/optimize_history.jsonl` | JSONL | 优化执行历史 | 2.1 |
| `state/thresholds.json` | JSON | 自适应阈值配置 | 5.2 |

## 五、修改文件清单

| 文件 | 修改内容 | 任务 |
|------|----------|------|
| `tools/shared/llm.py` | 断路器 + 预算追踪 + 错误分类 | 1.1 |
| `tools/search_engine.py` | 查询日志 + 模糊匹配 + 增量更新 | 1.2, 2.3 |
| `tools/scheduler.py` | 指标收集 + 自适应规则 + 新调度项 | 1.3 |
| `tools/api_server.py` | 页面缓存 + 搜索分析 + 自适应限流 | 1.2, 2.3 |
| `tools/fetchers/llm_extractor.py` | 内容哈希缓存 + 模型路由 | 1.4 |
| `tools/fetchers/web_fetcher.py` | 域名策略学习 | 2.6 |
| `tools/fetchers/_common.py` | 共享重试 + 速率限制 + 指纹检测 | 3.1 |
| `tools/fetchers/rss_fetcher.py` | Feed 指标 + 自适应并发 | 3.2 |
| `tools/fetchers/arxiv_fetcher.py` | PDF 质量预检 | 3.3 |
| `tools/fetchers/github_fetcher.py` | Repo 活跃度追踪 | 3.4 |
| `tools/lint.py` | JSON 输出 + 自动修复桥接 | 2.2 |
| `tools/heal.py` | 概念页生成 + lint 输入 | 2.2 |
| `tools/build_graph.py` | 增量 diff + 推理预算 | 2.4 |
| `tools/health.py` | 统一使用 shared/wiki.py | 5.1 |
| `tools/reflect.py` | 模板建议 + MEMORY 归档 | 4.5 |
| `tools/mcp_server.py` | 统一使用 shared/wiki.py | 5.1 |
| `tools/skill_engine.py` | 使用统计 | 4.4 |
| `tools/mcp_manager.py` | 健康监控 | 5.3 |
| `tools/export_agent_kit.py` | 依赖追踪 | 5.4 |
| `tools/shared/wiki.py` | 写入时即时失效缓存 | 2.3 |
| `wiki-viewer/src/stores/wikiStore.ts` | 内容缓存 + 预加载 + 离线 | 4.1, 4.2 |
| `wiki-viewer/vite.config.ts` | PWA 缓存策略 | 4.2 |

---

## 六、验证计划

### 每个任务的验证流程

1. **单元验证**：直接调用核心函数，检查输出
2. **集成验证**：运行 `python tools/health.py` 确保无回归
3. **端到端验证**（编排器就绪后）：`python tools/self_optimize.py --dry-run`
4. **前端验证**：`cd wiki-viewer && npx tsc --noEmit`
5. **API 验证**：`curl http://localhost:8000/api/health`

### 批次完成验证

| 批次 | 验证命令 | 预期结果 |
|------|----------|----------|
| 第一批 | `python tools/health.py && python -c "from tools.shared.llm import LLMCircuitBreaker"` | 无回归 + 新类可导入 |
| 第二批 | `python tools/self_optimize.py --dry-run` | 完整诊断报告输出 |
| 第三批 | 手动触发各抓取器 + 检查 `state/` 指标文件 | 指标数据正确记录 |
| 第四批 | `cd wiki-viewer && npx tsc --noEmit` + 手动测试离线模式 | 无类型错误 + 离线可用 |
| 第五批 | `grep -r "\\[\\[" tools/*.py \| grep -v shared` | 无内联正则 |

---

## 七、预期收益

| 维度 | 当前 | 目标 | 改善幅度 |
|------|------|------|----------|
| 维护人工介入 | 每周多次手动运行 lint/heal/reflect | 全自动，仅异常通知 | ~90% 减少 |
| LLM 调用成本 | 每页都调最贵模型，无缓存 | 简单页用便宜模型，缓存命中 >40% | ~50% 节省 |
| 搜索质量 | 零结果静默，无分析 | 零结果自动建议 + 数据缺口报告 | 显著提升 |
| 抓取效率 | 死源反复重试，静态频率 | 自动降频死源，域名快速路径 | ~30% 提升 |
| 前端体验 | 离线空白页，每次导航请求 | 离线可用 + wikilinks 预加载 | 显著提升 |
| 故障恢复 | 各自重试，无断路器 | 断路器快速失败，冷却后恢复 | ~80% 缩短 |
| 代码一致性 | 各工具内联实现 | 统一 shared/ 接口 | 消除分歧 |

---

## 八、实施建议

1. **从任务 1.1 开始**：断路器 + 预算追踪是所有后续任务的基础，且改动最小（只改一个文件）
2. **任务 1.2 紧随其后**：搜索分析是闭环自动化的数据基础
3. **第二批可以并行**：2.3（API 缓存）和 2.4（图谱增量）互不依赖
4. **第四批可提前启动**：前端任务与后端独立，可并行开发
5. **每个任务完成后运行 `health.py`**：确保无回归
6. **状态文件放在 `state/` 目录**：统一管理，`.gitignore` 排除
