# PostgreSQL + pgvector 迁移方案

> 创建: 2026-05-10 | 版本: v1.1 | 状态: **Phase 1-3 已实现，Phase 4-6 待执行**

---

## 实施进度

| Phase | 内容 | 状态 | 产出 |
|-------|------|------|------|
| 1 | 环境准备 | ✅ 设计完成 | `config/database.yaml`, `config/database.example.yaml` |
| 2 | schema + 迁移脚本 | ✅ 已实现 | `config/schema.sql`, `tools/migrate_to_pgsql.py` |
| 3 | SearchBackend 抽象 | ✅ 已实现 | `tools/shared/search_backend.py`, `search_engine.py` 重构 |
| 4 | 状态管理统一 | ⏳ 待执行 | — |
| 5 | 向量重建 | ⏳ 待执行 | — |
| 6 | 切换 + 回退 | ⏳ 待执行 | — |

**已落地的文件:**

| 文件 | 说明 |
|------|------|
| `tools/shared/search_backend.py` | SearchBackend ABC + `get_search_backend()` 工厂函数 |
| `tools/search_engine.py` | 重构为 `WikiSearchEngine(SearchBackend)` |
| `config/schema.sql` | 6 张表 + 触发器 + `hybrid_search()` 函数 |
| `config/database.yaml` | PG 连接配置 + 向量/搜索参数 (gitignored) |
| `config/database.example.yaml` | 配置模板 (提交到 git) |
| `tools/migrate_to_pgsql.py` | 一键迁移脚本，支持 `--dry-run` `--verify` |

---

## 一、现状分析

### 1.1 当前存储架构

```
state/
├── search.db              ★ SQLite FTS5 (279 wiki pages, 全文索引)
│   ├── wiki_pages          FTS5 虚拟表
│   ├── wiki_embeddings     向量缓存 (JSON 文本存 embedding)
│   └── index_meta          索引元数据
├── scheduler_metrics.db    ★ 调度指标 (job_runs 表)
├── search_analytics.db     ★ 搜索分析 (search_queries 表)
│
raw-inbox/
├── state.json              ★ URL/ETag 去重状态 (4 个顶层 key)
│
state/ (文件级状态)
├── domain_strategy.json    域名提取策略学习
├── retry_state.json        失败重试冷却
├── content_fingerprints.json  内容指纹去重
├── domain_health.json      域名健康度
└── refresh_monitor.json    刷新监控缓存
```

### 1.2 痛点

| 问题 | 说明 |
|------|------|
| **SQLite 并发瓶颈** | 单写锁，`api_server.py` 读 + `scheduler.py` 写 + `auto_ingest.py` 写 同时竞争 |
| **向量存储低效** | embedding 存为 JSON 字符串，每次语义搜索需全量反序列化 279+ 行 |
| **FTS 不支持混合排序** | FTS5 rank + 向量相似度需在 Python 中手动合并，无法 `ORDER BY 0.6*bm25 + 0.4*cosine` |
| **状态分散** | 6 个 JSON 文件 + 3 个 SQLite DB，无统一查询视图 |
| **CJK 二分词 hack** | 入库前手动插入空格分词，写入冗余，且不可逆 |
| **无连接池** | 每次操作 `sqlite3.connect()`，高频场景开销大 |

---

## 二、目标架构

### 2.1 核心选型

| 组件 | 选型 | 原因 |
|------|------|------|
| 数据库 | **PostgreSQL 15+** | 成熟稳定，pgvector 原生支持 |
| 向量扩展 | **pgvector 0.7+** | IVFFlat/HNSW 索引，`halfvec` 半精度节省 50% 空间 |
| 全文搜索 | **PG 内置 tsvector** | 配合 `zhparser` 中文分词 或 bigram 自定义字典 |
| 连接池 | **asyncpg** (异步) + **psycopg2** (同步) | 高性能 + 兼容现有同步代码 |
| 向量模型 | 保持现有 `nomic-embed-text` (Ollama) | 768 维，pgvector 支持 |

### 2.2 架构图

```
┌─────────────────────────────────────────────────────┐
│                   PostgreSQL 15+                     │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ wiki_pages   │  │ wiki_embeds  │  │ pipeline_  │ │
│  │ (tsvector)   │  │ (halfvec)    │  │ state      │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│         │                  │               │         │
│         │     ┌────────────┘               │         │
│         │     │                            │         │
│  ┌──────▼─────▼──────┐   ┌─────────────────▼──────┐ │
│  │ hybrid_search()   │   │ scheduler_jobs         │ │
│  │ 0.6*FTS + 0.4*vec │   │ search_analytics       │ │
│  └───────────────────┘   │ domain_strategies      │ │
│                          │ retry_state            │ │
│                          │ content_fingerprints   │ │
│                          └────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 三、数据表设计

### 3.1 wiki_pages — 核心内容表

```sql
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS zhparser;  -- 中文分词

