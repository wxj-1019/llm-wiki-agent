#!/usr/bin/env python3
from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

import psycopg2
from psycopg2 import pool

from tools.jarvis.config import load_pg, reset_cache

_pool: pool.ThreadedConnectionPool | None = None


def _get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    cfg = load_pg()
    _pool = pool.ThreadedConnectionPool(
        minconn=cfg.get("pool_min", 2),
        maxconn=cfg.get("pool_max", 10),
        host=cfg["host"],
        port=cfg["port"],
        dbname=cfg["database"],
        user=cfg["user"],
        password=cfg["password"],
        sslmode=cfg.get("sslmode", "prefer"),
    )
    return _pool


def get_connection():
    """Get a direct PostgreSQL connection (not from pool).

    Each call creates a new connection. Caller must close() it.
    Used by jarvis modules that manage their own connection lifecycle.
    NOTE: Prefer get_pg_conn() context manager for new code.
    """
    cfg = load_pg()
    return psycopg2.connect(
        host=cfg["host"],
        port=cfg["port"],
        dbname=cfg["database"],
        user=cfg["user"],
        password=cfg["password"],
        sslmode=cfg.get("sslmode", "prefer"),
    )


@contextmanager
def get_pg_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    """Context manager yielding a PostgreSQL connection from the pool.

    Usage:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            ...
    """
    _pool = _get_pool()
    conn = _pool.getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    else:
        conn.commit()
    finally:
        _pool.putconn(conn)


def close_all() -> None:
    """Close all connections in the pool. Call on shutdown."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


def reset_config() -> None:
    reset_cache()
