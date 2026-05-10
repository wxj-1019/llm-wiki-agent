#!/usr/bin/env python3
"""Jarvis — autonomous knowledge-management agent subsystem."""
from __future__ import annotations

from tools.jarvis.approval import get_approval_manager, ApprovalManager
from tools.jarvis.audit import get_audit_store, AuditStore
from tools.jarvis.config import load_pg, load_yaml, reset_cache
from tools.jarvis.event_bus import get_event_bus, EventBus
from tools.jarvis.jarvis_pg import get_pg_conn, close_all
from tools.jarvis.state import get_state_store, AgentStateStore
from tools.jarvis.tool_registry import get_registry, ToolRegistry, register_tool
from tools.jarvis.types import (
    AgentState,
    AgentStatus,
    ApprovalRequest,
    Event,
    EventCategory,
    Insight,
    Plan,
    PlanStep,
    RiskLevel,
    StepStatus,
    ToolDef,
    ToolResult,
    Urgency,
)

__all__ = [
    # factories
    "get_approval_manager",
    "get_audit_store",
    "get_event_bus",
    "get_pg_conn",
    "get_registry",
    "get_state_store",
    # classes
    "AgentStateStore",
    "ApprovalManager",
    "AuditStore",
    "EventBus",
    "ToolRegistry",
    # config helpers
    "load_pg",
    "load_yaml",
    "reset_cache",
    "close_all",
    # decorators
    "register_tool",
    # types
    "AgentState",
    "AgentStatus",
    "ApprovalRequest",
    "Event",
    "EventCategory",
    "Insight",
    "Plan",
    "PlanStep",
    "RiskLevel",
    "StepStatus",
    "ToolDef",
    "ToolResult",
    "Urgency",
]