CREATE TABLE wiki_pages (
    id          SERIAL PRIMARY KEY,
    path        TEXT UNIQUE NOT NULL,              -- 'wiki/sources/my-page.md'
    title       TEXT NOT NULL,
    page_type   TEXT NOT NULL DEFAULT 'source',    -- source/entity/concept/synthesis
    tags        TEXT[] DEFAULT '{}',
    body        TEXT NOT NULL,
    body_tsv    TSVECTOR,                          -- PG 全文索引列
    quality_score REAL DEFAULT 0,
    source_url  TEXT,
    source_type TEXT,                               -- web/rss/arxiv/github
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    -- 自动更新 tsvector
    CONSTRAINT valid_type CHECK (page_type IN ('source','entity','concept','synthesis'))
);

-- 全文索引 (中文用 zhparser, 英文用 english)
CREATE INDEX idx_wiki_fts ON wiki_pages USING GIN (body_tsv);

-- 类型 + 时间复合索引
CREATE INDEX idx_wiki_type_time ON wiki_pages (page_type, updated_at DESC);

-- 源 URL 索引 (去重 + 刷新监控)
CREATE INDEX idx_wiki_source_url ON wiki_pages (source_url) WHERE source_url IS NOT NULL;
```

### 3.2 wiki_embeddings — 向量表

```sql
CREATE TABLE wiki_embeddings (
    id          SERIAL PRIMARY KEY,
    page_path   TEXT UNIQUE NOT NULL REFERENCES wiki_pages(path) ON DELETE CASCADE,
    embedding   HALFVEC(768),          -- nomic-embed-text = 768 维, halfvec 省 50% 空间
    model       TEXT NOT NULL DEFAULT 'nomic-embed-text',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW 向量索引 (比 IVFFlat 快 10-50x 查询, 构建慢但可接受)
CREATE INDEX idx_wiki_embedding ON wiki_embeddings
    USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 200);
```

### 3.3 pipeline_state — 爬虫状态 (替代 state.json)

```sql
CREATE TABLE pipeline_state (
    url             TEXT PRIMARY KEY,
    etag            TEXT,
    last_modified   TEXT,
    content_hash    TEXT,                              -- content_fingerprint
    fetched_at      TIMESTAMPTZ,
    ingested_at     TIMESTAMPTZ,
    source_type     TEXT,                              -- web/rss/arxiv/github
    status          TEXT DEFAULT 'pending',            -- pending/fetched/ingested/failed
    error_message   TEXT,
    retry_count     INT DEFAULT 0,
    next_retry_at   TIMESTAMPTZ
);

CREATE INDEX idx_pipeline_status ON pipeline_state (status, next_retry_at);
CREATE INDEX idx_pipeline_hash ON pipeline_state (content_hash);
```

### 3.4 辅助表

```sql
-- 调度任务记录
CREATE TABLE scheduler_jobs (
    id          SERIAL PRIMARY KEY,
    job_name    TEXT NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status      TEXT DEFAULT 'running',               -- running/success/failure
    duration_ms REAL,
    items_count INT DEFAULT 0,
    error_msg   TEXT
);
CREATE INDEX idx_jobs_name_time ON scheduler_jobs (job_name, started_at DESC);

-- 搜索分析
CREATE TABLE search_queries (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ DEFAULT NOW(),
    query       TEXT NOT NULL,
    result_count INT DEFAULT 0,
    source      TEXT DEFAULT 'fts',                   -- fts/hybrid/semantic
    latency_ms  REAL,
    did_you_mean TEXT
);
CREATE INDEX idx_search_time ON search_queries (timestamp DESC);

