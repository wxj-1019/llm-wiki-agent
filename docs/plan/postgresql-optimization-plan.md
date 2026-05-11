# PostgreSQL + pgvector 迁移后优化方案

> 生成日期: 2026-05-11
> 适用版本: PostgreSQL 17.5 + pgvector 0.8.2
> 数据规模: 280 wiki pages, ~3MB

---

## 一、现状诊断

### 1.1 数据库状态快照

```
PostgreSQL 17.5 on x86_64-windows
shared_buffers: 128MB        ← ⚠️ 严重偏低
vector extension: 0.8.2      ← ⚠️ 建议升级
zhparser: 未安装              ← ⚠️ CJK 搜索性能受限
wiki_pages: 280 rows, 3.1MB
wiki_embeddings: 0 rows      ← 🔴 向量数据未迁移
```

### 1.2 关键问题清单

| 优先级 | 问题 | 影响 |
|--------|------|------|
| P0 | shared_buffers 仅 128MB | 频繁的磁盘 I/O，查询延迟高 |
| P0 | wiki_embeddings 为空 | 混合搜索退化为纯 FTS |
| P1 | pgvector 0.8.2 较老 | 缺少 0.8.4+ 的性能修复 |
| P1 | 无 zhparser | CJK 搜索需应用层 bigram，CPU 开销大 |
| P2 | 无连接池监控 | 无法诊断连接泄漏 |
| P2 | 无表级统计信息更新 | 查询计划器可能选择次优计划 |

---

## 二、优化方案总览

### 2.1 优化矩阵

| 优化域 | 具体措施 | 预期收益 | 实施复杂度 |
|--------|----------|----------|------------|
| **PG 内存配置** | shared_buffers / work_mem / effective_cache_size | 查询速度提升 2-5x | 低 |
| **pgvector 升级** | 0.8.2 → 0.8.4+ | HNSW 构建速度提升 30% | 中 |
| **Embedding 迁移** | 重建 wiki_embeddings | 混合搜索可用 | 中 |
| **CJK 全文搜索** | 安装 zhparser | CJK 查询精度提升，bigram 开销消除 | 中 |
| **索引优化** | 复合索引 + 覆盖索引 | FTS 查询加速 | 低 |
| **混合搜索调优** | RRF + 权重动态调整 | 搜索结果质量提升 | 中 |
| **连接池** | 配置验证 + 超时设置 | 稳定性提升 | 低 |
| **统计信息** | 自动 vacuum / analyze | 查询计划器更准确 | 低 |

---

## 三、详细优化步骤

### 3.1 PostgreSQL 配置优化 (Windows)

Windows 上的 PostgreSQL 默认配置非常保守。根据 16GB 内存的常见开发机配置：

**修改 `postgresql.conf`**（位置通常在 `C:\Program Files\PostgreSQL\17\data\postgresql.conf`）：

```ini
# ═══════════════════════════════════════════════════════════════
# 内存配置
# ═══════════════════════════════════════════════════════════════
shared_buffers = 2GB                    # 默认 128MB → 2GB (1/8 内存)
effective_cache_size = 6GB              # 操作系统缓存估算
work_mem = 64MB                         # 排序/哈希操作内存
maintenance_work_mem = 512MB            # VACUUM/CREATE INDEX 内存

# ═══════════════════════════════════════════════════════════════
# 连接配置
# ═══════════════════════════════════════════════════════════════
max_connections = 200                   # Jarvis 多代理场景需要
listen_addresses = 'localhost,127.0.0.1'

# ═══════════════════════════════════════════════════════════════
# WAL / 日志配置
# ═══════════════════════════════════════════════════════════════
wal_buffers = 16MB
max_wal_size = 2GB
min_wal_size = 512MB

# 慢查询日志 (>500ms)
log_min_duration_statement = 500
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# ═══════════════════════════════════════════════════════════════
# 并行查询
# ═══════════════════════════════════════════════════════════════
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_worker_processes = 8

# ═══════════════════════════════════════════════════════════════
# 自动清理
# ═══════════════════════════════════════════════════════════════
autovacuum = on
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05
```

**重启 PostgreSQL 服务生效：**
```powershell
net stop postgresql-x64-17
net start postgresql-x64-17
```

---

### 3.2 pgvector 升级与优化

当前版本 0.8.2，建议升级到 0.8.4（修复了 HNSW 并发构建 bug）：

```sql
-- 1. 备份现有向量数据（如有）
-- 2. 升级 pgvector
```

**Windows 升级步骤：**
```powershell
# 下载对应 PG17 的 pgvector 最新版
# https://github.com/pgvector/pgvector/releases
# 解压到 C:\Program Files\PostgreSQL\17\share\extension\
# 重启服务
```

**HNSW 索引重建（优化参数）：**

