#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import platform
import smtplib
import subprocess
import tempfile
import uuid
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.tool_registry import register_tool
from tools.jarvis.types import Event, EventCategory, RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent.parent


def _get_event_bus():
    try:
        from tools.jarvis.event_bus import get_event_bus
        return get_event_bus()
    except ImportError:
        return None


def _load_email_config() -> dict | None:
    config_path = REPO_ROOT / "config" / "jarvis.yaml"
    if not config_path.exists():
        return None
    try:
        import yaml
        with open(config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data.get("tools", {}).get("comm", {}).get("email")
    except Exception:
        return None


def _register_notify_desktop():
    @register_tool(
        name="notify_desktop",
        description="Show a desktop notification",
        risk_level=RiskLevel.L0,
        input_schema={
            "title": {"type": "str", "required": True},
            "message": {"type": "str", "required": True},
            "timeout": {"type": "int", "required": False},
        },
        output_schema={"success": {"type": "bool"}},
        category="comm",
    )
    def notify_desktop(title: str, message: str, timeout: int = 5) -> dict:
        try:
            from plyer import notification as plyer_notify
            plyer_notify.notify(title=title, message=message, timeout=timeout)
            return {"success": True}
        except Exception:
            pass

        if platform.system() == "Windows":
            try:
                from win10toast import ToastNotifier
                toaster = ToastNotifier()
                toaster.show_toast(title, message, duration=timeout)
                return {"success": True}
            except Exception:
                pass

            try:
                vbs = f'CreateObject("WScript.Shell").Popup "{message}", {timeout}, "{title}", 64'
                tmp = tempfile.NamedTemporaryFile(
                    mode="w", suffix=".vbs", delete=False, encoding="utf-8"
                )
                tmp.write(vbs)
                tmp.close()
                subprocess.run(
                    ["cscript", "//nologo", tmp.name],
                    timeout=timeout + 5,
                    creationflags=0x08000000,
                )
                os.unlink(tmp.name)
                return {"success": True}
            except Exception:
                pass

        print(f"[NOTIFICATION] {title}: {message}")
        return {"success": True}


def _register_notify_log():
    @register_tool(
        name="notify_log",
        description="Log a message to the Jarvis event bus",
        risk_level=RiskLevel.L0,
        input_schema={
            "level": {"type": "str", "required": False},
            "message": {"type": "str", "required": True},
            "category": {"type": "str", "required": False},
        },
        output_schema={"success": {"type": "bool"}},
        category="comm",
    )
    def notify_log(level: str = "info", message: str = "", category: str = "agent") -> dict:
        bus = _get_event_bus()
        if bus is None:
            print(f"[{level.upper()}] ({category}) {message}")
            return {"success": True}
        event = Event(
            name=f"notify.{level}",
            category=EventCategory.AGENT,
            payload={"level": level, "message": message, "category": category},
            source="comm_tools",
        )
        bus.dispatch(event)
        return {"success": True}


def _register_schedule_task():
    @register_tool(
        name="schedule_task",
        description="Schedule a delayed task for later execution",
        risk_level=RiskLevel.L1,
        input_schema={
            "tool_name": {"type": "str", "required": True},
            "params": {"type": "dict", "required": True},
            "delay_seconds": {"type": "int", "required": True},
            "reason": {"type": "str", "required": False},
        },
        output_schema={
            "task_id": {"type": "str"},
            "scheduled_at": {"type": "str"},
        },
        category="comm",
    )
    def schedule_task(
        tool_name: str,
        params: dict,
        delay_seconds: int,
        reason: str = "",
    ) -> dict:
        task_id = f"sched_{uuid.uuid4().hex[:8]}"
        scheduled_at = datetime.now() + timedelta(seconds=delay_seconds)
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS jarvis_scheduled_tasks (
                    id TEXT PRIMARY KEY,
                    task_type TEXT NOT NULL,
                    payload_json JSONB,
                    scheduled_at TIMESTAMPTZ NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending'
                )
            """)
            cur.execute(
                "INSERT INTO jarvis_scheduled_tasks (id, task_type, payload_json, scheduled_at, status) VALUES (%s, %s, %s, %s, %s)",
                (task_id, tool_name, json.dumps(params), scheduled_at, "pending"),
            )
            cur.close()
        return {"task_id": task_id, "scheduled_at": scheduled_at.isoformat()}


def _register_schedule_reminder():
    @register_tool(
        name="schedule_reminder",
        description="Set a reminder that shows a desktop notification later",
        risk_level=RiskLevel.L1,
        input_schema={
            "message": {"type": "str", "required": True},
            "delay_seconds": {"type": "int", "required": True},
            "title": {"type": "str", "required": False},
        },
        output_schema={"task_id": {"type": "str"}},
        category="comm",
    )
    def schedule_reminder(
        message: str,
        delay_seconds: int,
        title: str = "Jarvis Reminder",
    ) -> dict:
        result = schedule_task(
            tool_name="notify_desktop",
            params={"title": title, "message": message},
            delay_seconds=delay_seconds,
            reason=f"Reminder: {title}",
        )
        return {"task_id": result["task_id"]}


def _register_email_send():
    @register_tool(
        name="email_send",
        description="Send an email via SMTP",
        risk_level=RiskLevel.L3,
        input_schema={
            "to": {"type": "str", "required": True},
            "subject": {"type": "str", "required": True},
            "body": {"type": "str", "required": True},
            "html": {"type": "bool", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "message": {"type": "str"}},
        category="comm",
    )
    def email_send(to: str, subject: str, body: str, html: bool = False) -> dict:
        config = _load_email_config()
        if not config:
            return {
                "success": False,
                "message": "Email not configured. Add tools.comm.email section to config/jarvis.yaml",
            }
        host = config.get("host", "")
        port = int(config.get("port", 587))
        username = config.get("username", "")
        password = config.get("password", "")
        from_addr = config.get("from", username)
        use_tls = config.get("tls", True)
        if not host or not username:
            return {
                "success": False,
                "message": "Email config incomplete: need host, username in config/jarvis.yaml",
            }
        try:
            msg = MIMEMultipart()
            msg["From"] = from_addr
            msg["To"] = to
            msg["Subject"] = subject
            if html:
                msg.attach(MIMEText(body, "html"))
            else:
                msg.attach(MIMEText(body, "plain"))
            if use_tls:
                server = smtplib.SMTP(host, port)
                server.starttls()
            else:
                server = smtplib.SMTP(host, port)
            if password:
                server.login(username, password)
            server.sendmail(from_addr, [to], msg.as_string())
            server.quit()
            return {"success": True, "message": f"Email sent to {to}"}
        except Exception as exc:
            return {"success": False, "message": str(exc)}


def _register_webhook_notify():
    @register_tool(
        name="webhook_notify",
        description="Send a notification via webhook POST",
        risk_level=RiskLevel.L2,
        input_schema={
            "url": {"type": "str", "required": True},
            "message": {"type": "str", "required": True},
            "title": {"type": "str", "required": False},
        },
        output_schema={"success": {"type": "bool"}, "status_code": {"type": "int"}},
        category="comm",
    )
    def webhook_notify(url: str, message: str, title: str = "") -> dict:
        try:
            import urllib.request
            import urllib.error
            payload = json.dumps({"message": message, "title": title}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            resp = urllib.request.urlopen(req, timeout=30)
            return {"success": True, "status_code": resp.status}
        except urllib.error.HTTPError as exc:
            return {"success": False, "status_code": exc.code}
        except Exception as exc:
            return {"success": False, "status_code": 0}


_ALL_REGISTRARS = [
    _register_notify_desktop,
    _register_notify_log,
    _register_schedule_task,
    _register_schedule_reminder,
    _register_email_send,
    _register_webhook_notify,
]


def register_all():
    for registrar in _ALL_REGISTRARS:
        try:
            registrar()
        except Exception as exc:
            print(f"WARNING: failed to register tool from {registrar.__name__}: {exc}")
