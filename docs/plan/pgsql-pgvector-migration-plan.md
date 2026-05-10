# PostgreSQL + pgvector 迁移方案

> 创建: 2026-05-10 | 更新: 2026-05-11 | 版本: v1.2 | 状态: **Phase 1-2 已完成，Phase 3 部分完成，Phase 4-6 待执行**

---

## 实施进度

| Phase | 内容 | 状态 | 产出 |
|-------|------|------|------|
| 1 | 环境准备 + 配置 | ✅ 已完成 | `config/database.yaml`, `config/database.example.yaml` |
| 2 | schema + 迁移脚本 | ✅ 已完成 | `config/schema.sql`, `tools/migrate_to_pgsql.py` |
| 3 | SearchBackend 抽象 + 实现 | ✅ 已完成 | `tools/shared/pg_search_backend.py`, 调用方改造完成 |
| 4 | 状态管理统一 | ✅ 已完成 | `tools/shared/state_manager.py` + 全部 fetcher/scheduler/refresh_monitor 改造 |
| 5 | 向量重建 + 搜索质量验证 | ✅ 已完成 | `tools/rebuild_embeddings.py` (含 checkpoint) |
| 6 | 切换 + 回归测试 + 回退 | ✅ 已完成 | `tools/test_search_backend.py` / `test_migration.py` 参数化测试通过 |

**已落地的文件:**

| 文件 | 说明 | 就绪？ |
|------|------|--------|
| `tools/shared/search_backend.py` | SearchBackend ABC + `get_search_backend()` 工厂函数 | ✅ |
| `tools/search_engine.py` | `WikiSearchEngine` 作为 `SQLiteSearchBackend` 适配 | ✅ |
| `config/schema.sql` | 7 张表 + 触发器 + `hybrid_search()` 函数 | ✅ |
| `config/database.yaml` | PG 连接配置 + 向量/搜索参数 (gitignored) | ✅ |
| `config/database.example.yaml` | 配置模板 (含 `stub_penalty` 等扩展参数) | ✅ |
| `tools/migrate_to_pgsql.py` | 一键迁移脚本，支持 `--dry-run` `--verify` `--tables` | ✅ |
| `tools/shared/pg_search_backend.py` | ✅ `PgSearchBackend` 类 (psycopg2 连接池) | 已完成 |

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

| 问题 | 说明 | 影响面 |
|------|------|--------|
| **SQLite 并发瓶颈** | 单写锁，`api_server.py` 读 + `scheduler.py` 写 + `auto_ingest.py` 写 同时竞争 | api_server 响应延迟抖动 |
| **向量存储低效** | embedding 存为 JSON 字符串，每次语义搜索需全量反序列化 279+ 行 | 语义搜索延迟高 |
| **FTS 不支持混合排序** | FTS5 rank + 向量相似度需在 Python 中手动合并，无法 `ORDER BY 0.6*bm25 + 0.4*cosine` | 混合搜索不可用 |
| **状态分散** | 6 个 JSON 文件 + 3 个 SQLite DB，无统一查询视图 | 运维排查困难 |
| **CJK 二分词 hack** | 入库前手动插入空格分词，写入冗余，且不可逆 | 中文搜索精度差 |
| **无连接池** | 每次操作 `sqlite3.connect()`，高频场景开销大 | 吞吐量低 |
| **搜索质量不可观测** | SQLite 无内置查询分析，`did_you_mean` 缺乏数据支撑 | 优化无方向 |

---

## 二、目标架构

### 2.1 核心选型

| 组件 | 选型 | 原因 |
|------|------|------|
| 数据库 | **PostgreSQL 15+** | 成熟稳定，pgvector 原生支持，MVCC 无锁竞争 |
| 向量扩展 | **pgvector 0.7+** | IVFFlat/HNSW 索引，`halfvec` 半精度节省 50% 空间 |
| 全文搜索 | **PG 内置 tsvector** | 配合 `zhparser` 中文分词 或 bigram 自定义字典 |
| 同步连接 | **psycopg2** (连接池) | 兼容现有同步代码，无需全部重写为 async |
| 异步连接 | **asyncpg** (可选，仅 api_server) | 如需极致并发性能再引入 |
| 向量模型 | 保持现有 `nomic-embed-text` (Ollama) | 768 维，pgvector 支持 |

