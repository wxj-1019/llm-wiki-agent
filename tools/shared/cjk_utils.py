#!/usr/bin/env python3
"""CJK (Chinese, Japanese, Korean) text tokenization utilities.

Provides bigram tokenization for full-text search when zhparser is
unavailable.  Used by both SQLite FTS5 and PostgreSQL tsvector fallback.
"""
from __future__ import annotations


def tokenize_cjk_for_index(text: str) -> str:
    """Convert CJK text to space-separated character bigrams for FTS5 indexing.

    '量化交易系统' → '量化 化交 交易 易系 系统'
    Non-CJK text is preserved as-is.
    """
    result: list[str] = []
    cjk_buf: list[str] = []
    non_cjk_buf: list[str] = []

    def _flush_cjk():
        if not cjk_buf:
            return
        chars = "".join(cjk_buf)
        cjk_buf.clear()
        if len(chars) == 1:
            result.append(chars)
        else:
            for i in range(len(chars) - 1):
                result.append(chars[i : i + 2])

    def _flush_non_cjk():
        if non_cjk_buf:
            result.append("".join(non_cjk_buf))
            non_cjk_buf.clear()

    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            _flush_non_cjk()
            cjk_buf.append(ch)
        elif ch.isspace():
            _flush_cjk()
            _flush_non_cjk()
        else:
            if cjk_buf:
                _flush_cjk()
            non_cjk_buf.append(ch)

    _flush_cjk()
    _flush_non_cjk()
    return " ".join(r for r in result if r.strip())


def tokenize_cjk_for_query(text: str) -> str:
    """Convert CJK query text to bigram tokens for FTS5 search.

    '量化交易' → '"量化" AND "交易"'
    Single characters are kept as-is.
    """
    cjk_chars: list[str] = []
    non_cjk_parts: list[str] = []
    buf: list[str] = []
    cur_is_cjk = False

    def _flush():
        nonlocal cur_is_cjk
        if not buf:
            return
        part = "".join(buf)
        buf.clear()
        if cur_is_cjk:
            cjk_chars.append(part)
        else:
            non_cjk_parts.append(part)

    for ch in text:
        if ch.isspace():
            _flush()
            continue
        ch_is_cjk = "\u4e00" <= ch <= "\u9fff"
        if buf and ch_is_cjk != cur_is_cjk:
            _flush()
        buf.append(ch)
        cur_is_cjk = ch_is_cjk

    _flush()

    parts: list[str] = []
    for t in non_cjk_parts:
        parts.append(f'"{t}"')

    if cjk_chars:
        cjk_text = "".join(cjk_chars)
        bigrams = []
        if len(cjk_text) == 1:
            bigrams.append(cjk_text)
        else:
            for i in range(len(cjk_text) - 1):
                bigrams.append(cjk_text[i : i + 2])
        if bigrams:
            parts.append("(" + " AND ".join(f'"{bg}"' for bg in bigrams) + ")")

    if not parts:
        return f'"{text}"'
    return " AND ".join(parts)


def tokenize_cjk_bigrams(text: str) -> str:
    """Generate CJK bigrams for tsvector 'simple' config fallback.

    Used by migration scripts when zhparser is unavailable.
    Preserves non-CJK words intact; only CJK character runs are bigrammed.
    """
    if not text:
        return ""
    result: list[str] = []
    cjk_buf: list[str] = []
    word_buf: list[str] = []

    def flush_cjk():
        if not cjk_buf:
            return
        chars = "".join(cjk_buf)
        cjk_buf.clear()
        if len(chars) == 1:
            result.append(chars)
        else:
            for i in range(len(chars) - 1):
                result.append(chars[i : i + 2])

    def flush_word():
        if word_buf:
            result.append("".join(word_buf))
            word_buf.clear()

    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            flush_word()
            cjk_buf.append(ch)
        elif ch.isspace():
            flush_cjk()
            flush_word()
            # space acts as delimiter; skip adding to result
        else:
            flush_cjk()
            word_buf.append(ch)

    flush_cjk()
    flush_word()
    return " ".join(r for r in result if r.strip())
