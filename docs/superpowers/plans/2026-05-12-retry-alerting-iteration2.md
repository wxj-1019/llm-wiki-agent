# 前端重试与告警系统 迭代打磨 — 实施计划

> **For agentic workers:** 直接执行，每任务自审后提交。

**Goal:** 修复 3 个 bug + 7 项稳定性打磨，涉及 7 个文件。

**Architecture:** 所有改动集中在已有的 AlertBanner / useEventStream / notificationStore / queryClient / RootLayout / Header / NotificationDropdown 组件中，无新建文件。

---

### Task 1: AlertBanner — Bug修复 + 暗色模式 + 排序 + 重试按钮 (B1, P2, P3, P4)

**Files:**
- Modify: `wiki-viewer/src/components/ui/AlertBanner.tsx`

- [ ] **Step 1: 实施修改**

B1: 改用 zustand selector 订阅 notifications（修复响应性）
P2: 按 severity 优先级排序 + 时间倒序
P3: 硬编码颜色 → CSS 变量 + dark: 变体
P4: 后端离线告警加"重试"按钮

```tsx
import { AlertTriangle, WifiOff, ServerOff, RefreshCw, Download, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationStore } from "../../stores/notificationStore";
import { useWikiStore } from "../../stores/wikiStore";
import type { Severity } from "../../stores/notificationStore";

export interface AlertBannerProps {
  isOffline?: boolean;
  isBackendOffline?: boolean;
  hasPwaUpdate?: boolean;
  showPwaInstall?: boolean;
  onPwaUpdate?: () => void;
  onPwaInstall?: () => void;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  success: 2,
  info: 3,
};

const severityStyles: Record<Severity, string> = {
  critical:
    "bg-red-600 dark:bg-red-700 text-white",
  warning:
    "bg-amber-500 dark:bg-amber-600 text-white",
  success:
    "bg-emerald-600 dark:bg-emerald-700 text-white",
  info:
    "bg-blue-600 dark:bg-blue-700 text-white",
};

export function AlertBanner({
  isOffline = false,
  isBackendOffline = false,
  hasPwaUpdate = false,
  showPwaInstall = false,
  onPwaUpdate,
  onPwaInstall,
}: AlertBannerProps) {
  // B1 fix: use zustand selector to react to alert changes
  const notifications = useNotificationStore((s) => s.notifications);
  const activeAlerts = notifications.filter((n) => n.isAlert);
  const dismissAlert = useNotificationStore((s) => s.dismissAlert);
  const checkApiHealth = useWikiStore((s) => s.checkApiHealth);

  interface UnifiedAlert {
    id: string;
    message: string;
    severity: Severity;
    timestamp: number;
    actionLabel?: string;
    onAction?: () => void;
    isSystem: boolean;
  }

  const allAlerts: UnifiedAlert[] = [];

  if (isOffline) {
    allAlerts.push({
      id: "system-offline",
      message: "网络连接已断开 — 部分功能不可用",
      severity: "warning",
      timestamp: 0,
      isSystem: true,
    });
  }

  if (isBackendOffline) {
    allAlerts.push({
      id: "system-backend-offline",
      message: "后端服务未响应 — 数据可能不是最新的",
      severity: "critical",
      timestamp: 0,
      // P4: add retry button
      actionLabel: "重试",
      onAction: () => checkApiHealth(),
      isSystem: true,
    });
  }

  if (hasPwaUpdate) {
    allAlerts.push({
      id: "system-pwa-update",
      message: "新版本可用",
      severity: "info",
      timestamp: 0,
      actionLabel: "更新",
      onAction: onPwaUpdate,
      isSystem: true,
    });
  }

  if (showPwaInstall) {
    allAlerts.push({
      id: "system-pwa-install",
      message: "安装为本地应用以获得更好体验",
      severity: "info",
      timestamp: 0,
      actionLabel: "安装",
      onAction: onPwaInstall,
      isSystem: true,
    });
  }

  for (const alert of activeAlerts) {
    allAlerts.push({
      id: alert.id,
      message: alert.message,
      severity: alert.severity || "info",
      timestamp: alert.timestamp,
      actionLabel: alert.action?.label,
      onAction: alert.action?.handler,
      isSystem: false,
    });
  }

  if (allAlerts.length === 0) return null;

  // P2: sort by severity priority then time descending
  allAlerts.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return b.timestamp - a.timestamp;
  });

  return (
    <div className="w-full z-[70]" role="alert" aria-live="assertive">
      <AnimatePresence>
        {allAlerts.map((alert) => {
          const styles = severityStyles[alert.severity] || severityStyles.info;

          const iconMap: Record<string, React.ReactNode> = {
            "system-offline": <WifiOff size={16} aria-hidden="true" />,
            "system-backend-offline": <ServerOff size={16} aria-hidden="true" />,
            "system-pwa-update": <RefreshCw size={16} aria-hidden="true" />,
            "system-pwa-install": <Download size={16} aria-hidden="true" />,
          };

          const icon = iconMap[alert.id] || (
            <AlertTriangle size={16} aria-hidden="true" />
          );

          return (
            <motion.div
              key={alert.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${styles}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {icon}
                <span className="truncate">{alert.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {alert.actionLabel && alert.onAction && (
                  <button
                    onClick={alert.onAction}
                    className="px-2 py-0.5 rounded text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {alert.actionLabel}
                  </button>
                )}
                {!alert.isSystem && (
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="p-0.5 rounded hover:bg-white/20 transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd wiki-viewer && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add wiki-viewer/src/components/ui/AlertBanner.tsx
git commit -m "fix(AlertBanner): zustand selector reactivity, severity sort, dark mode, retry button"
```

