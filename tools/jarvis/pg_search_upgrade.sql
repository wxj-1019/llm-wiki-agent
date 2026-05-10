-- ============================================================
-- PG Search Upgrade: A+B Combined
-- A: 检索性能 + 接口增强
-- B: 增量更新支持 (hash列)
-- ============================================================

-- ----------------------------------------------------------
-- B1: 添加 content_hash 列用于增量更新检测
-- ----------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wiki_pages' AND column_name = 'content_hash'
    ) THEN
        ALTER TABLE wiki_pages ADD COLUMN content_hash TEXT;
        COMMENT ON COLUMN wiki_pages.content_hash IS 'SHA256 of stripped body for incremental embedding detection';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wiki_embeddings' AND column_name = 'content_hash'
    ) THEN
        ALTER TABLE wiki_embeddings ADD COLUMN content_hash TEXT;
        COMMENT ON COLUMN wiki_embeddings.content_hash IS 'SHA256 of content at time of embedding';
    END IF;
END $$;

-- ----------------------------------------------------------
-- A1: 搜索配置表
-- ----------------------------------------------------------
DROP TABLE IF EXISTS wiki_search_config CASCADE;
CREATE TABLE wiki_search_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO wiki_search_config (key, value, description) VALUES
    ('hnsw.ef_search', '64', 'HNSW query-time neighbor expansion factor'),
    ('vec_default_limit', '20', 'Default vector search result limit'),
    ('fts_default_limit', '20', 'Default full-text search result limit'),
    ('hybrid_default_fts_weight', '0.6', 'Default FTS weight in hybrid search'),
    ('hybrid_default_vec_weight', '0.4', 'Default vector weight in hybrid search'),
    ('quality_score_threshold', '0.3', 'Minimum quality_score for high-confidence results')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- ----------------------------------------------------------
-- Helper: get config value
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION wiki_config(_key TEXT)
RETURNS TEXT AS $$
DECLARE
    _val TEXT;
BEGIN
    SELECT value INTO _val FROM wiki_search_config WHERE key = _key;
    RETURN COALESCE(_val, '');
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------
-- Helper: dynamic ef_search setter
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION set_hnsw_ef(_limit INT)
RETURNS VOID AS $$
BEGIN
    -- ef_search should be >= limit, typically 2-4x
    PERFORM set_config('hnsw.ef_search', GREATEST(_limit * 3, 64)::TEXT, true);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------
