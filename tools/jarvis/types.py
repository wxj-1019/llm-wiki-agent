from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable


class RiskLevel(enum.Enum):
    L0 = "L0"
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"
    L4 = "L4"


class EventCategory(enum.Enum):
    SYSTEM = "system"
    DATA = "data"
    USER = "user"
    EXTERNAL = "external"
    AGENT = "agent"


class AgentStatus(enum.Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


class Urgency(enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class StepStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    AWAITING_APPROVAL = "awaiting_approval"


class EventSource(str, enum.Enum):
    LOOP = "loop"
    MULTI_AGENT = "multi_agent"
    COMM_TOOLS = "comm_tools"
    SYSTEM_TOOLS = "system_tools"
    DEV_TOOLS = "dev_tools"
    KNOWLEDGE_TOOLS = "knowledge_tools"
    WEB_TOOLS = "web_tools"
    COMPOSITE_TOOLS = "composite_tools"
    PLANNER = "planner"
    LEARNER = "learner"
    SAFETY = "safety"
    APPROVAL = "approval"
    USER = "user"


@dataclass
class Event:
    name: str
    category: EventCategory
    payload: Any = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    source: str = ""
    id: str = ""

    def __post_init__(self):
        if not self.id:
            import uuid
            self.id = f"evt_{uuid.uuid4().hex[:8]}"


@dataclass
class ToolResult:
    success: bool
    data: Any = None
    error: str = ""
    duration_ms: float = 0.0
    tokens_used: dict = field(default_factory=dict)
    retryable: bool = False

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "tokens_used": self.tokens_used,
            "retryable": self.retryable,
        }


@dataclass
class ToolDef:
    name: str
    fn: Callable
    description: str
    risk_level: RiskLevel
    input_schema: dict = field(default_factory=dict)
    output_schema: dict = field(default_factory=dict)
    category: str = "general"
    call_count: int = 0
    success_count: int = 0
    fail_count: int = 0
    avg_duration_ms: float = 0.0


@dataclass
class PlanStep:
    tool_name: str
    params: dict = field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.L1
    requires_approval: bool = False
    status: StepStatus = StepStatus.PENDING
    result: ToolResult | None = None
    id: str = ""

    def __post_init__(self):
        if not self.id:
            import uuid
            self.id = f"step_{uuid.uuid4().hex[:8]}"


@dataclass
class Plan:
    steps: list[PlanStep] = field(default_factory=list)
    goal: str = ""
    cycle_id: str = ""
    parallel_groups: list[list[str]] = field(default_factory=list)

    def add_step(self, step: PlanStep):
        self.steps.append(step)

    def get_step(self, step_id: str) -> PlanStep | None:
        for s in self.steps:
            if s.id == step_id:
                return s
        return None


@dataclass
class Insight:
    description: str
    urgency: Urgency
    suggested_action: str
    tool_calls: list[dict] = field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.L1
    reasoning: str = ""


@dataclass
class ApprovalRequest:
    id: str
    step: PlanStep
    reason: str
    status: str = "pending"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    resolved_at: str = ""
    resolved_by: str = ""


@dataclass
class AgentState:
    status: AgentStatus = AgentStatus.STOPPED
    cycle_count: int = 0
    last_cycle_time: str = ""
    total_tool_calls: int = 0
    total_success: int = 0
    total_failed: int = 0
    current_plan: Plan | None = None
    pending_approvals: list[ApprovalRequest] = field(default_factory=list)
    insights: list[Insight] = field(default_factory=list)
    daily_stats: dict = field(default_factory=dict)

    def success_rate(self) -> float:
        if self.total_tool_calls == 0:
            return 0.0
        return self.total_success / self.total_tool_calls * 100
