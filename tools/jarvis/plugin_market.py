#!/usr/bin/env python3
from __future__ import annotations

import uuid
from datetime import datetime

from tools.jarvis.jarvis_pg import get_pg_conn

BUILTIN_PLUGINS: list[dict] = [
    {
        "id": "knowledge-core",
        "name": "Knowledge Core",
        "version": "1.0.0",
        "description": "Built-in knowledge management tools for wiki operations, search, and content management",
        "author": "jarvis",
        "category": "knowledge",
        "tool_count": 12,
        "risk_level": "L0",
        "source_url": "",
    },
    {
        "id": "system-ops",
        "name": "System Operations",
        "version": "1.0.0",
        "description": "System operation tools for file management, health checks, and maintenance tasks",
        "author": "jarvis",
        "category": "system",
        "tool_count": 8,
        "risk_level": "L1",
        "source_url": "",
    },
    {
        "id": "web-tools",
        "name": "Web Tools",
        "version": "1.0.0",
        "description": "Web and network tools for HTTP requests, URL fetching, and API interactions",
        "author": "jarvis",
        "category": "network",
        "tool_count": 6,
        "risk_level": "L1",
        "source_url": "",
    },
    {
        "id": "dev-tools",
        "name": "Development Tools",
        "version": "1.0.0",
        "description": "Development tools for code analysis, git operations, and build management",
        "author": "jarvis",
        "category": "development",
        "tool_count": 10,
        "risk_level": "L1",
        "source_url": "",
    },
    {
        "id": "comm-tools",
        "name": "Communication Tools",
        "version": "1.0.0",
        "description": "Communication tools for notifications, messaging, and reporting",
        "author": "jarvis",
        "category": "communication",
        "tool_count": 6,
        "risk_level": "L0",
        "source_url": "",
    },
]

_COLS = "id, name, version, description, author, category, tool_count, risk_level, source_url, installed, installed_at"


def _row_to_dict(row: tuple) -> dict:
    return {
        "id": row[0],
        "name": row[1],
        "version": row[2],
        "description": row[3],
        "author": row[4],
        "category": row[5],
        "tool_count": row[6],
        "risk_level": row[7],
        "source_url": row[8],
        "installed": row[9],
        "installed_at": str(row[10]) if row[10] else None,
    }


class PluginMarket:
    def __init__(self):
        self._seed_builtins()

    def _seed_builtins(self):
        with get_pg_conn() as conn:
            cur = conn.cursor()
            for plugin in BUILTIN_PLUGINS:
                cur.execute(
                    f"""
                    INSERT INTO jarvis_plugins ({_COLS})
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        plugin["id"],
                        plugin["name"],
                        plugin["version"],
                        plugin["description"],
                        plugin["author"],
                        plugin["category"],
                        plugin["tool_count"],
                        plugin["risk_level"],
                        plugin["source_url"],
                        True,
                        datetime.now(),
                    ),
                )
            cur.close()

    def list_plugins(self, category: str = "", installed_only: bool = False) -> list[dict]:
        query = f"SELECT {_COLS} FROM jarvis_plugins WHERE 1=1"
        params: list = []
        if category:
            query += " AND category = %s"
            params.append(category)
        if installed_only:
            query += " AND installed = TRUE"
        query += " ORDER BY name"
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()
            cur.close()
        return [_row_to_dict(r) for r in rows]

    def get_plugin(self, plugin_id: str) -> dict | None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT {_COLS} FROM jarvis_plugins WHERE id = %s", (plugin_id,))
            row = cur.fetchone()
            cur.close()
        if row is None:
            return None
        return _row_to_dict(row)

    def install_plugin(self, plugin_id: str) -> dict:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT {_COLS} FROM jarvis_plugins WHERE id = %s", (plugin_id,))
            row = cur.fetchone()
            if row is None:
                return {"success": False, "error": f"Plugin not found: {plugin_id}"}
            if row[9]:
                return {"success": False, "error": f"Plugin already installed: {plugin_id}"}
            now = datetime.now()
            cur.execute(
                "UPDATE jarvis_plugins SET installed = TRUE, installed_at = %s WHERE id = %s",
                (now, plugin_id),
            )
            cur.close()
        return {
            "success": True,
            "plugin_id": plugin_id,
            "name": row[1],
            "installed_at": now.isoformat(),
        }

    def uninstall_plugin(self, plugin_id: str) -> dict:
        builtin_ids = {p["id"] for p in BUILTIN_PLUGINS}
        if plugin_id in builtin_ids:
            return {"success": False, "error": f"Cannot uninstall built-in plugin: {plugin_id}"}
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT {_COLS} FROM jarvis_plugins WHERE id = %s", (plugin_id,))
            row = cur.fetchone()
            if row is None:
                return {"success": False, "error": f"Plugin not found: {plugin_id}"}
            if not row[9]:
                return {"success": False, "error": f"Plugin not installed: {plugin_id}"}
            cur.execute(
                "UPDATE jarvis_plugins SET installed = FALSE, installed_at = NULL WHERE id = %s",
                (plugin_id,),
            )
            cur.close()
        return {"success": True, "plugin_id": plugin_id, "name": row[1]}

    def search_plugins(self, query: str) -> list[dict]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT {_COLS} FROM jarvis_plugins WHERE name LIKE %s OR description LIKE %s ORDER BY name",
                (f"%{query}%", f"%{query}%"),
            )
            rows = cur.fetchall()
            cur.close()
        return [_row_to_dict(r) for r in rows]

    def get_plugin_stats(self) -> dict:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM jarvis_plugins")
            total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM jarvis_plugins WHERE installed = TRUE")
            installed = cur.fetchone()[0]
            cur.execute("SELECT category, COUNT(*) FROM jarvis_plugins GROUP BY category")
            by_category = {r[0]: r[1] for r in cur.fetchall()}
            cur.execute("SELECT category, COUNT(*) FROM jarvis_plugins WHERE installed = TRUE GROUP BY category")
            installed_by_category = {r[0]: r[1] for r in cur.fetchall()}
            cur.close()
        return {
            "total": total,
            "installed": installed,
            "available": total - installed,
            "by_category": by_category,
            "installed_by_category": installed_by_category,
        }

    def register_external_plugin(
        self,
        name: str,
        version: str,
        description: str,
        author: str,
        category: str,
        tool_count: int,
        risk_level: str,
        source_url: str,
    ) -> dict:
        plugin_id = f"ext_{uuid.uuid4().hex[:8]}"
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id FROM jarvis_plugins WHERE name = %s AND author = %s",
                (name, author),
            )
            existing = cur.fetchone()
            if existing:
                return {"success": False, "error": f"Plugin already registered: {existing[0]}"}
            cur.execute(
                f"""
                INSERT INTO jarvis_plugins ({_COLS})
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (plugin_id, name, version, description, author, category, tool_count, risk_level, source_url, False, None),
            )
            cur.close()
        return {"success": True, "plugin_id": plugin_id, "name": name}


_market: PluginMarket | None = None


def get_plugin_market() -> PluginMarket:
    global _market
    if _market is None:
        _market = PluginMarket()
    return _market