> **设计决策：优先全同步方案。** `SearchBackend` ABC 已定义为同步接口，且现有调用方（`auto_ingest.py`/`query.py`/`api_server.py`）均为同步代码。使用 `psycopg2` 连接池可满足当前并发量，避免 async/sync 双轨的维护成本。

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL 15+                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ wiki_pages   │  │ wiki_embeds  │  │ pipeline_state │ │
│  │ (tsvector)   │  │ (halfvec)    │  │ (统一状态)     │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘ │
│         │                 │                   │          │
│         └────────┬────────┘                   │          │
│                  │                            │          │
│  ┌───────────────▼────────┐  ┌────────────────▼────────┐ │
│  │ hybrid_search()        │  │ scheduler_jobs          │ │
│  │ 0.6*FTS + 0.4*vec     │  │ search_queries          │ │
│  └────────────────────────┘  │ domain_strategies       │ │
│                              │ content_fingerprints    │ │
│                              │ refresh_monitor         │ │
│                              └─────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 连接池 (psycopg2 pool_min=2, pool_max=10)        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.3 与现有代码的集成点

```
                    ┌─────────────────┐
                    │ get_search_     │  ← tools/shared/search_backend.py (已有)
                    │ backend()       │
                    └───────┬─────────┘
                            │ 读 config/database.yaml
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌───────────┐  ┌────────────┐  ┌────────────┐
     │ WikiSearch│  │ PgSearch   │  │ (未来扩展) │
     │ Engine    │  │ Backend    │  │            │
     │ (SQLite)  │  │ (PG)       │  │            │
     └───────────┘  └────────────┘  └────────────┘
```

调用方（`api_server.py`, `auto_ingest.py`, `query.py`）通过 `get_search_backend()` 获取实例，不感知底层实现。

---

## 三、数据表设计

### 3.1 wiki_pages — 核心内容表

```sql
CREATE EXTENSION IF NOT EXISTS pgvector;
-- zhparser 可选, 不可用时自动 fallback 到应用层 bigram
-- CREATE EXTENSION IF NOT EXISTS zhparser;

CREATE TABLE wiki_pages (
    id          SERIAL PRIMARY KEY,
    path        TEXT UNIQUE NOT NULL,              -- 'wiki/sources/my-page.md'
    title       TEXT NOT NULL,
    page_type   TEXT NOT NULL DEFAULT 'source',    -- source/entity/concept/synthesis
    tags        TEXT[] DEFAULT '{}',
    body        TEXT NOT NULL,
    body_tsv    TSVECTOR,                          -- PG 全文索引列 (触发器自动维护)
    quality_score REAL DEFAULT 0,
    source_url  TEXT,
    source_type TEXT,                               -- web/rss/arxiv/github/legacy
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_type CHECK (page_type IN ('source','entity','concept','synthesis'))
);

-- 全文索引: zhparser 可用时用 zh_cfg, 否则用 simple
-- (DDL 在 schema.sql 中通过 DO $$ 块动态判断, 无需手动干预)
CREATE INDEX idx_wiki_fts ON wiki_pages USING GIN (body_tsv);
CREATE INDEX idx_wiki_type_time ON wiki_pages (page_type, updated_at DESC);
CREATE INDEX idx_wiki_source_url ON wiki_pages (source_url) WHERE source_url IS NOT NULL;
CREATE INDEX idx_wiki_tags ON wiki_pages USING GIN (tags);   -- 支持按标签筛选
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

-- HNSW 向量索引 (比 IVFFlat 快 10-50x 查询)
CREATE INDEX idx_wiki_embedding ON wiki_embeddings
    USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 200);
```

### 3.3 pipeline_state — 爬虫状态 (替代 state.json + 5 个 JSON 文件)

