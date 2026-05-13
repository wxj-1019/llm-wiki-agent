#!/usr/bin/env python3
from __future__ import annotations

"""Chat API endpoints for session/message CRUD + dialog search.

Imported by api_server.py as a FastAPI sub-router.
"""

import logging
import time
import json
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from tools.jarvis.config import load_pg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── Pydantic Models ──

class CreateSessionRequest(BaseModel):
    title: str = ""
    model: str | None = None

class UpdateSessionRequest(BaseModel):
    title: str | None = None
    metadata_json: dict | None = None

class AppendMessageRequest(BaseModel):
    id: str
    role: str
    content: str
    sources_json: list | None = None
    meta_json: dict | None = None
    bookmarked: bool = False
    truncated: bool = False
    created_at: str | None = None

class UpdateMessageRequest(BaseModel):
    content: str | None = None
    bookmarked: bool | None = None
    truncated: bool | None = None


# ── PG Helpers ──

def _get_pg_conn():
    """Get a fresh psycopg2 connection from config."""
    cfg = load_pg()
    return psycopg2.connect(
        host=cfg["host"],
        port=cfg["port"],
        dbname=cfg["database"],
        user=cfg["user"],
        password=cfg["password"],
        sslmode=cfg.get("sslmode", "prefer"),
    )


def _generate_id(prefix: str = "cs") -> str:
    """Generate a short nanoid-like ID."""
    import secrets
    return f"{prefix}_{secrets.token_hex(8)}"


def _row_to_dict(row) -> dict:
    """Convert a psycopg2 RealDictRow to a plain dict with ISO timestamps."""
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


# ── Session Endpoints ──