---

### Task 2: QueryClient — 错误观察器只在重试耗尽时触发 (B2)

**Files:**
- Modify: `wiki-viewer/src/lib/queryClient.ts`

- [ ] **Step 1: 实施修改**

```typescript
queryClient.getQueryCache().subscribe((event) => {
  if (
    "query" in event &&
    event.query.state.status === "error" &&
    event.query.state.error &&
    // B2 fix: only fire when retries exhausted (fetchFailureCount >= retry limit)
    event.query.state.fetchFailureCount >= 3
  ) {
    const err = event.query.state.error as Error;
    const failedQuery = Array.isArray(event.query.queryKey)
      ? event.query.queryKey.join("/")
      : String(event.query.queryKey);

    useNotificationStore.getState().addNotification(
      `请求失败 (已重试 3 次): ${failedQuery} — ${err.message}`,
      "error",
      undefined,
    );
  }
});
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd wiki-viewer && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add wiki-viewer/src/lib/queryClient.ts
git commit -m "fix(queryClient): only fire error notification after retries exhausted"
```

---

### Task 3: notificationStore — addAlert 按 source 去重 (P1)

**Files:**
- Modify: `wiki-viewer/src/stores/notificationStore.ts`

- [ ] **Step 1: 实施修改**

在 `addAlert` 方法中，设置 state 前先移除同 source 的旧 alert：

```typescript
addAlert: (message, severity, source, action) => {
  const id = `alert-${Date.now()}-${++toastIdCounter}`;
  const alert: Notification = {
    id,
    message,
    type: severity === 'critical' ? 'error' : severity === 'warning' ? 'info' : severity as NotificationType,
    timestamp: Date.now(),
    read: false,
    severity,
    source,
    action,
    isAlert: true,
  };
  // P1: deduplicate by source — replace existing alert from same source
  set((state) => ({
    notifications: [
      alert,
      ...state.notifications.filter((n) => !(n.isAlert && n.source === source)),
    ].slice(0, 50),
    toasts: state.toasts,
  }));
  return id;
},
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd wiki-viewer && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add wiki-viewer/src/stores/notificationStore.ts
git commit -m "feat(notificationStore): deduplicate alerts by source in addAlert"
```

---

### Task 4: useEventStream — 导出连接状态 + React Router 导航 (P5, P7)

**Files:**
- Modify: `wiki-viewer/src/hooks/useEventStream.ts`

- [ ] **Step 1: 实施修改**

P5: 导出 `connectionState`
P7: 接收外部 `navigate` 函数替代 `window.dispatchEvent`

```typescript
import { useEffect, useRef, useCallback, useState } from "react";
import { useNotificationStore, Severity, NotificationAction } from "../stores/notificationStore";
import type { NavigateFunction } from "react-router-dom";

export type ConnectionState = "connected" | "connecting" | "disconnected";

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
  _data: Record<string, unknown>,
  navigate: NavigateFunction,
): NotificationAction | undefined {
  if (eventType === "wiki.broken_links" || eventType === "wiki.lint_contradiction") {
    return {
      label: "运行 Lint",
      handler: () => navigate("/lint"),
    };
  }
  if (eventType === "graph.orphan_nodes") {
    return {
      label: "打开图谱",
      handler: () => navigate("/graph"),
    };
  }
  if (eventType === "pipeline.degraded" || eventType === "pipeline.failed") {
    return {
      label: "查看状态",
      handler: () => navigate("/pipeline"),
    };
  }
  return undefined;
}

export function useEventStream(navigate: NavigateFunction) {
  const esRef = useRef<EventSource | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;
  const { addAlert, addNotification } = useNotificationStore();
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

  const retryDelays = [5_000, 15_000, 30_000];

  const connect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setConnectionState("connecting");

    const es = new EventSource("/api/events");
    esRef.current = es;

    es.onopen = () => {
      retryCount.current = 0;
      setConnectionState("connected");
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (retryCount.current < maxRetries) {
        const delay = retryDelays[retryCount.current];
        retryCount.current += 1;
        setConnectionState("connecting");
        setTimeout(connect, delay);
      } else {
        setConnectionState("disconnected");
      }
    };

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
          const action = mapAction(eventType, data, navigate);

          if (severity === "critical" || severity === "warning") {
            const msg =
              typeof data.message === "string"
                ? data.message
                : `${source} — ${eventType}`;
            addAlert(msg, severity, source, action);
          } else {
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
  }, [addAlert, addNotification, navigate]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  return { connectionState };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd wiki-viewer && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add wiki-viewer/src/hooks/useEventStream.ts
git commit -m "feat(useEventStream): export connectionState, use React Router navigate"
```