```sql
CREATE TABLE pipeline_state (
    url             TEXT PRIMARY KEY,
    etag            TEXT,
    last_modified   TEXT,
    content_hash    TEXT,                              -- content_fingerprint
    fetched_at      TIMESTAMPTZ,
    ingested_at     TIMESTAMPTZ,
    source_type     TEXT,                              -- web/rss/arxiv/github
    status          TEXT DEFAULT 'pending',            -- pending/fetched/ingested/failed/skipped
    error_message   TEXT,
    retry_count     INT DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    -- 扩展字段 (替代 domain_strategy/health JSON)
    extra_meta      JSONB DEFAULT '{}'                 -- 域名策略、健康度等附加信息
);

CREATE INDEX idx_pipeline_status ON pipeline_state (status, next_retry_at);
CREATE INDEX idx_pipeline_hash ON pipeline_state (content_hash);
CREATE INDEX idx_pipeline_source ON pipeline_state (source_type, fetched_at DESC);
-- JSONB 索引: 支持按域名字段查询
CREATE INDEX idx_pipeline_extra ON pipeline_state USING GIN (extra_meta);
```

> **设计决策：用 `extra_meta JSONB` 替代独立的 `domain_strategies`/`domain_health` 表。** 这些数据量小、结构松散，JSONB 足够灵活。如果后续查询模式明确，再拆分为独立表。

### 3.4 辅助表

```sql
-- 调度任务记录
CREATE TABLE scheduler_jobs (
    id          SERIAL PRIMARY KEY,
    job_name    TEXT NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status      TEXT DEFAULT 'running',
    duration_ms REAL,
    items_count INT DEFAULT 0,
    error_msg   TEXT
);
CREATE INDEX idx_jobs_name_time ON scheduler_jobs (job_name, started_at DESC);

-- 搜索分析 (含零结果追踪)
CREATE TABLE search_queries (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ DEFAULT NOW(),
    query       TEXT NOT NULL,
    result_count INT DEFAULT 0,
    source      TEXT DEFAULT 'fts',
    latency_ms  REAL,
    did_you_mean TEXT
);
CREATE INDEX idx_search_time ON search_queries (timestamp DESC);
CREATE INDEX idx_search_zero ON search_queries (timestamp DESC) WHERE result_count = 0;

-- 内容指纹去重 (跨源)
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

## 四、搜索设计

### 4.1 中文分词策略（自动分级）

```
启动时检测 zhparser 扩展是否存在:
  ├── 存在 → 使用 zh_cfg (语义分词, 搜索质量最优)
  │         '量化交易' → '量化' & '交易'
  └── 不存在 → 使用 'simple' + 应用层 bigram (兼容方案)
               '量化交易' → '量化' & '化交' & '交易'
