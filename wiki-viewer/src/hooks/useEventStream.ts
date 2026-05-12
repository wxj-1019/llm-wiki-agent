/**
 * SSE EventStream consumer hook.
 *
 * Connects to /api/events and dispatches events to notificationStore
 * via addAlert (persistent banner) for critical/warning events
 * and addNotification (toast) for info events.
 *
 * Auto-reconnects with exponential backoff: 5s → 15s → 30s, max 3 retries.
 */
import { useEffect, useRef, useCallback } from "react";
import { useNotificationStore, Severity, NotificationAction } from "../stores/notificationStore";

/** Map SSE event type to severity level. */
function mapSeverity(eventType: string): Severity {
  if (eventType.includes("failed") || eventType.includes("circuit_open")) return "critical";
  if (eventType.includes("degraded") || eventType.includes("broken_links")) return "warning";
  if (eventType.includes("recovered")) return "success";
  return "info";
}

/** Map SSE event type to a human-readable source label. */
function mapSource(eventType: string, data: Record<string, unknown>): string {
  if (eventType.startsWith("pipeline")) return `Pipeline: ${data.job || "unknown"}`;
  if (eventType.startsWith("scraper")) return `Scraper: ${data.site || "unknown"}`;
  if (eventType.startsWith("wiki")) return "Wiki Quality";
  if (eventType.startsWith("graph")) return "Knowledge Graph";
  if (eventType.startsWith("system")) return "System";
  if (eventType.startsWith("network")) return "Network";
  return eventType;
}

/** Build an optional action for the alert banner. */
function mapAction(
  eventType: string,
  data: Record<string, unknown>,
): NotificationAction | undefined {
  if (eventType === "wiki.broken_links" || eventType === "wiki.lint_contradiction") {
    return {
      label: "运行 Lint",
      handler: () => {
        // Navigate to lint page — delegate to app router
        window.dispatchEvent(new CustomEvent("wiki:navigate", { detail: "/lint" }));
      },
    };
  }
  if (eventType === "graph.orphan_nodes") {
    return {
      label: "打开图谱",
      handler: () => {
        window.dispatchEvent(new CustomEvent("wiki:navigate", { detail: "/graph" }));
      },
    };
  }
  if (eventType === "pipeline.degraded" || eventType === "pipeline.failed") {
    return {
      label: "查看状态",
      handler: () => {
        window.dispatchEvent(new CustomEvent("wiki:navigate", { detail: "/pipeline" }));
      },
    };
  }
  return undefined;
}

export function useEventStream() {
  const esRef = useRef<EventSource | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;
  const { addAlert, addNotification } = useNotificationStore();

  const retryDelays = [5_000, 15_000, 30_000];

  const connect = useCallback(() => {
    // Clean up existing connection
    esRef.current?.close();
    esRef.current = null;

    const es = new EventSource("/api/events");
    esRef.current = es;

    es.onopen = () => {
      retryCount.current = 0;
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (retryCount.current < maxRetries) {
        const delay = retryDelays[retryCount.current];
        retryCount.current += 1;
        setTimeout(connect, delay);
      }
    };

    // Register handlers for known event types
    const eventTypes = [
      "pipeline.degraded",
      "pipeline.failed",
      "scraper.degraded",
      "scraper.circuit_open",
      "wiki.broken_links",
      "wiki.lint_contradiction",
      "graph.orphan_nodes",
      "system.recovered",
      "network.retry_status",
      "network.retry_exhausted",
    ];

    eventTypes.forEach((eventType) => {
      es.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          const severity = mapSeverity(eventType);
          const source = mapSource(eventType, data);
          const action = mapAction(eventType, data);

          if (severity === "critical" || severity === "warning") {
            // Persistent banner alert
            const msg =
              typeof data.message === "string"
                ? data.message
                : `${source} — ${eventType}`;
            addAlert(msg, severity, source, action);
          } else {
            // Auto-dismiss toast
            const msg =
              typeof data.message === "string"
                ? data.message
                : `${source}: ${eventType}`;
            addNotification(
              msg,
              severity === "success" ? "success" : "info",
            );
          }
        } catch {
          // Ignore malformed events
        }
      });
    });

    // Fallback: onmessage for untyped events
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        addNotification(
          typeof data.message === "string" ? data.message : JSON.stringify(data),
          "info",
        );
      } catch {
        // Ignore
      }
    };
  }, [addAlert, addNotification]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
