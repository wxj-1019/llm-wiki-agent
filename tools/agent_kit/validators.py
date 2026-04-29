#!/usr/bin/env python3
"""Validate generated agent assets (SKILL.md frontmatter, MCP Server integrity)."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.config import AgentKitConfig

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

logger = logging.getLogger(__name__)

REQUIRED_SKILL_FIELDS = {"name", "description"}
OPTIONAL_SKILL_FIELDS = {"version", "generated_from", "generated_at", "model", "allowed-tools"}

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


@dataclass
class ValidationResult:
    """Result of validating a skill package."""
    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def merge(self, other: ValidationResult) -> ValidationResult:
        return ValidationResult(
            valid=self.valid and other.valid,
            errors=self.errors + other.errors,
            warnings=self.warnings + other.warnings,
        )


def validate_skill_frontmatter(skill_md_path: Path) -> ValidationResult:
    """Validate the YAML frontmatter of a SKILL.md file."""
    errors: list[str] = []
    warnings: list[str] = []

    if not skill_md_path.exists():
        return ValidationResult(valid=False, errors=[f"SKILL.md not found: {skill_md_path}"])

    text = skill_md_path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(text)
    if not match:
        return ValidationResult(valid=False, errors=["Missing YAML frontmatter (must start with '---')"])

    if yaml is None:
        warnings.append("PyYAML not installed — skipping deep frontmatter validation")
        return ValidationResult(valid=True, warnings=warnings)

    try:
        fm = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError as exc:
        return ValidationResult(valid=False, errors=[f"Invalid YAML frontmatter: {exc}"])

    # Required fields
    missing = REQUIRED_SKILL_FIELDS - set(fm.keys())
    if missing:
        errors.append(f"Missing required fields: {sorted(missing)}")

    # Type checks
    for field_name in ("name", "description", "version"):
        if field_name in fm and not isinstance(fm[field_name], str):
            errors.append(f"Field '{field_name}' must be a string, got {type(fm[field_name]).__name__}")

    # Name constraints
    if "name" in fm:
        name = fm["name"]
        if not re.match(r"^[a-z0-9_-]+$", name):
            warnings.append(f"Skill name '{name}' should use kebab-case (lowercase, hyphens, underscores)")
        if len(name) > 50:
            warnings.append(f"Skill name is very long ({len(name)} chars) — consider shortening")

    # Description quality
    if "description" in fm:
        desc = fm["description"]
        if len(desc) < 30:
            warnings.append(f"Description is very short ({len(desc)} chars) — should be 50+ for good triggering")
        if len(desc) > 2000:
            warnings.append(f"Description is very long ({len(desc)} chars) — may exceed context budgets")

    valid = len(errors) == 0
    return ValidationResult(valid=valid, errors=errors, warnings=warnings)


def validate_skill_references(skill_dir: Path) -> ValidationResult:
    """Validate the references/ directory of a skill."""
    errors: list[str] = []
    warnings: list[str] = []

    ref_dir = skill_dir / "references"
    if not ref_dir.exists():
        warnings.append("No references/ directory found")
        return ValidationResult(valid=True, warnings=warnings)

    md_files = list(ref_dir.glob("*.md"))
    if not md_files:
        warnings.append("references/ directory is empty")
    else:
        total_size = sum(f.stat().st_size for f in md_files)
        if total_size > 500 * 1024:
            warnings.append(f"references/ total size is {total_size / 1024:.0f}KB — may exceed context budgets")

    return ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)


def validate_skill_package(skill_dir: Path) -> ValidationResult:
    """Run all validations on a generated skill package."""
    skill_md = skill_dir / "SKILL.md"
    result = validate_skill_frontmatter(skill_md)
    result = result.merge(validate_skill_references(skill_dir))
    return result


def inject_frontmatter_metadata(skill_md_path: Path, config: AgentKitConfig) -> None:
    """Auto-inject generated_from and generated_at into SKILL.md frontmatter."""
    if yaml is None:
        return

    text = skill_md_path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(text)
    if not match:
        return

    try:
        fm = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        return

    from datetime import datetime, timezone
    fm["version"] = fm.get("version", "1.0.0")
    fm["generated_from"] = config.name
    fm["generated_at"] = datetime.now(timezone.utc).isoformat()

    new_fm = yaml.dump(fm, allow_unicode=True, sort_keys=False, default_flow_style=False)
    new_text = f"---\n{new_fm}---\n{text[match.end():]}"
    skill_md_path.write_text(new_text, encoding="utf-8")
    logger.debug("Injected metadata into %s", skill_md_path)