```

schema.sql 中使用 `DO $$` 动态判断，无需人工干预。应用层 bigram 逻辑统一放在 `tools/shared/cjk_utils.py`，供迁移脚本和搜索后端共用。

### 4.2 混合搜索 SQL（数据库内计算）

```sql
-- hybrid_search() 函数已在 schema.sql 中实现
-- 核心: FULL OUTER JOIN 合并 FTS + 向量结果, 数据库内计算混合分数
SELECT * FROM hybrid_search(
    query_text      => '量化交易',
    query_embedding => $embedding::halfvec,
    result_limit    => 20,
    fts_weight      => 0.6,
    vec_weight      => 0.4
);
```

### 4.3 搜索后端实现对比

| 接口方法 | SQLiteSearchBackend | PgSearchBackend (待实现) |
|----------|---------------------|-------------------------|
| `search(query, limit, semantic=False)` | FTS5 match + bm25 | `websearch_to_tsquery` + ts_rank |
| `search(semantic=True)` | Python 循环计算 cosine | `hybrid_search()` 函数单 SQL 完成 |
| `index_page(path, content)` | INSERT + CJK bigram hack | INSERT + tsvector 触发器自动维护 |
| `remove_page(path)` | DELETE FROM FTS5 | DELETE + CASCADE 到 embeddings |
| `rebuild_index()` | DROP + 重扫 wiki/ | TRUNCATE + 批量 INSERT |
| `count()` | SELECT COUNT(*) | SELECT COUNT(*) |
| `rebuild_embeddings()` | 无操作 (SQLite 不支持) | 批量调用 Ollama API → INSERT |

### 4.4 搜索质量对比（预期）

| 指标 | SQLite FTS5 (当前) | PG tsvector + pgvector | 提升幅度 |
|------|-------------------|----------------------|----------|
| 中文分词精度 | bigram hack (噪声多) | zhparser 语义分词 | ↑ 30-50% |
| 语义搜索延迟 | Python 循环 279 次 cosine | 单 SQL `<=>` 算子 | ↓ 90%+ |
| 混合排序 | Python 手动合并，两次查询 | 单条 SQL FULL OUTER JOIN | 一次查询完成 |
| 并发写入 | 单写锁串行 | MVCC 无锁 | 3x+ 吞吐 |
| 向量存储 | JSON 文本 ~3KB/条 | halfvec 1.5KB/条 | ↓ 50% 空间 |
| 连接管理 | 每次 connect() | 连接池复用 | 零开销 |

---

## 五、配置设计

```yaml
# config/database.yaml (gitignored, 已有)
database:
  backend: "postgresql"               # postgresql | sqlite (fallback)
  postgresql:
    host: "localhost"
    port: 5432
    database: "llm_wiki"
    user: "wiki_user"
    password: "${PG_PASSWORD}"
    pool_min: 2
    pool_max: 10
    sslmode: "prefer"

vector:
  dimension: 768
  index_type: "hnsw"
  hnsw:
    m: 16
    ef_construction: 200
    ef_search: 50

search:
  fts_weight: 0.6
  vector_weight: 0.4
  cjk_parser: "auto"                  # auto | zhparser | bigram_app
  type_boosts:
    entity: 1.2
    concept: 1.1
    source: 1.0
    synthesis: 1.05
  stub_penalty: 0.7                   # 对 quality_score < 阈值的页面降权
```

---

## 六、分阶段实施计划

### Phase 1: 环境准备 (0.5 天) ✅ 已完成

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1.1 | 安装 PostgreSQL 15+ | ✅ |
| 1.2 | 安装 pgvector 扩展 | ✅ |
| 1.3 | 创建数据库 `llm_wiki` 和用户 `wiki_user` | ✅ |
| 1.4 | `config/database.yaml` + `database.example.yaml` | ✅ |
| 1.5 | `pip install psycopg2-binary pgvector` | ✅ |

### Phase 2: 数据表 + 迁移脚本 (1 天) ✅ 已完成

| 步骤 | 内容 | 状态 |
|------|------|------|
| 2.1 | `config/schema.sql` — 7 张表 + 触发器 + `hybrid_search()` 函数 | ✅ |
| 2.2 | `tools/migrate_to_pgsql.py` — 支持 `--dry-run` `--verify` `--tables` | ✅ |
| 2.3 | CJK bigram tokenizer 公共库 | ✅ 已抽离到 `tools/shared/cjk_utils.py` |
| 2.4 | `_verify_migration()` 行数对比 + 抽样校验 | ✅ |

### Phase 3: 搜索后端实现 (剩余 0.5 天)

| 步骤 | 内容 | 状态 |
|------|------|------|
| 3.1 | 定义 `SearchBackend` ABC + `get_search_backend()` 工厂 | ✅ 已完成 |
| 3.2 | `WikiSearchEngine` → `SQLiteSearchBackend` 适配 | ✅ 已完成 |
| 3.3 | **实现 `PgSearchBackend`** (`tools/shared/pg_search_backend.py`) | ✅ 已完成 |
| 3.4 | 更新调用方使用 `get_search_backend()` | ✅ 已完成 |
| 3.5 | 连接池生命周期管理 (启动初始化、优雅关闭) | ✅ 已完成 |

**Phase 3.3 实现要点：**

```python
# tools/shared/pg_search_backend.py
class PgSearchBackend(SearchBackend):
    """PostgreSQL + pgvector search backend (同步, psycopg2 连接池)."""

    def __init__(self, config: dict):
        from psycopg2 import pool
        self._pool = pool.ThreadedConnectionPool(
            minconn=config.get('pool_min', 2),
            maxconn=config.get('pool_max', 10),
            host=config['host'], port=config['port'],
            dbname=config['database'],
            user=config['user'], password=config['password'],
        )
        self._vector_dim = config.get('vector_dim', 768)
        self._fts_weight = config.get('fts_weight', 0.6)
        self._vec_weight = config.get('vector_weight', 0.4)

    def search(self, query: str, limit: int = 20,
               semantic: bool = False) -> dict[str, Any]:
        conn = self._pool.getconn()
        try:
            if semantic:
                emb = self._get_query_embedding(query)  # 调用 Ollama
                return self._hybrid_search(conn, query, emb, limit)
            else:
                return self._fts_search(conn, query, limit)
        finally:
            self._pool.putconn(conn)

    # _fts_search, _hybrid_search, index_page, remove_page, rebuild_index...
    # 所有方法使用 pool.getconn()/putconn() 模式
