#!/usr/bin/env python3
"""Unified logging configuration for all wiki tools.

Usage:
    from tools.shared.logging_config import get_logger
    logger = get_logger("ingest")
    logger.info("Starting ingest for %s", path)
"""
from __future__ import annotations

import logging
import sys

_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_configured: set[str] = set()


def get_logger(name: str, level: int | None = None) -> logging.Logger:
    """Get a logger with the project-standard format.

    Ensures basicConfig is called exactly once. Subsequent calls reuse
    the same root configuration.
    """
    logger = logging.getLogger(f"wiki.{name}")

    if name not in _configured:
        _configured.add(name)

        if not logger.handlers:
            handler = logging.StreamHandler(sys.stderr)
            handler.setFormatter(logging.Formatter(_FORMAT, _DATE_FORMAT))
            logger.addHandler(handler)

        logger.setLevel(level or logging.INFO)
        logger.propagate = False

    return logger