当前索引参数：`m=16, ef_construction=200`

对于 768 维向量 + <100k 规模：

```sql
-- 删除旧索引
DROP INDEX IF EXISTS idx_wiki_embedding;

-- 重建优化后的 HNSW 索引
CREATE INDEX idx_wiki_embedding ON wiki_embeddings
    USING hnsw (embedding halfvec_cosine_ops)
    WITH (
        m = 32,              -- 更高 = 更准确，构建更慢
        ef_construction = 256 -- 更高 = 更准确
    );

-- 设置搜索时探索因子
ALTER SYSTEM SET hnsw.ef_search = 100;
SELECT pg_reload_conf();
```

**参数选择建议：**

| 数据规模 | m | ef_construction | ef_search |
|----------|---|-----------------|-----------|
| < 1k | 16 | 100 | 50 |
| 1k - 10k | 32 | 200 | 80 |
| 10k - 100k | 48 | 300 | 100 |
| > 100k | 64 | 400 | 150 |

---

### 3.3 Embedding 数据迁移

当前 `wiki_embeddings` 表为空，需要重建：

```bash
# 方式 1: 通过 API Server 重建
python tools/api_server.py &
curl -X POST http://127.0.0.1:8666/api/search/rebuild-embeddings

# 方式 2: 直接脚本重建
python tools/shared/pg_search_backend.py
# 在 Python 中调用 backend.rebuild_embeddings()
```

**批量重建脚本：**

```python
# tools/rebuild_embeddings_pg.py
# 已存在，执行即可
python tools/rebuild_embeddings_pg.py
```

**验证：**
```sql
SELECT COUNT(*) FROM wiki_embeddings;
-- 应等于 wiki_pages 行数 (280)
```

---

### 3.4 CJK 全文搜索优化

当前使用应用层 bigram + `simple` tsconfig，存在两个问题：
1. 无法利用 PG 的 GIN 索引优化
2. 应用层分词增加 CPU 开销

**方案：安装 zhparser**

```sql
-- zhparser 需要单独安装 PostgreSQL 扩展包
-- Windows 上可从 https://github.com/amutu/zhparser 获取编译版

-- 安装后执行：
CREATE EXTENSION IF NOT EXISTS zhparser;

-- 重建中文搜索配置
DROP TEXT SEARCH CONFIGURATION IF EXISTS zh_cfg CASCADE;
CREATE TEXT SEARCH CONFIGURATION zh_cfg (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION zh_cfg ADD MAPPING FOR n,v,a,i,e,l,j WITH simple;

-- 重建 GIN 索引
REINDEX INDEX idx_wiki_fts;

-- 更新所有页面的 tsv（让触发器使用 zh_cfg）
UPDATE wiki_pages SET body_tsv = NULL;
-- 触发器会自动重新生成
```

**如果无法安装 zhparser（备选）：**

优化应用层 bigram 的 tokenize 函数，确保 `simple` tsconfig 能正确索引：

```sql
-- 验证 simple 配置下的 CJK 搜索
SELECT to_tsvector('simple', '自然语言处理');
-- 应输出: '自然':1 '语言':2 '处理':3
```

---

### 3.5 混合搜索 (hybrid_search) 优化

当前 `hybrid_search()` 函数使用简单的权重相加，存在以下问题：

1. **分数不可比**：ts_rank (0-1) 与 cosine similarity (0-1) 的分布不同，直接相加不公平
2. **无 RRF (Reciprocal Rank Fusion)**：缺少业界标准的融合算法
3. **无类型 boost**：无法优先返回 entity/concept 页面

**优化后的 hybrid_search 函数：**