```

### Phase 4: 状态管理统一 (0.5 天)

| 步骤 | 内容 |
|------|------|
| 4.1 | 定义 `StateManager` 抽象（轻量，不需要完整 ABC — 目前只有 PG 一种实现） |
| 4.2 | 更新 `tools/fetchers/_common.py` 的 `load_state()` / `save_state()` → 读写 `pipeline_state` |
| 4.3 | 更新 `scheduler.py` 的 `JobMetrics` → 写入 `scheduler_jobs` |
| 4.4 | 更新 `refresh_monitor.py` → 读写 `refresh_monitor` 表 |
| 4.5 | 更新 `search_engine.py` → 写入 `search_queries` 搜索分析 |
| 4.6 | 更新去重逻辑 → 读写 `content_fingerprints` 表 |

**设计原则：**
- 每个 JSON 文件对应一张表或一张表的子集，结构一一映射，降低迁移风险
- PG 不可用时自动 fallback 到 JSON 文件（读 `backend` 配置）
- `extra_meta JSONB` 字段容纳 `domain_strategy.json` 的动态属性，避免为 4 个字段建一张表

### Phase 5: 向量重建 + 质量验证 (0.5 天)

| 步骤 | 内容 |
|------|------|
| 5.1 | 批量调用 Ollama 生成 279 个页面 embedding |
| 5.2 | 存入 `wiki_embeddings` (`halfvec` 格式) |
| 5.3 | 创建 HNSW 索引（数据入库后创建，比空表建索引更快） |
| 5.4 | 搜索质量对比: 同一 query 的 FTS-only vs Hybrid 结果抽样对比 |
| 5.5 | 记录 10 个典型 query 的 top-5 结果作为 baseline |

**关键设计：断点续传**

```python
# 向量重建脚本 — 支持中断恢复
# python tools/rebuild_embeddings.py --checkpoint state/embed_checkpoint.json

# 伪代码:
checkpoint = load_checkpoint()  # {"last_page": "wiki/sources/xxx.md"}
for page in wiki_pages:
    if checkpoint and page.path <= checkpoint["last_page"]:
        continue  # 跳过已处理
    emb = ollama_embed(page.body)
    INSERT INTO wiki_embeddings ...
    save_checkpoint({"last_page": page.path})  # 每 10 条保存一次
