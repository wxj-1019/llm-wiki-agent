#!/usr/bin/env python3
"""Execute chat schema DDL."""
import psycopg2

conn = psycopg2.connect(
    host='localhost', port=5432, dbname='llm_wiki',
    user='wiki_user', password='wiki_pass_123'
)
cur = conn.cursor()

# Chat sessions table
cur.execute("""
CREATE TABLE IF NOT EXISTS chat_sessions (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    is_default_title BOOLEAN NOT NULL DEFAULT TRUE,
    model           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    metadata_json   JSONB DEFAULT '{}'
)
""")

cur.execute("""
CREATE INDEX IF NOT EXISTS idx_chat_sessions_time
    ON chat_sessions (updated_at DESC) WHERE deleted_at IS NULL
""")

# Chat messages table
cur.execute("""
CREATE TABLE IF NOT EXISTS chat_messages (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    sources_json    JSONB,
    meta_json       JSONB,
    bookmarked      BOOLEAN NOT NULL DEFAULT FALSE,
    truncated       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_tsv     TSVECTOR
)
""")

cur.execute("""
CREATE INDEX IF NOT EXISTS idx_chat_messages_session
    ON chat_messages (session_id, created_at)
""")

cur.execute("""
CREATE INDEX IF NOT EXISTS idx_chat_messages_fts
    ON chat_messages USING GIN (content_tsv)
""")

cur.execute("""
CREATE INDEX IF NOT EXISTS idx_chat_messages_bookmark
    ON chat_messages (bookmarked) WHERE bookmarked = TRUE
""")

# FTS trigger
cur.execute("""
CREATE OR REPLACE FUNCTION chat_msg_tsv_trigger() RETURNS trigger AS $$
BEGIN
    NEW.content_tsv := to_tsvector('simple', coalesce(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
""")

cur.execute("""
DROP TRIGGER IF EXISTS chat_msg_tsv_update ON chat_messages;
CREATE TRIGGER chat_msg_tsv_update
    BEFORE INSERT OR UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION chat_msg_tsv_trigger()
""")

# Session touch trigger
cur.execute("""
CREATE OR REPLACE FUNCTION chat_session_touch() RETURNS trigger AS $$
BEGIN
    UPDATE chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
""")

cur.execute("""
DROP TRIGGER IF EXISTS chat_session_touch_trigger ON chat_messages;
CREATE TRIGGER chat_session_touch_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION chat_session_touch()
""")

conn.commit()

# Verify
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'chat_%'")
tables = [r[0] for r in cur.fetchall()]
print(f"Created tables: {tables}")

cur.execute("SELECT count(*) FROM information_schema.triggers WHERE trigger_name LIKE 'chat_%'")
triggers = cur.fetchone()[0]
print(f"Triggers: {triggers}")

cur.close()
conn.close()
print("Schema phase done!")
