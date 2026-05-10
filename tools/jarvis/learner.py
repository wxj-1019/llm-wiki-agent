#!/usr/bin/env python3
from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timedelta

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import Insight, ToolResult
from tools.shared.llm import call_llm
from tools.shared.thresholds import get_threshold, update_threshold

SAFE_ADJUSTABLE_PREFIXES = (
    "concurrency.",
    "retry.",
    "cache_ttl.",
    "debounce",
    "timeout",
)

CRITICAL_PREFIXES = (
    "budget.",
    "circuit_breaker.",
    "max_input_tokens",
)


class Learner:
    def record_cycle(
        self,
        cycle_id: str,
        insights: list[Insight],
        results: list[ToolResult],
    ) -> None:
        now = datetime.now()

        for insight in insights:
            lesson_id = f"les_{uuid.uuid4().hex[:12]}"
            category = "insight"
            if insight.urgency.value in ("critical", "high"):
                category = "urgent_insight"
            pattern = insight.description[:500]
            action = insight.suggested_action[:500]
            confidence = 0.5
            if insight.urgency.value == "critical":
                confidence = 0.9
            elif insight.urgency.value == "high":
                confidence = 0.8
            elif insight.urgency.value == "medium":
                confidence = 0.6
            self._upsert_lesson(
                lesson_id, category, pattern, action, confidence, now, cycle_id
            )

        patterns = self.extract_patterns(results)
        for pat in patterns:
            lesson_id = f"les_{uuid.uuid4().hex[:12]}"
            self._upsert_lesson(
                lesson_id,
                pat.get("category", "tool_pattern"),
                pat.get("pattern", ""),
                pat.get("action", ""),
                pat.get("confidence", 0.5),
                now,
                cycle_id,
            )

    def extract_patterns(self, results: list[ToolResult]) -> list[dict]:
        if not results:
            return []

        patterns: list[dict] = []
        failures = [r for r in results if not r.success]
        successes = [r for r in results if r.success]

        if failures and len(failures) / len(results) > 0.5:
            error_types: Counter[str] = Counter()
            for f in failures:
                error_key = f.error[:120] if f.error else "unknown"
                error_types[error_key] += 1
            top_error, top_count = error_types.most_common(1)[0]
            confidence = min(0.95, 0.5 + top_count * 0.1)
            patterns.append({
                "category": "high_failure_rate",
                "pattern": f"{len(failures)}/{len(results)} calls failed; top error: {top_error}",
                "action": "investigate failing tool or adjust parameters",
                "confidence": round(confidence, 2),
            })

        durations = [r.duration_ms for r in results if r.duration_ms > 0]
        if durations:
            avg_duration = sum(durations) / len(durations)
            if avg_duration > 5000:
                patterns.append({
                    "category": "slow_execution",
                    "pattern": f"average tool duration {avg_duration:.0f}ms across {len(durations)} calls",
                    "action": "consider increasing timeout or optimizing slow tools",
                    "confidence": round(min(0.9, 0.5 + avg_duration / 20000), 2),
                })

        if successes and len(successes) == len(results):
            patterns.append({
                "category": "perfect_success",
                "pattern": f"all {len(results)} tool calls succeeded",
                "action": "system healthy; consider increasing throughput limits",
                "confidence": 0.7,
            })

        retryable = [r for r in results if r.retryable]
        if retryable:
            patterns.append({
                "category": "retryable_failures",
                "pattern": f"{len(retryable)} retryable failures detected",
                "action": "check for transient infrastructure issues",
                "confidence": 0.6,
            })

        token_counts = [r.tokens_used for r in results if r.tokens_used]
        if token_counts:
            total_tokens = sum(
                t.get("total", 0) for t in token_counts
            )
            if total_tokens > 0:
                patterns.append({
                    "category": "token_usage",
                    "pattern": f"total tokens used: {total_tokens} across {len(token_counts)} calls",
                    "action": "monitor budget impact",
                    "confidence": 0.5,
                })

        return patterns

    def suggest_threshold_adjustments(self) -> list[dict]:
        suggestions: list[dict] = []
        week_ago = datetime.now() - timedelta(days=7)

        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT pattern, COUNT(*) as cnt
                FROM jarvis_lessons
                WHERE category = 'high_failure_rate'
                  AND learned_at > %s
                GROUP BY pattern
                ORDER BY cnt DESC
                LIMIT 5
                """,
                (week_ago,),
            )
            high_failure = cur.fetchall()

            for row in high_failure:
                suggestions.append({
                    "threshold": "circuit_breaker.failure_threshold",
                    "current": get_threshold("circuit_breaker.failure_threshold", 5),
                    "suggested": max(3, get_threshold("circuit_breaker.failure_threshold", 5) - 1),
                    "reason": f"frequent failures detected: {row[0][:100]}",
                    "safe": False,
                })

            cur.execute(
                """
                SELECT pattern, AVG(confidence) as avg_conf
                FROM jarvis_lessons
                WHERE category = 'slow_execution'
                  AND learned_at > %s
                GROUP BY pattern
                ORDER BY avg_conf DESC
                LIMIT 3
                """,
                (week_ago,),
            )
            slow_rows = cur.fetchall()

            current_timeout = get_threshold("timeout", 30)
            for row in slow_rows:
                suggested_timeout = current_timeout + 15
                suggestions.append({
                    "threshold": "timeout",
                    "current": current_timeout,
                    "suggested": suggested_timeout,
                    "reason": f"slow execution observed: {row[0][:100]}",
                    "safe": True,
                })

            cur.execute(
                """
                SELECT COUNT(*) as cnt
                FROM jarvis_lessons
                WHERE category = 'perfect_success'
                  AND learned_at > %s
                """,
                (week_ago,),
            )
            perfect_rows = cur.fetchall()

            if perfect_rows and perfect_rows[0][0] >= 5:
                current_concurrency = get_threshold("concurrency.default", 3)
                current_max = get_threshold("concurrency.max", 10)
                if current_concurrency < current_max:
                    suggestions.append({
                        "threshold": "concurrency.default",
                        "current": current_concurrency,
                        "suggested": current_concurrency + 1,
                        "reason": f"high success rate over {perfect_rows[0][0]} recent cycles",
                        "safe": True,
                    })

            cur.close()

        return suggestions

    def apply_auto_adjustments(self) -> list[dict]:
        applied: list[dict] = []
        suggestions = self.suggest_threshold_adjustments()

        for sug in suggestions:
            key = sug.get("threshold", "")
            if not self._is_safe_to_adjust(key):
                continue
            if not sug.get("safe", False):
                continue

            new_value = sug.get("suggested")
            if new_value is None:
                continue

            try:
                update_threshold(key, new_value)
                applied.append({
                    "threshold": key,
                    "old_value": sug.get("current"),
                    "new_value": new_value,
                    "reason": sug.get("reason", ""),
                })
            except Exception:
                continue

        return applied

    def get_lessons(self, category: str = "", limit: int = 50) -> list[dict]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            if category:
                cur.execute(
                    """
                    SELECT id, category, pattern, action, confidence,
                           learned_at, source, applied_count
                    FROM jarvis_lessons
                    WHERE category = %s
                    ORDER BY learned_at DESC
                    LIMIT %s
                    """,
                    (category, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, category, pattern, action, confidence,
                           learned_at, source, applied_count
                    FROM jarvis_lessons
                    ORDER BY learned_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
            rows = cur.fetchall()
            cur.close()

        return [
            {
                "id": r[0],
                "category": r[1],
                "pattern": r[2],
                "action": r[3],
                "confidence": r[4],
                "learned_at": r[5].isoformat() if r[5] else None,
                "source": r[6],
                "applied_count": r[7],
            }
            for r in rows
        ]

    def get_learning_summary(self) -> dict:
        with get_pg_conn() as conn:
            cur = conn.cursor()

            cur.execute("SELECT COUNT(*) FROM jarvis_lessons")
            total_row = cur.fetchone()
            total_count = total_row[0] if total_row else 0

            cur.execute(
                "SELECT category, COUNT(*) FROM jarvis_lessons GROUP BY category ORDER BY COUNT(*) DESC"
            )
            cat_rows = cur.fetchall()
            categories = {r[0]: r[1] for r in cat_rows}

            cur.execute(
                "SELECT pattern, COUNT(*) FROM jarvis_lessons GROUP BY pattern ORDER BY COUNT(*) DESC LIMIT 10"
            )
            top_patterns = cur.fetchall()

            cur.execute(
                """
                SELECT
                    CASE
                        WHEN confidence >= 0.8 THEN 'high'
                        WHEN confidence >= 0.5 THEN 'medium'
                        ELSE 'low'
                    END as band,
                    COUNT(*)
                FROM jarvis_lessons
                GROUP BY band
                """
            )
            conf_rows = cur.fetchall()
            confidence_dist = {r[0]: r[1] for r in conf_rows}

            cur.close()

        return {
            "total_lessons": total_count,
            "categories": categories,
            "top_patterns": [
                {"pattern": r[0][:200], "count": r[1]}
                for r in top_patterns
            ],
            "confidence_distribution": confidence_dist,
        }

    def reflect_on_week(self) -> str:
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        lessons = self.get_lessons(limit=200)

        recent = [l for l in lessons if (l.get("learned_at") or "") >= week_ago]
        if not recent:
            return "No learning data from the past week."

        summary = self.get_learning_summary()

        lessons_text = "\n".join(
            f"- [{l.get('category', '?')}] {l.get('pattern', '')} (confidence={l.get('confidence', 0):.2f}, action={l.get('action', '')})"
            for l in recent[:50]
        )

        categories_text = "\n".join(
            f"- {k}: {v}" for k, v in summary["categories"].items()
        )

        prompt = (
            "Analyze the following learning data from the past week and provide a reflection report.\n"
            "The report should include:\n"
            "1. Key patterns observed\n"
            "2. Areas of concern\n"
            "3. Recommendations for improvement\n"
            "4. Overall system health assessment\n\n"
            f"Total lessons this week: {len(recent)}\n"
            f"All-time categories:\n{categories_text}\n\n"
            f"Recent lessons (up to 50):\n{lessons_text}"
        )

        try:
            return call_llm(
                prompt=prompt,
                system="You are Jarvis, an autonomous knowledge management assistant. You analyze your own learning data and produce concise reflection reports.",
                max_tokens=2048,
            )
        except Exception as exc:
            return f"Reflection failed: {exc}"

    def _upsert_lesson(
        self,
        lesson_id: str,
        category: str,
        pattern: str,
        action: str,
        confidence: float,
        learned_at: datetime,
        source: str,
    ) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, applied_count FROM jarvis_lessons WHERE pattern = %s AND category = %s",
                (pattern, category),
            )
            existing = cur.fetchone()

            if existing:
                cur.execute(
                    """
                    UPDATE jarvis_lessons
                    SET confidence = %s, action = %s, learned_at = %s, source = %s,
                        applied_count = applied_count + 1
                    WHERE id = %s
                    """,
                    (confidence, action, learned_at, source, existing[0]),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO jarvis_lessons (id, category, pattern, action, confidence, learned_at, source, applied_count)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 0)
                    """,
                    (lesson_id, category, pattern, action, confidence, learned_at, source),
                )
            cur.close()

    @staticmethod
    def _is_safe_to_adjust(key: str) -> bool:
        if any(key.startswith(p) or key == p for p in CRITICAL_PREFIXES):
            return False
        if any(key.startswith(p) or key == p for p in SAFE_ADJUSTABLE_PREFIXES):
            return True
        return False


_learner: Learner | None = None


def get_learner() -> Learner:
    global _learner
    if _learner is None:
        _learner = Learner()
    return _learner