```sql
-- 优化版 hybrid_search：使用 RRF + 类型 boost
CREATE OR REPLACE FUNCTION hybrid_search_v2(
    query_text      TEXT,
    query_embedding HALFVEC,
    result_limit    INT DEFAULT 20,
    fts_k           REAL DEFAULT 60.0,     -- RRF 常数
    vec_k           REAL DEFAULT 60.0
) RETURNS TABLE (
    path            TEXT,
    title           TEXT,
    page_type       TEXT,
    excerpt         TEXT,
    hybrid_score    REAL,
    fts_rank        REAL,
    vec_score       REAL,
    updated_at      TIMESTAMPTZ
) AS $$
DECLARE
    ts_config TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'zh_cfg') THEN
        ts_config := 'zh_cfg';
    ELSE
        ts_config := 'simple';
    END IF;

    RETURN QUERY
    WITH fts_results AS (
        SELECT
            wp.path,
            wp.title,
            wp.page_type,
            ts_rank(wp.body_tsv, websearch_to_tsquery(ts_config, query_text)) AS rank,
            LEFT(wp.body, 300) AS body_excerpt,
            wp.updated_at,
            row_number() OVER (ORDER BY ts_rank(wp.body_tsv, websearch_to_tsquery(ts_config, query_text)) DESC) AS fts_rr
        FROM wiki_pages wp
        WHERE wp.body_tsv @@ websearch_to_tsquery(ts_config, query_text)
    ),
    vec_results AS (
        SELECT
            we.page_path,
            1 - (we.embedding <=> query_embedding) AS score,
            row_number() OVER (ORDER BY we.embedding <=> query_embedding) AS vec_rr
        FROM wiki_embeddings we
        WHERE we.embedding IS NOT NULL
    )
    SELECT
        COALESCE(f.path, v.page_path) AS path,
        COALESCE(f.title, '') AS title,
        COALESCE(f.page_type, 'unknown') AS page_type,
        COALESCE(f.body_excerpt, '') AS excerpt,
        -- RRF 分数: 1/(k + rank)
        (COALESCE(1.0 / (fts_k + f.fts_rr), 0.0) +
         COALESCE(1.0 / (vec_k + v.vec_rr), 0.0))::REAL *
        -- 类型 boost
        CASE COALESCE(f.page_type, 'unknown')
            WHEN 'entity' THEN 1.2
            WHEN 'concept' THEN 1.1
            WHEN 'synthesis' THEN 1.05
            ELSE 1.0
        END AS hybrid_score,
        COALESCE(f.rank, 0)::REAL AS fts_rank,
        COALESCE(v.score, 0)::REAL AS vec_score,
        f.updated_at
    FROM fts_results f
    FULL OUTER JOIN vec_results v ON f.path = v.page_path
    ORDER BY hybrid_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

**为什么用 RRF：**
- ts_rank 和 cosine 的绝对值分布不同，直接相加不公平
- RRF 只使用排名位置，天然可比
- 对两种搜索方式一视同仁，避免某一方主导

---

### 3.6 索引优化

#### 3.6.1 wiki_pages 表

```sql
-- 已有索引评估
-- ✅ idx_wiki_fts (GIN) - 必要
-- ✅ idx_wiki_type_time - 有用
-- ✅ idx_wiki_tags (GIN) - 有用
-- ⚠️ idx_wiki_source_url (partial) - 数据量少，意义不大

-- 新增：覆盖索引（避免回表）
CREATE INDEX idx_wiki_cover ON wiki_pages (path, title, page_type, updated_at);

-- 新增：标题搜索索引（用户常搜标题）
CREATE INDEX idx_wiki_title_fts ON wiki_pages
    USING GIN (to_tsvector('simple', title));

-- 如果 zhparser 可用
-- CREATE INDEX idx_wiki_title_fts_zh ON wiki_pages
--     USING GIN (to_tsvector('zh_cfg', title));
```

#### 3.6.2 wiki_embeddings 表

```sql
-- 当前只有 HNSW 索引
-- 新增：模型过滤索引（未来可能多模型）
CREATE INDEX idx_embeddings_model ON wiki_embeddings (model, updated_at DESC)
    WHERE embedding IS NOT NULL;
```

#### 3.6.3 Jarvis 表

```sql
-- 为高频查询增加复合索引
CREATE INDEX idx_jarvis_events_name_time ON jarvis_events (name, timestamp DESC);
CREATE INDEX idx_jarvis_approvals_auto ON jarvis_approvals (auto_approved, status)
    WHERE auto_approved = TRUE;
CREATE INDEX idx_jarvis_goals_priority ON jarvis_goals (status, priority, progress);
CREATE INDEX idx_jarvis_tasks_status ON jarvis_tasks (status, created_at DESC);
```

---

### 3.7 连接池优化

当前 `pg_search_backend.py` 使用 `ThreadedConnectionPool(min=2, max=10)`，在并发场景下容易耗尽。

**修改 `config/database.yaml`：**

```yaml
database:
  backend: "postgresql"
  postgresql:
    host: "localhost"
    port: 5432
    database: "llm_wiki"
    user: "postgres"
    password: "123456"
    pool_min: 5           # 增加最小连接
    pool_max: 30          # 增加最大连接
    sslmode: "prefer"
    # 新增连接超时配置
    connect_timeout: 10
    options: "-c statement_timeout=30000"  # 30s 查询超时

vector:
  dimension: 768
  index_type: "hnsw"
  hnsw:
    m: 32                # 从 16 提升到 32
    ef_construction: 256 # 从 200 提升到 256
    ef_search: 100       # 新增搜索参数

search:
  fts_weight: 0.6
  vector_weight: 0.4
  cjk_parser: "bigram_app"
  type_boosts:
    entity: 1.2
    concept: 1.1
    source: 1.0
    synthesis: 1.05
  stub_penalty: 0.7
  # 新增 RRF 参数
  rrf_k: 60.0