-- A2: semantic_search - Pure vector semantic search
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding HALFVEC,
    result_limit INT DEFAULT NULL,
    min_score REAL DEFAULT 0.0
)
RETURNS TABLE(
    path TEXT,
    title TEXT,
    page_type TEXT,
    excerpt TEXT,
    similarity REAL,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    _limit INT := COALESCE(result_limit, wiki_config('vec_default_limit')::INT);
BEGIN
    PERFORM set_hnsw_ef(_limit);

    RETURN QUERY
    SELECT
        wp.path,
        wp.title,
        wp.page_type,
        LEFT(wp.body, 300) AS excerpt,
        (1 - (we.embedding <=> query_embedding))::REAL AS similarity,
        wp.updated_at
    FROM wiki_embeddings we
    JOIN wiki_pages wp ON we.page_path = wp.path
    WHERE we.embedding IS NOT NULL
      AND (1 - (we.embedding <=> query_embedding)) >= min_score
    ORDER BY we.embedding <=> query_embedding
    LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------
-- A2b: fulltext_search - Pure FTS search
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fulltext_search(
    query_text TEXT,
    result_limit INT DEFAULT NULL
)
RETURNS TABLE(
    path TEXT,
    title TEXT,
    page_type TEXT,
    excerpt TEXT,
    rank REAL,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    _limit INT := COALESCE(result_limit, wiki_config('fts_default_limit')::INT);
    ts_config TEXT := 'simple';
BEGIN
    IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'zh_cfg') THEN
        ts_config := 'zh_cfg';
    END IF;

    RETURN QUERY
    SELECT
        wp.path,
        wp.title,
        wp.page_type,
        LEFT(wp.body, 300) AS excerpt,
        ts_rank(wp.body_tsv, websearch_to_tsquery(ts_config::regconfig, query_text))::REAL AS rank,
        wp.updated_at
    FROM wiki_pages wp
    WHERE wp.body_tsv @@ websearch_to_tsquery(ts_config::regconfig, query_text)
    ORDER BY rank DESC
    LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------
-- A3: filtered_hybrid_search - Hybrid with filters
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION filtered_hybrid_search(
    query_text TEXT,
    query_embedding HALFVEC,
    filter_page_types TEXT[] DEFAULT NULL,
    filter_tags TEXT[] DEFAULT NULL,
    min_quality_score REAL DEFAULT NULL,
    result_limit INT DEFAULT 20,
    fts_weight REAL DEFAULT NULL,
    vec_weight REAL DEFAULT NULL
)
RETURNS TABLE(
    path TEXT,
    title TEXT,
    page_type TEXT,
    tags TEXT[],
    excerpt TEXT,
    hybrid_score REAL,
    fts_rank REAL,
    vec_score REAL,
    quality_score REAL,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    _fts_w REAL := COALESCE(fts_weight, wiki_config('hybrid_default_fts_weight')::REAL);
    _vec_w REAL := COALESCE(vec_weight, wiki_config('hybrid_default_vec_weight')::REAL);
    _min_q REAL := COALESCE(min_quality_score, 0.0);
    ts_config TEXT := 'simple';
BEGIN
    IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'zh_cfg') THEN
        ts_config := 'zh_cfg';
    END IF;

    PERFORM set_hnsw_ef(result_limit);

    RETURN QUERY
    WITH fts_results AS (
        SELECT
            wp.path,
            wp.title,
            wp.page_type,
            wp.tags,
            ts_rank(wp.body_tsv, websearch_to_tsquery(ts_config::regconfig, query_text)) AS fts_rank,
            LEFT(wp.body, 300) AS body_excerpt,
            wp.quality_score,
            wp.updated_at
        FROM wiki_pages wp
        WHERE wp.body_tsv @@ websearch_to_tsquery(ts_config::regconfig, query_text)
          AND (_min_q = 0.0 OR COALESCE(wp.quality_score, 0) >= _min_q)
          AND (filter_page_types IS NULL OR wp.page_type = ANY(filter_page_types))
          AND (filter_tags IS NULL OR wp.tags && filter_tags)
        LIMIT result_limit * 3
    ),
    vec_results AS (
        SELECT
            we.page_path,
            1 - (we.embedding <=> query_embedding) AS vec_score
        FROM wiki_embeddings we
        JOIN wiki_pages wp ON we.page_path = wp.path
        WHERE we.embedding IS NOT NULL
          AND (_min_q = 0.0 OR COALESCE(wp.quality_score, 0) >= _min_q)
          AND (filter_page_types IS NULL OR wp.page_type = ANY(filter_page_types))
          AND (filter_tags IS NULL OR wp.tags && filter_tags)
        ORDER BY we.embedding <=> query_embedding
        LIMIT result_limit * 3
    )
    SELECT
        COALESCE(f.path, v.page_path) AS path,
        COALESCE(f.title, '') AS title,
        COALESCE(f.page_type, 'unknown') AS page_type,
        f.tags,
        COALESCE(f.body_excerpt, '') AS excerpt,
        (_fts_w * COALESCE(f.fts_rank, 0) + _vec_w * COALESCE(v.vec_score, 0))::REAL AS hybrid_score,
        COALESCE(f.fts_rank, 0)::REAL AS fts_rank,
        COALESCE(v.vec_score, 0)::REAL AS vec_score,
        f.quality_score,
        f.updated_at
    FROM fts_results f
    FULL OUTER JOIN vec_results v ON f.path = v.page_path
    ORDER BY hybrid_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------
-- A4: search_relevance - Rerank / cross-encoder placeholder
--       Computes a refined score using simple heuristics
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION search_relevance(
    query_text TEXT,
    candidate_paths TEXT[],
    vec_weight REAL DEFAULT 0.5,
    freshness_weight REAL DEFAULT 0.1
)
RETURNS TABLE(
    path TEXT,
    base_score REAL,
    relevance_boost REAL,
    final_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.path,
        c.hybrid_score AS base_score,
        (
            -- freshness boost: newer pages get small bonus
            COALESCE(
                EXTRACT(EPOCH FROM (NOW() - c.updated_at)) / 86400.0,
                365
            ) * -0.001 * freshness_weight
            +
            -- title match bonus
            CASE WHEN LOWER(c.title) LIKE '%' || LOWER(query_text) || '%'
                 THEN 0.05 ELSE 0 END
            +
            -- quality bonus
            COALESCE(c.quality_score, 0) * 0.1
        )::REAL AS relevance_boost,
        0.0::REAL AS final_score
    FROM (
        SELECT * FROM filtered_hybrid_search(
            query_text,
            NULL::HALFVEC,  -- no vec for this helper, we take precomputed
            NULL, NULL, NULL,
            array_length(candidate_paths, 1),
            1.0, 0.0
        )
        WHERE path = ANY(candidate_paths)
    ) c;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------
-- B4: 质量评分自动计算函数
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_page_quality()
RETURNS VOID AS $$
BEGIN
    UPDATE wiki_pages
    SET quality_score = GREATEST(0.0, LEAST(1.0, (
        -- body length factor (optimal ~2000-8000 chars)
        CASE
            WHEN LENGTH(body) < 200 THEN 0.1
            WHEN LENGTH(body) < 1000 THEN 0.3 + (LENGTH(body) - 200)::REAL / 800.0 * 0.3
            WHEN LENGTH(body) < 5000 THEN 0.6 + (LENGTH(body) - 1000)::REAL / 4000.0 * 0.2
            ELSE 0.85
        END
        +
        -- has tags bonus
        CASE WHEN tags IS NOT NULL AND array_length(tags, 1) > 0 THEN 0.05 ELSE 0 END
        +
        -- has source bonus
        CASE WHEN source_url IS NOT NULL AND source_url <> '' THEN 0.05 ELSE 0 END
        +
        -- has title bonus
        CASE WHEN title IS NOT NULL AND title <> '' AND title <> path THEN 0.03 ELSE 0 END
        +
        -- link density (wikilinks) -- approximate via [[ count
        LEAST((LENGTH(body) - LENGTH(REPLACE(body, '[[', ''))) / 4.0 * 0.02, 0.07)
    )))
    WHERE quality_score IS NULL OR quality_score < 0.01;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------
-- B3: 标签清洗函数
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_wiki_tags()
RETURNS INT AS $$
DECLARE
    _updated INT := 0;
BEGIN
    -- Remove empty/null tags, trim brackets and whitespace
    WITH cleaned AS (
        SELECT
            path,
            ARRAY_AGG(DISTINCT REGEXP_REPLACE(
                REGEXP_REPLACE(TRIM(tag), '^[\[\]]+', ''),
                '[\[\]]+$', ''
            )) FILTER (WHERE TRIM(tag) <> '' AND TRIM(tag) NOT IN ('[', ']')) AS new_tags
        FROM wiki_pages,
        LATERAL UNNEST(COALESCE(tags, ARRAY[]::TEXT[])) AS tag
        GROUP BY path
    )
    UPDATE wiki_pages wp
    SET tags = c.new_tags,
        updated_at = NOW()
    FROM cleaned c
    WHERE wp.path = c.path
      AND (wp.tags IS DISTINCT FROM c.new_tags);

    GET DIAGNOSTICS _updated = ROW_COUNT;
    RETURN _updated;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------
-- B2: 孤立嵌入清理函数
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_orphan_embeddings()
RETURNS INT AS $$
DECLARE
    _deleted INT := 0;
BEGIN
    DELETE FROM wiki_embeddings we
    WHERE NOT EXISTS (
        SELECT 1 FROM wiki_pages wp WHERE wp.path = we.page_path
    );
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    RETURN _deleted;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------
-- B2: 获取需要增量更新的页面
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pages_needing_embedding_update()
RETURNS TABLE(path TEXT, title TEXT, page_type TEXT) AS $$
BEGIN
    RETURN QUERY
    -- Pages without embeddings
    SELECT wp.path, wp.title, wp.page_type
    FROM wiki_pages wp
    LEFT JOIN wiki_embeddings we ON wp.path = we.page_path
    WHERE we.page_path IS NULL

    UNION

    -- Pages whose content hash changed
    SELECT wp.path, wp.title, wp.page_type
    FROM wiki_pages wp
    JOIN wiki_embeddings we ON wp.path = we.page_path
    WHERE wp.content_hash IS NOT NULL
      AND we.content_hash IS DISTINCT FROM wp.content_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------
-- 运行一次性数据修复
-- ----------------------------------------------------------
SELECT normalize_wiki_tags() AS tags_normalized;
SELECT calculate_page_quality() AS quality_calculated;
SELECT cleanup_orphan_embeddings() AS orphans_cleaned;