-- 域名策略
CREATE TABLE domain_strategies (
    domain              TEXT PRIMARY KEY,
    best_engine         TEXT,
    success_count       INT DEFAULT 0,
    failure_count       INT DEFAULT 0,
    avg_quality         REAL DEFAULT 0,
    fast_path           BOOLEAN DEFAULT FALSE,
    consecutive_successes INT DEFAULT 0,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 内容指纹去重
CREATE TABLE content_fingerprints (
    hash        TEXT PRIMARY KEY,
    first_url   TEXT NOT NULL,
    seen_count  INT DEFAULT 1,
    first_seen  TIMESTAMPTZ DEFAULT NOW(),
    last_seen   TIMESTAMPTZ DEFAULT NOW()
);

-- 刷新监控缓存
CREATE TABLE refresh_monitor (
    source_url      TEXT PRIMARY KEY,
    last_checked_at TIMESTAMPTZ,
    total_changes   INT DEFAULT 0,
    last_change_at  TIMESTAMPTZ,
    checks_count    INT DEFAULT 0
);
```

---

## 四、混合搜索设计

### 4.1 中文全文搜索

```sql
-- 方案 A: zhparser (推荐, 需编译安装)
CREATE TEXT SEARCH CONFIGURATION zh_cfg (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION zh_cfg
    ADD MAPPING FOR n,v,a,i,e,l,j WITH simple;

-- 入库触发器: 自动更新 tsvector
CREATE OR REPLACE FUNCTION wiki_tsv_trigger() RETURNS trigger AS $$
BEGIN
    NEW.body_tsv := to_tsvector('zh_cfg', coalesce(NEW.title,'') || ' ' || NEW.body);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wiki_tsv_update
    BEFORE INSERT OR UPDATE ON wiki_pages
    FOR EACH ROW EXECUTE FUNCTION wiki_tsv_trigger();
```

```sql
-- 方案 B: 无 zhparser 环境时，用 bigram 分词 (兼容现有逻辑)
-- 应用层生成 bigram 后存为 tsvector
-- "量化交易" → '量化':1 '化交':2 '交易':3
-- 搜索: SELECT * FROM wiki_pages WHERE body_tsv @@ to_tsquery('simple', '量化 & 交易');
```

### 4.2 混合搜索 SQL

```sql
-- 混合搜索: 0.6 * FTS rank + 0.4 * cosine similarity
WITH fts_results AS (
    SELECT
        wp.path, wp.title, wp.page_type, wp.updated_at,
        ts_rank(wp.body_tsv, websearch_to_tsquery('zh_cfg', $1)) AS fts_rank,
        LEFT(wp.body, 300) AS excerpt
    FROM wiki_pages wp
    WHERE wp.body_tsv @@ websearch_to_tsquery('zh_cfg', $1)
    LIMIT 100
),
vec_results AS (
    SELECT
        we.page_path,
        1 - (we.embedding <=> $2::halfvec) AS vec_score
    FROM wiki_embeddings we
    ORDER BY we.embedding <=> $2::halfvec
    LIMIT 100
)
SELECT
    COALESCE(f.path, v.page_path) AS path,
    COALESCE(f.title, '') AS title,
    COALESCE(f.page_type, 'unknown') AS type,
    COALESCE(f.excerpt, '') AS excerpt,
    (0.6 * COALESCE(f.fts_rank, 0) + 0.4 * COALESCE(v.vec_score, 0)) AS hybrid_score,
    f.updated_at
FROM fts_results f
FULL OUTER JOIN vec_results v ON f.path = v.page_path
ORDER BY hybrid_score DESC
LIMIT $3;
```

### 4.3 搜索抽象层

```python
# tools/shared/search_backend.py
from abc import ABC, abstractmethod
from typing import Any

class SearchBackend(ABC):
    """可插拔搜索后端接口"""

    @abstractmethod
    def search(self, query: str, limit: int = 20,
               semantic: bool = False) -> dict[str, Any]:
        """返回 {results, count, did_you_mean, degraded}"""
        ...

    @abstractmethod
    def index_page(self, path: str, title: str, content: str,
                   page_type: str, tags: list[str]) -> None:
        ...

    @abstractmethod
    def update_page(self, path: str, content: str) -> None:
        ...

    @abstractmethod
    def remove_page(self, path: str) -> None:
        ...

    @abstractmethod
    def rebuild_index(self) -> None:
        ...

    @abstractmethod
    def count(self) -> int:
        ...

    @abstractmethod
    def close(self) -> None:
        ...


class SQLiteSearchBackend(SearchBackend):
    """现有 SQLite FTS5 实现 (重构为接口适配)"""
    ...

class PgSearchBackend(SearchBackend):
    """PostgreSQL + pgvector 实现"""
    ...
```

---

## 五、配置设计

```yaml
# config/database.yaml (gitignored)
database:
  backend: "postgresql"               # postgresql | sqlite (fallback)
  postgresql:
    host: "localhost"
    port: 5432
    database: "llm_wiki"
    user: "wiki_user"
    password: "${PG_PASSWORD}"        # 从环境变量读取
    pool_min: 2
    pool_max: 10
    # asyncpg (异步, api_server) 和 psycopg2 (同步, 脚本) 双驱动
  sqlite:
    path: "state/search.db"           # 回退路径

vector:
  dimension: 768                      # nomic-embed-text
  index_type: "hnsw"                  # hnsw | ivfflat
  hnsw:
    m: 16
    ef_construction: 200
    ef_search: 50

search:
  hybrid_weight_fts: 0.6
  hybrid_weight_vector: 0.4
  cjk_parser: "zhparser"             # zhparser | bigram_app
  type_boosts:
    entity: 1.2
    concept: 1.1
    source: 1.0
```

---

## 六、分阶段实施计划

### Phase 1: 环境准备 (0.5 天)

| 步骤 | 内容 |
|------|------|
| 1.1 | 安装 PostgreSQL 15+ |
| 1.2 | 安装 pgvector 扩展: `CREATE EXTENSION vector;` |
| 1.3 | (可选) 安装 zhparser: `CREATE EXTENSION zhparser;` |
| 1.4 | 创建数据库和用户，配置连接权限 |
| 1.5 | `pip install asyncpg psycopg2-binary pgvector` |

### Phase 2: 数据表 + 迁移脚本 (1 天)

| 步骤 | 内容 |
|------|------|
| 2.1 | 执行 `schema.sql` 建表 |
| 2.2 | 编写 `tools/migrate_to_pgsql.py` — 从 SQLite 迁移到 PostgreSQL |
| 2.3 | 迁移 wiki_pages (279 条) |
| 2.4 | 迁移 embeddings (如已存在) |
| 2.5 | 迁移 pipeline_state, scheduler_jobs 等辅助数据 |
| 2.6 | 迁移后数据校验 (行数对比 + 抽样内容对比) |

### Phase 3: 搜索后端抽象 (1 天)

| 步骤 | 内容 |
|------|------|
| 3.1 | 定义 `SearchBackend` 抽象接口 (`tools/shared/search_backend.py`) |
| 3.2 | 重构现有 `WikiSearchEngine` → `SQLiteSearchBackend` |
| 3.3 | 实现 `PgSearchBackend` (FTS + vector hybrid search) |
| 3.4 | 后端工厂函数: `get_search_backend()` 根据配置选择 |
| 3.5 | 更新 `api_server.py` / `auto_ingest.py` / `query.py` 使用抽象接口 |

### Phase 4: 状态管理统一 (0.5 天)

| 步骤 | 内容 |
|------|------|
| 4.1 | 定义 `StateBackend` 抽象接口 |
| 4.2 | `PgStateBackend` — 用 `pipeline_state` 表替代 `state.json` |
| 4.3 | 更新 `_common.py` 的 `load_state/save_state` 使用新后端 |
| 4.4 | 更新 `scheduler.py` 的 `JobMetrics` 使用 PG |
| 4.5 | 更新 `refresh_monitor.py` 使用 PG |

### Phase 5: 向量嵌入重建 (0.5 天)

| 步骤 | 内容 |
|------|------|
| 5.1 | 批量生成 279 个 wiki 页面的 embedding |
| 5.2 | 存入 `wiki_embeddings` 表 (halfvec 格式) |
| 5.3 | 创建 HNSW 索引 |
| 5.4 | 验证混合搜索质量: FTS-only vs Hybrid 结果对比 |

### Phase 6: 切换 + 回退 (0.5 天)

| 步骤 | 内容 |
|------|------|
| 6.1 | 切换 `config/database.yaml` `backend: "postgresql"` |
| 6.2 | 运行全量回归测试 |
| 6.3 | 保留 SQLite 为只读回退: `backend: "sqlite"` 一键回滚 |
| 6.4 | 文档更新 (CLAUDE.md, README) |

---

## 七、回退策略

```
config/database.yaml:
  backend: "sqlite"    ← 改为这个就回退到 SQLite，一行配置

迁移期间 SQLite 数据不删除，PG 作为新增并行运行。
切换后观察 1 周无问题，再删除 SQLite 旧数据。
```

---

## 八、搜索效果对比 (预期)

| 指标 | SQLite FTS5 (当前) | PG tsvector + pgvector |
|------|-------------------|----------------------|
| 中文搜索 | bigram 分词 hack | zhparser 语义分词，精准度 ↑30-50% |
| 语义搜索 | Python 循环计算 cosine | 数据库内 `<=>` 算子，速度 ↑100x |
| 混合排序 | Python 手动合并 | 单条 SQL 完成，延迟 ↓70% |
| 并发写入 | 单写锁 | MVCC 多版本，无锁竞争 |
| 向量存储 | JSON 文本 4 字节/维 | halfvec 2 字节/维，空间 ↓50% |
| 连接管理 | 每次 connect | 连接池复用 |

---

## 九、关键代码示例

### 9.1 PgSearchBackend 核心方法

```python
class PgSearchBackend(SearchBackend):
    def __init__(self, config: dict):
        self._pool = asyncpg.create_pool(
            host=config['host'], port=config['port'],
            database=config['database'],
            user=config['user'], password=config['password'],
            min_size=config.get('pool_min', 2),
            max_size=config.get('pool_max', 10),
        )

    async def search(self, query: str, limit: int = 20,
                     semantic: bool = False) -> dict:
        async with self._pool.acquire() as conn:
            if semantic:
                emb = await self._get_query_embedding(query)
                return await self._hybrid_search(conn, query, emb, limit)
            else:
                return await self._fts_search(conn, query, limit)

    async def _hybrid_search(self, conn, query, emb, limit):
        return await conn.fetch("""
            WITH fts AS (
                SELECT path, title, page_type,
                       ts_rank(body_tsv, websearch_to_tsquery('zh_cfg', $1)) AS rank,
                       LEFT(body, 300) AS excerpt
                FROM wiki_pages
                WHERE body_tsv @@ websearch_to_tsquery('zh_cfg', $1)
                LIMIT $3 * 2
            ),
            vec AS (
                SELECT page_path,
                       1 - (embedding <=> $2::halfvec) AS score
                FROM wiki_embeddings
                ORDER BY embedding <=> $2::halfvec
                LIMIT $3 * 2
            )
            SELECT COALESCE(f.path, v.page_path) AS path,
                   COALESCE(f.title, '') AS title,
                   COALESCE(f.page_type, 'unknown') AS type,
                   COALESCE(f.excerpt, '') AS excerpt,
                   (0.6 * COALESCE(f.rank,0) + 0.4 * COALESCE(v.score,0)) AS hybrid_score
            FROM fts f FULL OUTER JOIN vec v ON f.path = v.page_path
            ORDER BY hybrid_score DESC LIMIT $3
        """, query, emb, limit)
```

### 9.2 迁移脚本骨架

```python
# tools/migrate_to_pgsql.py
def migrate_wiki_pages(sqlite_engine, pg_pool):
    """迁移 wiki_pages 从 SQLite → PostgreSQL"""
    rows = sqlite_engine.execute("SELECT path, title, type, content FROM wiki_pages").fetchall()
    for row in rows:
        await pg_pool.execute("""
            INSERT INTO wiki_pages (path, title, page_type, body, body_tsv)
            VALUES ($1, $2, $3, $4, to_tsvector('zh_cfg', $2 || ' ' || $4))
            ON CONFLICT (path) DO UPDATE SET
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                body_tsv = EXCLUDED.body_tsv,
                updated_at = NOW()
        """, row.path, row.title, row.type, row.content)
```

---

## 十、依赖变更

```diff
# requirements.txt
+ asyncpg>=0.29
+ psycopg2-binary>=2.9
+ pgvector>=0.3

# pyproject.toml
+ [tool.poetry.dependencies]
+ asyncpg = ">=0.29"
+ psycopg2-binary = ">=2.9"
+ pgvector = ">=0.3"
```

---

## 十一、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| zhparser 编译失败 | 中 | 中文搜索退化为 bigram | 自动 fallback 到应用层 bigram (`bigram_app` 模式) |
| pgvector HNSW 构建慢 | 低 | 首次建索引耗时长 | 279 条数据极轻量，预计 <1 秒 |
| asyncpg 与现有同步代码混用 | 中 | 部分脚本需改造 | 同步脚本用 `psycopg2`，异步 API 用 `asyncpg`，双驱动共存 |
| PG 服务不可用 | 低 | 搜索/入库中断 | 配置中 `backend: "sqlite"` 一键回退 |
| 迁移数据不一致 | 低 | 搜索结果差异 | 迁移后自动执行 `COUNT` + 抽样校验脚本 |

---

## 十二、总工时估算

| Phase | 内容 | 工时 |
|-------|------|------|
| 1 | 环境准备 | 0.5 天 |
| 2 | 建表 + 迁移脚本 | 1 天 |
| 3 | 搜索抽象层 | 1 天 |
| 4 | 状态管理统一 | 0.5 天 |
| 5 | 向量重建 | 0.5 天 |
| 6 | 切换 + 回归 | 0.5 天 |
| **合计** | | **4 天** |
