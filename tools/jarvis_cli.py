#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent

sys.path.insert(0, str(REPO_ROOT))


def _ensure_tools():
    try:
        from tools.jarvis.tools.knowledge_tools import register_all
        register_all()
    except ImportError:
        pass


def cmd_start(args):
    from tools.jarvis.loop import get_agent_loop

    _ensure_tools()
    loop = get_agent_loop()

    if args.once:
        cycle_id = asyncio.run(loop.run_cycle())
        print(f"Single cycle completed: {cycle_id}")
        return

    if args.dry_run:
        events = asyncio.run(loop.perceive())
        insights = asyncio.run(loop.reason(events))
        print(f"Perceive: {len(events)} events")
        print(f"Reason: {len(insights)} insights")
        for i, insight in enumerate(insights, 1):
            print(f"  [{i}] [{insight.urgency.value}] {insight.description}")
            print(f"      Action: {insight.suggested_action}")
        return

    try:
        asyncio.run(loop.start())
    except KeyboardInterrupt:
        loop.stop()
        print("\nAgent stopped.")


def cmd_stop(args):
    from tools.jarvis.loop import get_agent_loop

    loop = get_agent_loop()
    loop.stop()
    print("Agent stopped.")


def cmd_status(args):
    from tools.jarvis.loop import get_agent_loop

    _ensure_tools()
    loop = get_agent_loop()
    status = loop.get_status()

    print(f"Status: {status['status']}")
    print(f"Cycles: {status['cycle_count']}")
    print(f"Last cycle: {status['last_cycle_time'] or 'never'}")
    print(f"Tool calls: {status['total_tool_calls']} (success={status['total_success']}, failed={status['total_failed']})")
    print(f"Success rate: {status['success_rate']}")
    print(f"Pending approvals: {status['pending_approvals']}")
    print(f"Current plan steps: {status['current_plan_steps']}")
    print(f"Insights: {status['insights_count']}")

    if args.json:
        print()
        print(json.dumps(status, indent=2, default=str))


def cmd_pause(args):
    from tools.jarvis.loop import get_agent_loop

    loop = get_agent_loop()
    loop.pause()
    print("Agent paused.")


def cmd_resume(args):
    from tools.jarvis.loop import get_agent_loop

    loop = get_agent_loop()
    loop.resume()
    print("Agent resumed.")


def cmd_tools(args):
    from tools.jarvis.tool_registry import get_registry

    _ensure_tools()
    registry = get_registry()
    tools = registry.list_tools()

    if not tools:
        print("No tools registered.")
        return

    print(f"Registered tools ({len(tools)}):\n")
    for t in tools:
        print(f"  {t.name:30s} risk={t.risk_level.value:3s}  calls={t.call_count}  category={t.category}")
        print(f"  {'':30s} {t.description}")
        print()


def cmd_approvals(args):
    from tools.jarvis.approval import get_approval_manager

    manager = get_approval_manager()

    if args.pending:
        pending = manager.list_pending()
        if not pending:
            print("No pending approvals.")
            return
        print(f"Pending approvals ({len(pending)}):\n")
        for req in pending:
            print(f"  ID: {req.id}")
            print(f"  Tool: {req.step.tool_name}")
            print(f"  Risk: {req.step.risk_level.value}")
            print(f"  Reason: {req.reason}")
            print(f"  Created: {req.created_at}")
            print()
        return

    if args.approve:
        req = manager.get(args.approve)
        if req is None:
            print(f"Approval request '{args.approve}' not found.")
            return
        manager.approve(args.approve, resolved_by="cli")
        print(f"Approved: {args.approve}")
        return

    if args.reject:
        req = manager.get(args.reject)
        if req is None:
            print(f"Approval request '{args.reject}' not found.")
            return
        manager.reject(args.reject, resolved_by="cli")
        print(f"Rejected: {args.reject}")
        return

    all_requests = manager.list_all()
    if not all_requests:
        print("No approval requests.")
        return
    print(f"All approval requests ({len(all_requests)}):\n")
    for req in all_requests:
        print(f"  {req.id:20s} tool={req.step.tool_name:20s} risk={req.step.risk_level.value:3s} status={req.status}")
    print()


def cmd_events(args):
    from tools.jarvis.event_bus import get_event_bus

    bus = get_event_bus()
    limit = args.limit or 20
    events = bus.get_recent(limit=limit)

    if not events:
        print("No events found.")
        return

    print(f"Recent events ({len(events)}):\n")
    for evt in events:
        payload_preview = ""
        if evt.payload:
            p = json.dumps(evt.payload, default=str)
            payload_preview = p[:100] + "..." if len(p) > 100 else p
        print(f"  [{evt.category.value:8s}] {evt.name}")
        print(f"  {'':10s} id={evt.id} time={evt.timestamp}")
        if payload_preview:
            print(f"  {'':10s} {payload_preview}")
        print()


def main():
    parser = argparse.ArgumentParser(
        prog="jarvis",
        description="Jarvis autonomous agent CLI",
    )
    subparsers = parser.add_subparsers(dest="command")

    start_parser = subparsers.add_parser("start", help="Start the agent loop")
    start_parser.add_argument("--once", action="store_true", help="Run a single cycle")
    start_parser.add_argument("--dry-run", action="store_true", help="Perceive+reason only, no execute")
    start_parser.set_defaults(func=cmd_start)

    stop_parser = subparsers.add_parser("stop", help="Stop the running agent")
    stop_parser.set_defaults(func=cmd_stop)

    status_parser = subparsers.add_parser("status", help="Show agent status")
    status_parser.add_argument("--json", action="store_true", help="Output as JSON")
    status_parser.set_defaults(func=cmd_status)

    pause_parser = subparsers.add_parser("pause", help="Pause the agent")
    pause_parser.set_defaults(func=cmd_pause)

    resume_parser = subparsers.add_parser("resume", help="Resume the agent")
    resume_parser.set_defaults(func=cmd_resume)

    tools_parser = subparsers.add_parser("tools", help="List registered tools")
    tools_parser.set_defaults(func=cmd_tools)

    approvals_parser = subparsers.add_parser("approvals", help="Manage approvals")
    approvals_parser.add_argument("--pending", action="store_true", help="Show pending approvals")
    approvals_parser.add_argument("--approve", metavar="ID", help="Approve a request by ID")
    approvals_parser.add_argument("--reject", metavar="ID", help="Reject a request by ID")
    approvals_parser.set_defaults(func=cmd_approvals)

    events_parser = subparsers.add_parser("events", help="Show recent events")
    events_parser.add_argument("--limit", type=int, default=20, help="Number of events to show")
    events_parser.set_defaults(func=cmd_events)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