---

### Task 5: RootLayout — ResizeObserver 依赖修复 + useEventStream 导航传入 (B3, P7)

**Files:**
- Modify: `wiki-viewer/src/components/layout/RootLayout.tsx`

- [ ] **Step 1: 实施修改**

B3: 添加 `alertCount` zustand selector 到依赖数组
P7: 传入 `navigate` 给 `useEventStream`

```tsx
// Add useNavigate import (already exists at top)
// ... existing imports ...

export function RootLayout() {
  // ... existing state declarations ...
  const navigate = useNavigate();  // for P7

  // B3: subscribe to alert count for ResizeObserver dependency
  const alertCount = useNotificationStore(
    (s) => s.notifications.filter((n) => n.isAlert).length,
  );

  // P7: pass navigate to useEventStream
  const { connectionState } = useEventStream(navigate);

  // ... rest remains the same except:

  useEffect(() => {
    measureBanner();
    const observer = new ResizeObserver(measureBanner);
    if (bannerRef.current) observer.observe(bannerRef.current);
    return () => observer.disconnect();
  }, [measureBanner, isOnline, updateAvailable, canInstall, apiConnected, alertCount]); // B3: add alertCount

  // ... rest unchanged ...
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd wiki-viewer && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add wiki-viewer/src/components/layout/RootLayout.tsx
git commit -m "fix(RootLayout): add alertCount to ResizeObserver deps, pass navigate to useEventStream"
```

---

### Task 6: Header — SSE 连接状态指示器 (P5)

**Files:**
- Modify: `wiki-viewer/src/components/layout/Header.tsx`

- [ ] **Step 1: 实施修改**

在 Header 右侧按钮区域（NotificationDropdown 旁边）添加小圆点指示器。

```tsx
// Add import
import type { ConnectionState } from '@/hooks/useEventStream';

// Add prop
export function Header({ connectionState }: { connectionState?: ConnectionState }) {

  const statusColor =
    connectionState === "connected"
      ? "bg-emerald-500"
      : connectionState === "connecting"
        ? "bg-amber-400"
        : "bg-red-500";

  // Find the section where NotificationDropdown is rendered and add before it:
  <div className="flex items-center gap-1">
    {/* SSE status indicator */}
    <span
      className={`w-2 h-2 rounded-full ${statusColor}`}
      title={
        connectionState === "connected"
          ? "SSE 已连接"
          : connectionState === "connecting"
            ? "SSE 连接中..."
            : "SSE 已断开"
      }
    />
    <NotificationDropdown />
  </div>
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd wiki-viewer && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add wiki-viewer/src/components/layout/Header.tsx
git commit -m "feat(Header): add SSE connection state indicator dot"
```

---

### Task 7: NotificationDropdown — 告警严重级别着色 (P6)

**Files:**
- Modify: `wiki-viewer/src/components/layout/NotificationDropdown.tsx`

- [ ] **Step 1: 实施修改**

对 `isAlert` 通知按 `severity` 着色图标和左边框。

```tsx
// Add severity color map
const severityColorMap: Record<string, string> = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  success: 'text-emerald-500',
  info: 'text-apple-blue',
};

// In the notification item rendering (inside notifications.map):
const isAlert = (n as any).isAlert;
const severity = (n as any).severity as string | undefined;

// Replace icon color logic:
const iconColor = isAlert && severity
  ? severityColorMap[severity] || colorMap[n.type]
  : colorMap[n.type];

// Add left border for alerts:
className={`flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-default)] last:border-b-0 ${
  !n.read ? 'bg-[var(--bg-secondary)]/40' : ''
} ${
  isAlert && severity === 'critical' ? 'border-l-2 border-l-red-500' : ''
} ${
  isAlert && severity === 'warning' ? 'border-l-2 border-l-amber-500' : ''
}`}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd wiki-viewer && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add wiki-viewer/src/components/layout/NotificationDropdown.tsx
git commit -m "feat(NotificationDropdown): color-code alerts by severity with left border"
```

---

### Task 8: 端到端验证 + 构建

**Files:** 无

- [ ] **Step 1: TypeScript 类型检查**

```bash
cd wiki-viewer && npx tsc --noEmit
```
预期：零错误

- [ ] **Step 2: Vite 生产构建**

```bash
cd wiki-viewer && npx vite build
```
预期：构建成功

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "verify: TypeScript + Vite build pass after iteration2 polish"
```
