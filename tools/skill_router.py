#!/usr/bin/env python3
"""
Semantic Skill Router for Kimi Code CLI

Scans installed skills and matches user intent to the best skill(s)
without requiring exact skill names.

Usage:
    python tools/skill_router.py "帮我调试这个bug"
    python tools/skill_router.py "想做个数据仪表盘"
    python tools/skill_router.py --list
    python tools/skill_router.py --interactive
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Fix Windows terminal encoding for emoji/Chinese output
if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    except Exception:
        pass


@dataclass(frozen=True)
class SkillMatch:
    name: str
    description: str
    score: int
    category: str
    trigger_keywords: List[str]
    reason: str


SKILLS_DIR = Path(os.getenv("SKILLS_DIR", str(Path.home() / ".config/agents/skills")))

# Semantic fingerprints: skill name -> (category, keywords, reason_template)
SEMANTIC_INDEX: Dict[str, Tuple[str, List[str], str]] = {
    # Debugging & QA
    "systematic-debugging": (
        "Debugging & QA",
        ["bug", "调试", "debug", "排查", "错误", "error", "crash", "failure", "失败",
         "test fails", "测试失败", "unexpected behavior", "异常行为", "root cause", "根因"],
        "'{query}' indicates a debugging scenario requiring root cause investigation",
    ),
    "requesting-code-review": (
        "Debugging & QA",
        ["review my code", "审查代码", "code review", "PR review", "评审", "帮我看看这段代码",
         "检查代码", "看看有没有问题", "review 一下"],
        "'{query}' is asking for code review before sharing work",
    ),
    "receiving-code-review": (
        "Debugging & QA",
        ["received review", "收到 review", "feedback", "反馈", "reviewer said", "评审意见",
         "address comments", "改 review", "处理反馈"],
        "'{query}' involves processing received review feedback",
    ),
    "verification-before-completion": (
        "Debugging & QA",
        ["verify", "验证", "check before done", "完成前检查", "tests pass", "测试通过",
         "ready to commit", "能提交了吗", "完成了吗", "确认一下", "跑测试"],
        "'{query}' asks for pre-completion verification",
    ),

    # Design & Frontend
    "frontend-design": (
        "Design & Frontend",
        ["design", "UI", "界面", "frontend", "前端", "build a page", "做个页面", "visual",
         "视觉", "layout", "布局", "css", "样式", "restyle", " redesign"],
        "'{query}' is a frontend design/build task",
    ),
    "dashboard": (
        "Design & Frontend",
        ["dashboard", "仪表盘", "admin panel", "管理后台", "analytics", "数据面板",
         "admin", "后台", "看板", "统计页面"],
        "'{query}' matches dashboard/admin panel construction",
    ),
    "web-prototype": (
        "Design & Frontend",
        ["prototype", "原型", "landing page", "落地页", "marketing page", "官网",
         "docs page", "文档页", "single page"],
        "'{query}' is a general web prototype task",
    ),
    "critique": (
        "Design & Frontend",
        ["design review", "设计评审", "critique", "评审设计", "what's wrong with design",
         "设计有什么问题", "review design", "评审 UI"],
        "'{query}' requests a design critique/review",
    ),
    "design-brief": (
        "Design & Frontend",
        ["design brief", "设计简报", "I-Lang", "需求文档", "structured brief", "brief"],
        "'{query}' involves parsing a structured design brief",
    ),
    "tweaks": (
        "Design & Frontend",
        ["tweak", "adjust", "调参", "调整样式", "live knobs", "实时调整", "variant",
         "变体", "微调", "参数调整", "side panel"],
        "'{query}' asks for live parameter tweaking of an HTML artifact",
    ),

    # Planning & Architecture
    "brainstorming": (
        "Planning & Architecture",
        ["brainstorm", "头脑风暴", "idea", "想法", "creative", "创意", "feature design",
         "功能设计", "explore requirements", "探索需求", "think about", "想想", "考虑一下"],
        "'{query}' needs creative exploration before implementation",
    ),
    "writing-plans": (
        "Planning & Architecture",
        ["plan", "计划", "roadmap", "路线图", "how to implement", "怎么实现", "architecture",
         "架构", "multi-step", "分步骤", "方案", "设计实现", "implementation plan"],
        "'{query}' needs a multi-step implementation plan",
    ),
    "executing-plans": (
        "Planning & Architecture",
        ["execute plan", "执行计划", "follow plan", "按计划做", "implementation plan exists",
         "执行方案", "开始实施", "按计划开发"],
        "'{query}' is about executing an existing plan",
    ),
    "dispatching-parallel-agents": (
        "Planning & Architecture",
        ["parallel tasks", "并行任务", "multiple independent", "多个独立任务", "dispatch agents",
         "分配任务", "并发", "同时做", "parallel"],
        "'{query}' involves parallel independent tasks",
    ),
    "subagent-driven-development": (
        "Planning & Architecture",
        ["subagent", "子代理", "delegate", "委派", "divide work", "分工", "agent"],
        "'{query}' involves using subagents for development",
    ),
    "finishing-a-development-branch": (
        "Planning & Architecture",
        ["finish", "收尾", "complete branch", "merge", "PR", "cleanup", "清理", "完成开发",
         "提交 PR", "合并代码", "结束开发"],
        "'{query}' is about completing and integrating work",
    ),
    "using-git-worktrees": (
        "Planning & Architecture",
        ["git worktree", "隔离开发", "feature isolation", "特性隔离", "worktree"],
        "'{query}' involves git worktree for isolated development",
    ),

    # Development Methodology
    "test-driven-development": (
        "Development Methodology",
        ["TDD", "test first", "测试先行", "write test before code", "先写测试", "red green refactor"],
        "'{query}' explicitly requests test-driven development",
    ),

    # Specialized Tools
    "mcp-builder": (
        "Specialized Tools",
        ["MCP", "model context protocol", "工具服务器", "build MCP server", "mcp server"],
        "'{query}' is about MCP server construction",
    ),
    "workflow-runner": (
        "Specialized Tools",
        ["workflow", "YAML workflow", "工作流", "agency", "orchestrator", "multi-role",
         "运行工作流", "跑 workflow"],
        "'{query}' involves YAML workflow execution",
    ),
    "writing-skills": (
        "Specialized Tools",
        ["build skill", "写 skill", "create skill", "创建技能", "skill development",
         "开发 skill", "编写技能"],
        "'{query}' is about creating or editing skills",
    ),

    # Chinese-specific
    "chinese-code-review": (
        "Chinese-Specific",
        ["中文 review", "代码评审话术", "review 沟通", "评审意见怎么写", "中文评审"],
        "'{query}' is about Chinese code review communication",
    ),
    "chinese-commit-conventions": (
        "Chinese-Specific",
        ["中文 commit", "commit 规范", "changelog 中文", "提交信息", "commit message 中文"],
        "'{query}' is about Chinese commit conventions",
    ),
    "chinese-documentation": (
        "Chinese-Specific",
        ["中文文档", "文档排版", "中英文混排", "全半角", "文案排版", "中文排版"],
        "'{query}' is about Chinese documentation formatting",
    ),
    "chinese-git-workflow": (
        "Chinese-Specific",
        ["国内 Git", "Gitee", "Coding.net", "极狐", "CNB", "镜像同步", "国内平台"],
        "'{query}' involves China-specific Git platforms",
    ),

    # Meta
    "using-superpowers": (
        "Meta",
        ["超级技能", "superpowers", "技能列表", "怎么使用技能", "skill 用法", "技能指南"],
        "'{query}' is asking about how to use skills",
    ),
    "semantic-router": (
        "Meta",
        ["自动选择", "智能路由", "语义匹配", "auto skill", "skill router", "路由"],
        "'{query}' is about automatic skill selection/routing",
    ),
}


def load_installed_skills() -> Dict[str, str]:
    """Load actually installed skills from filesystem."""
    skills: Dict[str, str] = {}
    if not SKILLS_DIR.exists():
        return skills
    for subdir in sorted(SKILLS_DIR.iterdir()):
        if subdir.is_dir():
            skill_file = subdir / "SKILL.md"
            if skill_file.exists():
                content = skill_file.read_text(encoding="utf-8")
                desc = _extract_frontmatter_description(content)
                skills[subdir.name] = desc or "(no description)"
    return skills


def _extract_frontmatter_description(content: str) -> str:
    """Extract description field from YAML frontmatter, handling multiline syntax."""
    if not content.startswith("---"):
        return ""
    parts = content.split("---", 2)
    if len(parts) < 3:
        return ""
    fm = parts[1]
    lines = fm.splitlines()
    in_desc = False
    desc_lines: List[str] = []
    # YAML block scalar indicators: |, |-, >, >-, |+, >+
    _BLOCK_SCALARS = {"|", "|-", "|+", ">", ">-", ">+"}
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("description:"):
            val = stripped.split(":", 1)[1].strip()
            if val in _BLOCK_SCALARS or val == "":
                in_desc = True
                continue
            # Single-line description (may have inline value)
            if val:
                return val.strip('"').strip("'")
        if in_desc:
            if not line.startswith(" ") and line.strip() and not line.strip().startswith("#"):
                break
            # Strip leading whitespace (YAML indentation) but keep content
            content_line = line[2:] if line.startswith("  ") else line
            if content_line.strip():
                desc_lines.append(content_line.strip())
    return " ".join(desc_lines) if desc_lines else ""


def normalize(text: str) -> str:
    """Lowercase and strip punctuation for matching."""
    return re.sub(r"[^\w\s\u4e00-\u9fff]", "", text.lower())


def match_skills(query: str, top_n: int = 3) -> List[SkillMatch]:
    """Match user query against semantic index and return top N matches."""
    norm_query = normalize(query)
    matches: List[Tuple[int, str, str, str, List[str], str]] = []

    installed = load_installed_skills()

    for skill_name, (category, keywords, reason_template) in SEMANTIC_INDEX.items():
        # Skip if not actually installed (unless it's the router itself)
        if skill_name not in installed and skill_name != "semantic-router":
            continue

        desc = installed.get(skill_name, "")
        score = 0
        matched_keywords: List[str] = []

        for kw in keywords:
            norm_kw = normalize(kw)
            if norm_kw in norm_query:
                # Exact phrase match scores higher
                score += 3
                matched_keywords.append(kw)
            elif any(part in norm_query for part in norm_kw.split() if len(part) > 1):
                # Partial word match
                score += 1
                matched_keywords.append(kw)

        if score > 0:
            reason = reason_template.format(query=query)
            matches.append((score, skill_name, desc, category, matched_keywords, reason))

    # Sort by score descending, then by name
    matches.sort(key=lambda x: (-x[0], x[1]))

    result = []
    seen = set()
    for score, name, desc, cat, kws, reason in matches:
        if name not in seen:
            seen.add(name)
            result.append(SkillMatch(
                name=name,
                description=desc,
                score=min(score, 5),  # Cap at 5
                category=cat,
                trigger_keywords=kws,
                reason=reason,
            ))
        if len(result) >= top_n:
            break

    return result


def suggest_combination(query: str, top_match: Optional[SkillMatch]) -> Optional[List[str]]:
    """Suggest skill combinations for common task patterns."""
    norm = normalize(query)

    patterns = [
        # (keywords, combination_name, skills)
        (["build", "feature", "新功能", "实现", "开发", "做个"], "Build New Feature",
         ["brainstorming", "writing-plans", "test-driven-development", "verification-before-completion"]),
        (["bug", "调试", "debug", "fix", "修复"], "Fix Bug",
         ["systematic-debugging", "test-driven-development", "verification-before-completion"]),
        (["web", "page", "ui", "frontend", "前端", "页面", "界面"], "Build Web UI",
         ["brainstorming", "frontend-design", "verification-before-completion"]),
        (["plan", "计划", "架构", "roadmap", "路线图"], "Plan Architecture",
         ["brainstorming", "writing-plans"]),
        (["review", "评审", "review代码", "审查"], "Code Review Workflow",
         ["requesting-code-review"]),
        (["finish", "complete", "收尾", "合并", "merge", "提交"], "Finish & Merge",
         ["verification-before-completion", "finishing-a-development-branch"]),
        (["parallel", "并发", "多个", "同时", "independent"], "Parallel Tasks",
         ["dispatching-parallel-agents", "subagent-driven-development"]),
    ]

    for keywords, name, skills in patterns:
        if any(normalize(kw) in norm for kw in keywords):
            return skills

    return None


def print_match(match: SkillMatch, rank: int = 1) -> None:
    """Pretty-print a skill match."""
    score = match.score
    bar = "█" * score + "░" * (5 - score)
    print(f"  {rank}. [{match.category}] {match.name}")
    print(f"     Score: {bar} ({score}/5)")
    print(f"     Matched: {', '.join(match.trigger_keywords[:5])}")
    print(f"     Why: {match.reason}")
    if match.description:
        print(f"     Desc: {match.description[:80]}...")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Semantic Skill Router")
    parser.add_argument("query", nargs="?", help="User intent query")
    parser.add_argument("--list", action="store_true", help="List all installed skills")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive mode")
    parser.add_argument("--top", type=int, default=3, help="Number of matches to show (default: 3)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.list:
        installed = load_installed_skills()
        print(f"Installed skills ({len(installed)}):")
        for name, desc in sorted(installed.items()):
            print(f"  • {name}: {desc[:60]}...")
        return 0

    if args.interactive:
        print("🔀 Semantic Skill Router — Interactive Mode")
        print("Type your intent (or 'quit' to exit):")
        while True:
            try:
                query = input("\n> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nBye!")
                return 0
            if query.lower() in ("quit", "exit", "q"):
                print("Bye!")
                return 0
            if not query:
                continue
            run_router(query, args.top, args.json)
        return 0

    if not args.query:
        parser.print_help()
        return 1

    run_router(args.query, args.top, args.json)
    return 0


def run_router(query: str, top_n: int, as_json: bool) -> None:
    """Run the router for a single query."""
    matches = match_skills(query, top_n=top_n)

    if as_json:
        data = {
            "query": query,
            "matches": [asdict(m) for m in matches],
            "combination": suggest_combination(query, matches[0] if matches else None),
        }
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return

    print(f"\n🔀 Query: \"{query}\"")
    print("=" * 50)

    if not matches:
        print("  No matching skills found.")
        print("  Try: '帮我调试', '做个页面', '写个计划', '评审代码'")
        return

    print(f"\n  Top {len(matches)} matches:\n")
    for i, m in enumerate(matches, 1):
        print_match(m, i)

    combo = suggest_combination(query, matches[0])
    if combo:
        print(f"  📋 Suggested workflow:")
        print(f"     {' → '.join(combo)}")
        print()

    print(f"  💡 To use: Invoke skill '{matches[0].name}'")
    print(f"     Or say: '用 {matches[0].name} 来 {query}'")


if __name__ == "__main__":
    sys.exit(main())
