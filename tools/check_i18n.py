#!/usr/bin/env python3
"""Check i18n completeness: find unused keys, missing keys, and hardcoded strings."""
from __future__ import annotations

import json
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCALES_DIR = os.path.join(REPO_ROOT, "wiki-viewer", "src", "i18n", "locales")
SRC_DIR = os.path.join(REPO_ROOT, "wiki-viewer", "src")

KEY_PATTERN = re.compile(r"""\bt\(\s*['"]([^'"]+)['"]""")
HARD_CODED_EN = re.compile(r""">\s*([A-Z][a-z]+(?:\s+[a-z]+){1,5})\s*<""")
HARD_CODED_ZH = re.compile(r"[\u4e00-\u9fff]{2,}")


def main():
    zh_path = os.path.join(LOCALES_DIR, "zh-CN.json")
    en_path = os.path.join(LOCALES_DIR, "en.json")

    with open(zh_path, encoding="utf-8") as f:
        zh_keys = set(json.load(f).keys())
    with open(en_path, encoding="utf-8") as f:
        en_keys = set(json.load(f).keys())

    all_keys = zh_keys | en_keys

    only_zh = sorted(zh_keys - en_keys)
    only_en = sorted(en_keys - zh_keys)

    print("=== Keys only in zh-CN (missing from en) ===")
    for k in only_zh:
        print(f"  {k}")
    if not only_zh:
        print("  (none)")
    print()

    print("=== Keys only in en (missing from zh-CN) ===")
    for k in only_en:
        print(f"  {k}")
    if not only_en:
        print("  (none)")
    print()

    used_keys: set[str] = set()
    missing_refs: list[tuple[str, int, str]] = []
    hardcoded_zh: list[tuple[str, int, str]] = []

    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if d not in ("locales", "__tests__")]
        for fname in files:
            if not (fname.endswith(".tsx") or fname.endswith(".ts")):
                continue
            if ".test." in fname:
                continue
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, os.path.join(REPO_ROOT, "wiki-viewer"))
            with open(fpath, encoding="utf-8") as f:
                for i, line in enumerate(f, 1):
                    for m in KEY_PATTERN.finditer(line):
                        k = m.group(1)
                        used_keys.add(k)
                        if k not in all_keys:
                            missing_refs.append((rel, i, k))

                    # Skip lines that are already t() calls or imports
                    if "t(" in line or "import " in line or "// " in line:
                        continue
                    # Skip test files
                    if ".test." in fname:
                        continue

                    # Find hardcoded Chinese in JSX content (not in comments or imports)
                    for m in HARD_CODED_ZH.finditer(line):
                        text = m.group(0)
                        # Skip comments, imports, type annotations
                        stripped = line.strip()
                        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("import"):
                            continue
                        # Skip if it's a fallback in t() call
                        if "t(" in line and text in line:
                            continue
                        hardcoded_zh.append((rel, i, text))

    unused_keys = sorted(all_keys - used_keys)

    print(f"=== Key counts ===")
    print(f"  zh-CN.json: {len(zh_keys)} keys")
    print(f"  en.json:    {len(en_keys)} keys")
    print(f"  Used in code: {len(used_keys)} keys")
    print(f"  Unused: {len(unused_keys)} keys")
    print()

    print("=== Keys NOT used in code (first 30) ===")
    for k in unused_keys[:30]:
        print(f"  {k}")
    if len(unused_keys) > 30:
        print(f"  ... and {len(unused_keys) - 30} more")
    print()

    print("=== t() references to keys NOT in JSON ===")
    for fpath, line, k in missing_refs:
        print(f"  {fpath}:{line} -> {k}")
    if not missing_refs:
        print("  (none)")
    print()

    print("=== Hardcoded Chinese strings (non-t() usage) ===")
    for fpath, line, text in hardcoded_zh[:30]:
        print(f"  {fpath}:{line} -> {text}")
    if len(hardcoded_zh) > 30:
        print(f"  ... and {len(hardcoded_zh) - 30} more")
    if not hardcoded_zh:
        print("  (none)")


if __name__ == "__main__":
    main()
