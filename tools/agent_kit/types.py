#!/usr/bin/env python3
"""Shared type definitions for agent_kit."""
from __future__ import annotations

from typing import TypedDict, NotRequired


class WikiPage(TypedDict):
    """A parsed wiki page."""
    slug: str
    path: str
    title: str
    type: str
    tags: list[str]
    sources: list[str]
    last_updated: str
    date: str
    body: str
    body_length: int
    links: list[str]
    frontmatter: dict


class PageIndexEntry(TypedDict):
    """An entry in the page metadata index."""
    title: str
    path: str
    type: str
    tags: list[str]
    summary: str


class IndexData(TypedDict):
    """The complete search index."""
    page_index: dict[str, PageIndexEntry]
    inverted: dict[str, list[str]]
    tag_index: dict[str, list[str]]
    type_index: dict[str, list[str]]


class SearchResult(TypedDict):
    """A single search result."""
    title: str
    path: str
    type: str
    excerpt: str
    score: float


class GraphNode(TypedDict):
    """An enriched graph node."""
    id: str
    label: NotRequired[str]
    type: NotRequired[str]
    degree: int
    betweenness: float


class GraphAnalysis(TypedDict):
    """Result of graph analysis."""
    nodes: dict[str, GraphNode]
    edges: list[dict]
    communities: NotRequired[dict]