@router.get("/sessions")
def list_sessions(q: str = "", limit: int = 50, offset: int = 0):
    """List chat sessions, optionally filtered by title search."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if q:
                cur.execute("""
                    SELECT cs.*, COUNT(cm.id)::int AS message_count,
                           (SELECT cm2.content FROM chat_messages cm2
                            WHERE cm2.session_id = cs.id
                            ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_preview
                    FROM chat_sessions cs
                    LEFT JOIN chat_messages cm ON cm.session_id = cs.id
                    WHERE cs.deleted_at IS NULL AND cs.title ILIKE %s
                    GROUP BY cs.id
                    ORDER BY cs.updated_at DESC
                    LIMIT %s OFFSET %s
                """, (f"%{q}%", limit, offset))
            else:
                cur.execute("""
                    SELECT cs.*, COUNT(cm.id)::int AS message_count,
                           (SELECT cm2.content FROM chat_messages cm2
                            WHERE cm2.session_id = cs.id
                            ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_preview
                    FROM chat_sessions cs
                    LEFT JOIN chat_messages cm ON cm.session_id = cs.id
                    WHERE cs.deleted_at IS NULL
                    GROUP BY cs.id
                    ORDER BY cs.updated_at DESC
                    LIMIT %s OFFSET %s
                """, (limit, offset))
            sessions = [_row_to_dict(r) for r in cur.fetchall()]

            cur.execute("SELECT COUNT(*) FROM chat_sessions WHERE deleted_at IS NULL")
            total = cur.fetchone()["count"]
        return {"sessions": sessions, "total": total}
    except Exception as e:
        logger.exception("list_sessions failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/sessions")
def create_session(req: CreateSessionRequest):
    """Create a new chat session."""
    session_id = _generate_id("cs")
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO chat_sessions (id, title, is_default_title, model)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (session_id, req.title or "", req.title == "", req.model))
            session = _row_to_dict(cur.fetchone())
        conn.commit()
        return session
    except Exception as e:
        conn.rollback()
        logger.exception("create_session failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/sessions/{session_id}")
def get_session(session_id: str, messages_limit: int = 50):
    """Get a single session with its recent messages."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM chat_sessions WHERE id = %s AND deleted_at IS NULL",
                (session_id,),
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")

            cur.execute("""
                SELECT * FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
                LIMIT %s
            """, (session_id, messages_limit))
            messages = [_row_to_dict(r) for r in cur.fetchall()]

        return {
            "session": _row_to_dict(session),
            "messages": messages,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_session failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.patch("/sessions/{session_id}")
def update_session(session_id: str, req: UpdateSessionRequest):
    """Update session title or metadata."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM chat_sessions WHERE id = %s AND deleted_at IS NULL",
                (session_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Session not found")

            if req.title is not None:
                cur.execute(
                    "UPDATE chat_sessions SET title = %s, is_default_title = FALSE, updated_at = NOW() WHERE id = %s",
                    (req.title, session_id),
                )
            if req.metadata_json is not None:
                cur.execute(
                    "UPDATE chat_sessions SET metadata_json = %s, updated_at = NOW() WHERE id = %s",
                    (json.dumps(req.metadata_json), session_id),
                )

            cur.execute("SELECT * FROM chat_sessions WHERE id = %s", (session_id,))
            session = _row_to_dict(cur.fetchone())
        conn.commit()
        return session
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("update_session failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    """Soft-delete a session."""
    conn = _get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chat_sessions SET deleted_at = NOW() WHERE id = %s AND deleted_at IS NULL",
                (session_id,),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Session not found")
        conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("delete_session failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Message Endpoints ──

@router.get("/sessions/{session_id}/messages")
def list_messages(session_id: str, before: str = "", limit: int = 50):
    """List messages for a session with cursor-based pagination."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if before:
                cur.execute("""
                    SELECT * FROM chat_messages
                    WHERE session_id = %s AND created_at < %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (session_id, before, limit))
            else:
                cur.execute("""
                    SELECT * FROM chat_messages
                    WHERE session_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (session_id, limit))
            messages = [_row_to_dict(r) for r in cur.fetchall()]
            # Return in ascending order for display
            messages.reverse()
        return {"messages": messages}
    except Exception as e:
        logger.exception("list_messages failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/sessions/{session_id}/messages")
def append_message(session_id: str, req: AppendMessageRequest):
    """Append a message to a session."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify session exists
            cur.execute(
                "SELECT 1 FROM chat_sessions WHERE id = %s AND deleted_at IS NULL",
                (session_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Session not found")

            created_at = req.created_at if req.created_at else None
            cur.execute("""
                INSERT INTO chat_messages (id, session_id, role, content,
                    sources_json, meta_json, bookmarked, truncated, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s::timestamptz, NOW()))
                RETURNING *
            """, (
                req.id, session_id, req.role, req.content,
                json.dumps(req.sources_json) if req.sources_json else None,
                json.dumps(req.meta_json) if req.meta_json else None,
                req.bookmarked, req.truncated,
                created_at,
            ))
            message = _row_to_dict(cur.fetchone())
        conn.commit()
        return message
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("append_message failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.patch("/sessions/{session_id}/messages/{msg_id}")
def update_message(session_id: str, msg_id: str, req: UpdateMessageRequest):
    """Update a message's content, bookmark, or truncation status."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM chat_messages WHERE id = %s AND session_id = %s",
                (msg_id, session_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Message not found")

            if req.content is not None:
                cur.execute(
                    "UPDATE chat_messages SET content = %s WHERE id = %s",
                    (req.content, msg_id),
                )
            if req.bookmarked is not None:
                cur.execute(
                    "UPDATE chat_messages SET bookmarked = %s WHERE id = %s",
                    (req.bookmarked, msg_id),
                )
            if req.truncated is not None:
                cur.execute(
                    "UPDATE chat_messages SET truncated = %s WHERE id = %s",
                    (req.truncated, msg_id),
                )

            cur.execute(
                "SELECT * FROM chat_messages WHERE id = %s",
                (msg_id,),
            )
            message = _row_to_dict(cur.fetchone())
        conn.commit()
        return message
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("update_message failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/sessions/{session_id}/messages/{msg_id}")
def delete_message(session_id: str, msg_id: str):
    """Delete a single message."""
    conn = _get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM chat_messages WHERE id = %s AND session_id = %s",
                (msg_id, session_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Message not found")
        conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("delete_message failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/sessions/{session_id}/export")
def export_session(session_id: str, format: str = "markdown"):
    """Export a session as markdown, json, or text."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM chat_sessions WHERE id = %s AND deleted_at IS NULL",
                (session_id,),
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")

            cur.execute(
                "SELECT * FROM chat_messages WHERE session_id = %s ORDER BY created_at ASC",
                (session_id,),
            )
            messages = [_row_to_dict(r) for r in cur.fetchall()]

        if format == "json":
            return {"session": _row_to_dict(session), "messages": messages}
        elif format == "text":
            lines = [f"### {session['title']}\n"]
            for m in messages:
                lines.append(f"[{m['role']}]: {m['content']}\n")
            return {"format": "text", "content": "\n".join(lines)}
        else:  # markdown
            lines = [f"# {session['title']}\n", f"_Created: {session['created_at']}_\n"]
            for m in messages:
                role_label = "**User**" if m['role'] == 'user' else "**Assistant**"
                lines.append(f"\n### {role_label}\n\n{m['content']}\n")
            return {"format": "markdown", "content": "\n".join(lines)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("export_session failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Cross-Session Search ──

@router.get("/search")
def search_chat_messages(q: str = Query("", min_length=1), limit: int = 10):
    """Search across all chat messages using PG FTS."""
    conn = _get_pg_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    cm.id AS message_id,
                    cm.session_id,
                    cs.title AS session_title,
                    ts_rank(cm.content_tsv, plainto_tsquery('simple', %s)) AS rank,
                    ts_headline('simple', cm.content, plainto_tsquery('simple', %s),
                                'MaxWords=30, MinWords=15, StartSel=<<, StopSel=>>') AS excerpt,
                    cm.created_at
                FROM chat_messages cm
                JOIN chat_sessions cs ON cs.id = cm.session_id
                WHERE cm.content_tsv @@ plainto_tsquery('simple', %s)
                  AND cs.deleted_at IS NULL
                ORDER BY rank DESC
                LIMIT %s
            """, (q, q, q, limit))
            results = [_row_to_dict(r) for r in cur.fetchall()]
        return {"results": results}
    except Exception as e:
        logger.exception("search_chat_messages failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