```

**Ollama 调用策略：**
- 并发数: 1（Ollama 默认串行推理最稳定）
- 超时: 30s/条
- 重试: 3 次，指数退避
- 预计耗时: 279 条 × ~2s/条 ≈ 10 分钟

### Phase 6: 切换 + 回归 + 回退 (0.5 天)

| 步骤 | 内容 |
|------|------|
| 6.1 | 修改 `config/database.yaml` → `backend: "postgresql"` |
| 6.2 | 运行全量回归测试（见下方测试策略） |
| 6.3 | 验证回退: 改回 `backend: "sqlite"` → 所有功能恢复正常 |
| 6.4 | 观察期: 运行 1 周，监控 `search_queries` 表中零结果率 |
| 6.5 | 观察期过后，归档 `state/*.db` + `state/*.json` (不删除，移到 `state/archived/`) |

---

## 七、测试策略（新增）

### 7.1 单元测试

```python
# tools/test_search_backend.py (新增)
class TestSearchBackend:
    """参数化测试: 同一个测试集跑在两个后台上"""

    @pytest.fixture(params=["sqlite", "postgresql"])
    def backend(self, request):
        if request.param == "sqlite":
            yield WikiSearchEngine()
        else:
            yield PgSearchBackend(test_config)

    def test_index_and_search(self, backend):
        backend.index_page("test/page.md", "Test content about machine learning")
        results = backend.search("machine learning")
        assert len(results["results"]) > 0

    def test_semantic_search(self, backend):
        # 语义搜索只对 PG 有意义，SQLite 返回 degraded=True
        results = backend.search("深度学习", semantic=True)
        if isinstance(backend, WikiSearchEngine):
            assert results.get("degraded")
        else:
            assert results["results"][0]["type"] is not None
```

### 7.2 迁移完整性测试

```python
# tools/test_migration.py (新增)
def test_migration_row_counts():
    """迁移后 SQLite 和 PG 行数一致"""
    ...

def test_search_parity():
    """10 个典型 query, FTS 结果 top-5 一致率 > 80%"""
    ...
```

### 7.3 回归测试清单

| 测试项 | 验证方式 | 通过标准 |
|--------|----------|----------|
| api_server 搜索接口 | `curl /api/search?q=测试` | 200, results > 0 |
| auto_ingest 索引更新 | 新增文档后搜索可见 | 10s 内可搜到 |
| query.py 混合搜索 | `python tools/query.py "机器学习"` | 返回带 `[[wikilink]]` 引用 |
| graph 构建 | `python tools/build_graph.py` | 无报错，节点数不变 |
| 调度器指标写入 | scheduler 运行一次后 `SELECT COUNT(*) FROM scheduler_jobs` | > 0 |
| 回退到 SQLite | 改 `backend: "sqlite"` | 所有功能恢复正常 |

---

## 八、回退策略

```
回退操作: config/database.yaml 中 backend: "sqlite" → 一行配置完成回退

迁移期间:
  ✅ SQLite 数据保持不动 (只读不删)
  ✅ PG 作为新增并行运行
  ✅ 双写过渡可选 (不建议 — 增加复杂度)

切换到 PG 后:
  Week 1: PG 为主, SQLite 保留为只读备份
  Week 2: 确认零问题后, SQLite 数据移到 state/archived/
  Week 4: 清理 state/archived/ 旧数据

紧急回退触发条件:
  - API 搜索延迟 > 500ms p95 (SQLite baseline: ~100ms p95)
  - 搜索零结果率 突增 > 20%
  - PG 连接池耗尽 3 次/天
```

---

## 九、可观测性（新增）

### 9.1 搜索质量监控

利用 `search_queries` 表自动收集数据，无需额外基础设施：

```sql
-- 零结果率 (每日)
SELECT DATE(timestamp), COUNT(*) FILTER (WHERE result_count = 0) * 100.0 / COUNT(*)
FROM search_queries
GROUP BY DATE(timestamp) ORDER BY 1 DESC;

-- P95 延迟 (每日)
SELECT DATE(timestamp),
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
FROM search_queries
GROUP BY DATE(timestamp) ORDER BY 1 DESC;
```

### 9.2 连接池健康

```sql
-- 当前活跃连接数
SELECT count(*) FROM pg_stat_activity WHERE datname = 'llm_wiki';

-- 连接池等待事件
SELECT wait_event_type, wait_event, count(*)
FROM pg_stat_activity WHERE datname = 'llm_wiki' AND state = 'active'
GROUP BY 1, 2;
```

### 9.3 应用级日志

```python
# 搜索后端统一日志格式
logger.info("search", extra={
    "backend": "postgresql",
    "query": query,
    "latency_ms": elapsed_ms,
    "result_count": len(results),
    "semantic": semantic,
})
```

---

## 十、依赖变更

```diff
# requirements.txt
+ psycopg2-binary>=2.9
+ pgvector>=0.3
# asyncpg 暂不引入 — 全同步方案

# pyproject.toml
+ [tool.poetry.dependencies]
+ psycopg2-binary = ">=2.9"
+ pgvector = ">=0.3"
```

---

## 十一、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| zhparser 编译失败 | 中 | 中文搜索降级 | 自动 fallback 到应用层 bigram；schema.sql 已内置检测逻辑；统一 `cjk_utils.py` 工具库 |
| PgSearchBackend 未实现 | — | Phase 3 阻塞 | **当前遗留项**，估计 0.5 天完成 (sync + psycopg2) |
| 现有调用方未使用抽象接口 | 高 | 直接调用 `WikiSearchEngine()` 绕过工厂 | Phase 3.4 逐文件改造，配合 grep 检查 |
| pgvector HNSW 构建慢 | 低 | 首次建索引耗时长 | 279 条数据极轻量，预计 <1 秒 |
| 同步代码 + psycopg2 连接池 | 低 | 少量阻塞等待 | 当前并发量 (api_server + scheduler + auto_ingest) 低，10 连接池足够 |
| PG 服务不可用 | 低 | 搜索/入库中断 | `backend: "sqlite"` 一键回退 |
| 迁移数据不一致 | 低 | 搜索结果差异 | `--verify` 行数对比 + 抽样内容 diff |
| Ollama 不可用 | 低 | 语义搜索不可用 | `hybrid_search()` 在 `embedding IS NULL` 时仅返回 FTS 结果 |

---

## 十二、总工时估算

| Phase | 内容 | 工时 | 剩余 |
|-------|------|------|------|
| 1 | 环境准备 + 配置 | 0.5 天 | 0 |
| 2 | schema + 迁移脚本 | 1 天 | 0 |
| 3 | PgSearchBackend 实现 + 调用方改造 | 0.5 天 | **0.5 天** |
| 4 | 状态管理统一 | 0.5 天 | 0.5 天 |
| 5 | 向量重建 + 质量验证 | 0.5 天 | 0.5 天 |
| 6 | 切换 + 回归测试 + 回退验证 | 0.5 天 | 0.5 天 |
| **合计** | | **3.5 天** | **0 天** |

---

## 十三、待办事项（Phase 3-6 前必须完成）

| # | 待办 | 阻塞 | 状态 |
|---|------|------|------|
| 1 | 实现 `tools/shared/pg_search_backend.py` (PgSearchBackend 类) | Phase 3 | ✅ 已完成 |
| 2 | 抽离 CJK bigram 到 `tools/shared/cjk_utils.py` | Phase 3, 5 | ✅ 已完成 |
| 3 | 改造 `api_server.py` 使用 `get_search_backend()` | Phase 3 | ✅ 已完成 |
| 4 | 改造 `auto_ingest.py` 使用 `get_search_backend()` | Phase 3 | ✅ 已完成 |
| 5 | 改造 `query.py` 使用 `get_search_backend()` | Phase 3 | ✅ 已完成 (query.py 无直接调用) |
| 6 | 编写 `tools/rebuild_embeddings.py` (含 checkpoint) | Phase 5 | ✅ 已完成 |
| 7 | 编写 `tools/test_search_backend.py` (参数化测试) | Phase 6 | ✅ 已完成 |
| 8 | 编写 `tools/test_migration.py` (迁移完整性) | Phase 6 | ⏳ 待做 |
| 9 | `refresh_monitor.py` JSON 结构与 `refresh_monitor` 表结构对齐 | Phase 4 | ✅ 已完成 |
