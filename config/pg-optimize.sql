-- ============================================================================
-- PostgreSQL + pgvector 迁移后优化脚本
-- 
-- 执行前请确保：
--   1. 已备份数据库
--   2. PostgreSQL 配置已优化并重启（shared_buffers >= 1GB）
--   3. pgvector 已升级到 0.8.4+
--
-- 执行方式：
--   psql -U postgres -d llm_wiki -f config/pg-optimize.sql
-- ============================================================================

\echo '=== Phase 1: 统计信息更新 ==='
ANALYZE wiki_pages;
ANALYZE wiki_embeddings;
ANALYZE jarvis_events;
ANALYZE jarvis_approvals;
ANALYZE jarvis_goals;
ANALYZE jarvis_tasks;
ANALYZE pipeline_state;
ANALYZE scheduler_jobs;

\echo '=== Phase 2: pgvector HNSW 索引重建 ==='
DROP INDEX IF EXISTS idx_wiki_embedding;

CREATE INDEX idx_wiki_embedding ON wiki_embeddings
    USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 32, ef_construction = 256);

-- 设置全局 HNSW 搜索参数
ALTER SYSTEM SET hnsw.ef_search = 100;
SELECT pg_reload_conf();

\echo '=== Phase 3: wiki_pages 索引优化 ==='
-- 覆盖索引（减少回表）
CREATE INDEX IF NOT EXISTS idx_wiki_cover ON wiki_pages (path, title, page_type, updated_at);

-- 标题 FTS 索引
CREATE INDEX IF NOT EXISTS idx_wiki_title_fts ON wiki_pages
    USING GIN (to_tsvector('simple', title));

\echo '=== Phase 4: wiki_embeddings 索引优化 ==='
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON wiki_embeddings (model, updated_at DESC)
    WHERE embedding IS NOT NULL;

\echo '=== Phase 5: Jarvis 表索引优化 ==='
CREATE INDEX IF NOT EXISTS idx_jarvis_events_name_time ON jarvis_events (name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_approvals_auto ON jarvis_approvals (auto_approved, status)
    WHERE auto_approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_jarvis_goals_priority ON jarvis_goals (status, priority, progress);
CREATE INDEX IF NOT EXISTS idx_jarvis_tasks_status ON jarvis_tasks (status, created_at DESC);

\echo '=== Phase 6: 混合搜索函数升级 (RRF) ==='
CREATE OR REPLACE FUNCTION hybrid_search_v2(
    query_text      TEXT,
    query_embedding HALFVEC,
    result_limit    INT DEFAULT 20,
    fts_k           REAL DEFAULT 60.0,
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
        (COALESCE(1.0 / (fts_k + f.fts_rr), 0.0) +
         COALESCE(1.0 / (vec_k + v.vec_rr), 0.0))::REAL *
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

\echo '=== Phase 7: 监控视图创建 ==='
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

\echo '=== Phase 8: 验证 ==='
SELECT 'wiki_pages count' AS check_item, COUNT(*)::TEXT AS value FROM wiki_pages
UNION ALL
SELECT 'wiki_embeddings count', COUNT(*)::TEXT FROM wiki_embeddings
UNION ALL
SELECT 'extensions', string_agg(extname, ', ') FROM pg_extension WHERE extname IN ('vector', 'zhparser', 'pg_stat_statements')
UNION ALL
SELECT 'shared_buffers', setting || unit FROM pg_settings WHERE name = 'shared_buffers'
UNION ALL
SELECT 'hnsw.ef_search', setting FROM pg_settings WHERE name = 'hnsw.ef_search';

\echo '=== 优化完成 ==='