```

**修改 `pg_search_backend.py` 连接池配置：**

```python
# 在 __init__ 中增加连接超时和 statement_timeout
self._pool = pool.ThreadedConnectionPool(
    minconn=self._pool_min,
    maxconn=self._pool_max,
    host=config["host"],
    port=config["port"],
    dbname=config["database"],
    user=config["user"],
    password=config["password"],
    sslmode=config.get("sslmode", "prefer"),
    connect_timeout=config.get("connect_timeout", 10),
    options=f"-c statement_timeout={config.get('statement_timeout', 30000)}",
)
```

---

### 3.8 统计信息与 VACUUM 优化

迁移后必须更新统计信息，否则查询计划器会选择次优计划：

```sql
-- 更新所有表的统计信息
ANALYZE wiki_pages;
ANALYZE wiki_embeddings;
ANALYZE jarvis_events;
ANALYZE jarvis_approvals;
ANALYZE jarvis_goals;
ANALYZE jarvis_tasks;

-- 重建索引（消除膨胀）
REINDEX INDEX CONCURRENTLY idx_wiki_fts;
REINDEX INDEX CONCURRENTLY idx_wiki_embedding;
```

---

### 3.9 监控视图

创建监控视图，便于日常巡检：

```sql
-- 表大小监控
CREATE OR REPLACE VIEW v_table_sizes AS
SELECT
    schemaname,
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||relname)) AS index_size,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;

-- 索引使用监控
CREATE OR REPLACE VIEW v_index_usage AS
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 慢查询监控（需开启 log_min_duration_statement）
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT
    query,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(stddev_exec_time::numeric, 2) AS stddev_ms,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**启用 pg_stat_statements（如需慢查询监控）：**

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

并在 `postgresql.conf` 中：
```ini
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
```

---

## 四、实施路线图

### Phase 1: 基础优化（立即执行，30 分钟）

1. [ ] 修改 `postgresql.conf`（内存 + WAL + 日志）
2. [ ] 重启 PostgreSQL 服务
3. [ ] 执行 `ANALYZE` 更新统计信息
4. [ ] 验证 `shared_buffers` 生效

### Phase 2: 向量层优化（1 小时）

1. [ ] 升级 pgvector 到 0.8.4+
2. [ ] 重建 HNSW 索引（m=32, ef_construction=256）
3. [ ] 执行 `python tools/rebuild_embeddings_pg.py`
4. [ ] 验证 `wiki_embeddings` 行数 = `wiki_pages` 行数

### Phase 3: 搜索优化（1 小时）

1. [ ] 尝试安装 zhparser
2. [ ] 创建 `hybrid_search_v2()` 函数
3. [ ] 更新 `pg_search_backend.py` 使用新函数
4. [ ] 运行搜索测试验证结果质量

### Phase 4: 索引与监控（30 分钟）

1. [ ] 创建覆盖索引和复合索引
2. [ ] 创建监控视图
3. [ ] 更新 `config/database.yaml` 连接池参数
4. [ ] 重启后端验证连接池

---

## 五、验证清单

```sql
-- 1. 配置验证
SHOW shared_buffers;              -- 应 >= 1GB
SHOW work_mem;                    -- 应 >= 32MB
SHOW max_connections;             -- 应 >= 100

-- 2. 扩展验证
SELECT * FROM pg_extension WHERE extname IN ('vector', 'zhparser');

-- 3. 向量数据验证
SELECT COUNT(*) FROM wiki_embeddings;
SELECT COUNT(*) FROM wiki_pages;
-- 两者应相等

-- 4. 混合搜索验证
SELECT * FROM hybrid_search_v2(
    'transformer architecture',
    (SELECT embedding FROM wiki_embeddings LIMIT 1),
    5
);

-- 5. CJK 搜索验证（安装 zhparser 后）
SELECT * FROM hybrid_search_v2(
    '自然语言处理',
    (SELECT embedding FROM wiki_embeddings LIMIT 1),
    5
);

-- 6. 索引使用验证
SELECT * FROM v_index_usage WHERE scans = 0;
-- 长期 scans=0 的索引应考虑删除

-- 7. 表膨胀验证
SELECT * FROM v_table_sizes WHERE dead_ratio > 20;
-- dead_ratio > 20% 需要 VACUUM FULL
```

---

## 六、性能基准

优化前后对比指标：

| 指标 | 优化前 | 优化后目标 |
|------|--------|-----------|
| FTS 查询 (simple query) | ~200ms | <50ms |
| 混合搜索 (hybrid) | 退化到 FTS | <100ms |
| HNSW 向量搜索 | N/A (无数据) | <20ms |
| CJK 搜索 (bigram) | ~300ms | <50ms (zhparser) |
| VACUUM 速度 | 慢 | 提升 3x |
| 连接建立时间 | ~100ms | <20ms (连接池) |
