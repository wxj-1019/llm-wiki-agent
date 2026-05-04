#!/usr/bin/env python3
"""Skill execution engine for LLM Wiki Agent."""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Optional

_SAFE_NAME_RE = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$')

try:
    from jinja2.sandbox import SandboxedEnvironment
    from jinja2 import FileSystemLoader
except ImportError:
    SandboxedEnvironment = None
    FileSystemLoader = None

REPO = Path(__file__).parent.parent
SKILLS_DIR = REPO / "skills"
WIKI_DIR = REPO / "wiki"


class SkillEngine:
    def __init__(self, skills_dir: Path = SKILLS_DIR, wiki_dir: Path = WIKI_DIR):
        self.skills_dir = skills_dir
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self.wiki_dir = wiki_dir
        self.registry = self._load_registry()
        if not self.registry.get("skills"):
            self._register_builtins()

    def _load_registry(self) -> dict:
        reg_path = self.skills_dir / "installed.json"
        if reg_path.exists():
            try:
                return json.loads(reg_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {"version": 1, "skills": []}

    def _save_registry(self):
        (self.skills_dir / "installed.json").write_text(
            json.dumps(self.registry, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def list_skills(self) -> list[dict]:
        return self.registry.get("skills", [])

    def get_skill(self, name: str) -> Optional[dict]:
        for s in self.registry.get("skills", []):
            if s["name"] == name:
                return s
        return None

    def install(self, name: str, source: str = "generated", **kwargs) -> dict:
        if not _SAFE_NAME_RE.match(name):
            return {"error": f"Invalid skill name: {name}. Use only alphanumeric, hyphens, underscores (2-64 chars)"}
        skill_dir = self.skills_dir / name
        skill_dir.mkdir(parents=True, exist_ok=True)

        if source == "generated":
            code = kwargs.get("code", "")
            if code:
                (skill_dir / "SKILL.md").write_text(code, encoding="utf-8")
        elif source == "local":
            path = kwargs.get("path", "")
            if path:
                src = (REPO / path).resolve()
                if not src.exists():
                    return {"error": f"Local path not found: {path}"}
                try:
                    src.relative_to(REPO.resolve())
                except ValueError:
                    return {"error": "Invalid path: must be within repository"}
                import shutil
                shutil.copytree(str(src), str(skill_dir), dirs_exist_ok=True)

        entry = {
            "name": name,
            "version": kwargs.get("version", "1.0.0"),
            "description": kwargs.get("description", ""),
            "source": source,
            "enabled": True,
            "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "usage_count": 0,
            "last_used": None,
        }
        # Remove existing entry if present
        self.registry["skills"] = [s for s in self.registry["skills"] if s["name"] != name]
        self.registry["skills"].append(entry)
        self._save_registry()
        return {"name": name, "status": "installed"}

    def uninstall(self, name: str) -> dict:
        skill_dir = self.skills_dir / name
        if skill_dir.exists():
            import shutil
            shutil.rmtree(str(skill_dir))
        self.registry["skills"] = [s for s in self.registry["skills"] if s["name"] != name]
        self._save_registry()
        return {"status": "uninstalled", "name": name}

    def enable(self, name: str) -> dict:
        for s in self.registry.get("skills", []):
            if s["name"] == name:
                s["enabled"] = True
                s["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                self._save_registry()
                return {"name": name, "enabled": True}
        return {"error": f"Skill not found: {name}"}

    def disable(self, name: str) -> dict:
        for s in self.registry.get("skills", []):
            if s["name"] == name:
                s["enabled"] = False
                s["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                self._save_registry()
                return {"name": name, "enabled": False}
        return {"error": f"Skill not found: {name}"}

    def match_trigger(self, user_input: str) -> list[dict]:
        candidates = []
        for skill in self.registry.get("skills", []):
            if not skill.get("enabled", True):
                continue
            config = self._load_skill_config(skill["name"])
            for trigger in config.get("triggers", []):
                if user_input.lower().startswith(trigger.lower()):
                    candidates.append({"skill": skill, "config": config, "match": trigger})
        # Sort by priority descending
        candidates.sort(key=lambda c: c["config"].get("priority", 0), reverse=True)
        return candidates

    def execute(self, name: str, user_input: str):
        config = self._load_skill_config(name)
        skill_dir = self.skills_dir / name

        # Update usage stats
        for s in self.registry.get("skills", []):
            if s["name"] == name:
                s["usage_count"] = s.get("usage_count", 0) + 1
                s["last_used"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                break
        self._save_registry()

        context_pages = self._collect_context(user_input, config)
        system_prompt = self._render_prompt(skill_dir, "system.md", {
            "wiki_context": context_pages,
            "config": config,
        })
        user_prompt = self._render_prompt(skill_dir, "user.md", {
            "input": user_input,
            "wiki_context": context_pages,
        })

        # Return a structured result for the API layer to stream
        return {
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "config": config,
            "context_pages": context_pages,
        }

    def _collect_context(self, query: str, config: dict) -> list[dict]:
        max_pages = config.get("parameters", {}).get("max_context_pages", 5)
        max_file_size = 500_000  # 500KB limit per file
        max_scanned = 500  # Limit total files scanned to avoid excessive I/O
        results = []
        q = query.lower()
        keywords = q.split()
        scored = []
        scanned = 0
        for p in self.wiki_dir.rglob("*.md"):
            if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
                continue
            scanned += 1
            if scanned > max_scanned:
                break
            try:
                if p.stat().st_size > max_file_size:
                    continue
                content = p.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            content_lower = content.lower()
            # Simple relevance scoring: title match + keyword frequency
            score = 0
            rel_path = str(p.relative_to(self.wiki_dir)).lower()
            for kw in keywords:
                if kw in rel_path:
                    score += 10
                score += content_lower.count(kw)
            if score > 0:
                scored.append((score, {"path": str(p.relative_to(self.wiki_dir)), "content": content}))
        # Sort by relevance descending and take top results
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:max_pages]]

    def _render_prompt(self, skill_dir: Path, template_name: str, context: dict) -> str:
        prompts_dir = skill_dir / "prompts"
        if not (prompts_dir / template_name).exists():
            return ""
        if SandboxedEnvironment is None:
            return (prompts_dir / template_name).read_text(encoding="utf-8")
        env = SandboxedEnvironment(loader=FileSystemLoader(str(prompts_dir)))
        template = env.get_template(template_name)
        return template.render(**context)

    def _load_skill_config(self, name: str) -> dict:
        config_path = self.skills_dir / name / "config.json"
        if config_path.exists():
            try:
                return json.loads(config_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def get_skill_detail(self, name: str) -> dict:
        skill = self.get_skill(name)
        if not skill:
            return {"error": f"Skill not found: {name}"}
        skill_dir = self.skills_dir / name
        detail = {"meta": skill, "files": {}}
        for fname in ("SKILL.md", "config.json"):
            fpath = skill_dir / fname
            if fpath.exists():
                detail["files"][fname] = fpath.read_text(encoding="utf-8")
        prompts_dir = skill_dir / "prompts"
        if prompts_dir.exists():
            for p in prompts_dir.iterdir():
                if p.is_file():
                    detail["files"][f"prompts/{p.name}"] = p.read_text(encoding="utf-8")
        return detail

    def save_skill_file(self, name: str, path: str, content: str) -> dict:
        if not _SAFE_NAME_RE.match(name):
            return {"error": f"Invalid skill name: {name}"}
        skill_dir = self.skills_dir / name
        if not skill_dir.exists():
            return {"error": f"Skill not found: {name}"}
        # Normalize path to prevent traversal
        safe_path = path.lstrip("/\\")
        if not safe_path or ".." in safe_path:
            return {"error": "Invalid path"}
        target = (skill_dir / safe_path).resolve()
        try:
            target.relative_to(skill_dir.resolve())
        except ValueError:
            return {"error": "Invalid path"}
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"ok": True, "path": safe_path}


    def _register_builtins(self):
        """Register built-in skills from the templates directory."""
        builtins = [
            {
                "name": "wiki-query",
                "version": "1.0.0",
                "description": "基于 wiki 知识库回答用户问题",
                "source": "builtin",
                "enabled": True,
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "usage_count": 0,
                "last_used": None,
            },
            {
                "name": "document-ingest",
                "version": "1.0.0",
                "description": "将文档摄入到 wiki 知识库",
                "source": "builtin",
                "enabled": True,
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "usage_count": 0,
                "last_used": None,
            },
            {
                "name": "knowledge-graph",
                "version": "1.0.0",
                "description": "构建或重建知识图谱",
                "source": "builtin",
                "enabled": True,
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "usage_count": 0,
                "last_used": None,
            },
            {
                "name": "content-lint",
                "version": "1.0.0",
                "description": "对 wiki 内容进行质量检查",
                "source": "builtin",
                "enabled": True,
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "usage_count": 0,
                "last_used": None,
            },
        ]
        self.registry["skills"] = builtins
        self._save_registry()


# Singleton instance
_skill_engine: Optional[SkillEngine] = None


def get_skill_engine() -> SkillEngine:
    global _skill_engine
    if _skill_engine is None:
        _skill_engine = SkillEngine()
    return _skill_engine
