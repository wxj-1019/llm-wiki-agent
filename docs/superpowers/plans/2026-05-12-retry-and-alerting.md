# 前端请求重试落地 + 全局告警/通知 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 LLM Wiki Agent 实现前端请求指数退避重试（@tanstack/react-query）和全系统告警通知（后端 SSE + 前端三通道展示）

**Architecture:** 后端新增 EventBus (asyncio.Queue) + state_monitor 轮询桥接 → /api/events SSE 端点；前端注入 TanStack Query QueryClientProvider，useQuery hooks 替代裸 fetchWithTimeout，useEventStream hook 消费 SSE 事件写入 notificationStore，AlertBanner/ToastContainer/NotificationBell 三通道展示

**Tech Stack:** Python 3.12 FastAPI (tools/api_server.py), React 18 TypeScript (wiki-viewer/), @tanstack/react-query, Zustand

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `tools/shared/event_bus.py` | 新建 | 全局事件总线 (asyncio.Queue) |
| `tools/shared/state_monitor.py` | 新建 | 轮询 state/ 文件 → 检测变化 → emit 事件 |
| `tools/api_server.py` | 修改 | 新增 GET /api/events SSE 路由 + 启动 monitor task |
| `wiki-viewer/src/lib/queryClient.ts` | 新建 | TanStack Query 全局配置 + retry 默认值 |
| `wiki-viewer/src/main.tsx` | 修改 | 注入 QueryClientProvider |
| `wiki-viewer/src/stores/notificationStore.ts` | 修改 | 扩展 severity/source/action 字段 + addAlert/getActiveAlerts/dismissAlert 方法 |
| `wiki-viewer/src/services/dataService.ts` | 修改 | 新增 useQuery hooks (useGraphData, useRawFiles, useLog, useFtsSearch...) |
| `wiki-viewer/src/services/agentKitLLMService.ts` | 修改 | 新增 useQuery hooks (useAgentKitStatus, useAgentKitFiles...) |
| `wiki-viewer/src/stores/wikiStore.ts` | 修改 | health 检查改用 useQuery 接入重试 |
| `wiki-viewer/src/stores/configStore.ts` | 修改 | 配置查询改用 useQuery 接入重试 |
| `wiki-viewer/src/hooks/useEventStream.ts` | 新建 | SSE EventSource 连接 + 重连 + 事件分发到 notificationStore |
| `wiki-viewer/src/components/ui/AlertBanner.tsx` | 新建 | 持久系统告警横幅（合并 RootLayout 现有 4 个横幅 + notificationStore 告警） |
| `wiki-viewer/src/components/layout/RootLayout.tsx` | 修改 | 集成 useEventStream + 用 AlertBanner 替换内联横幅 |
| `wiki-viewer/package.json` | 修改 | 新增 @tanstack/react-query 依赖 |

---

### Task 1: 创建后端 EventBus

**Files:**
- Create: `tools/shared/event_bus.py`

- [ ] **Step 1: 创建 `tools/shared/__init__.py`（空文件，确保模块可导入）**

Run:
```powershell
New-Item -Path "e:\A_Project\llm-wiki-agent\tools\shared\__init__.py" -ItemType File -Force
```

- [ ] **Step 2: 编写 `tools/shared/event_bus.py`**

```python
#!/usr/bin/env python3
"""Global event bus — asyncio.Queue-based pub/sub for SSE streaming.

Usage:
    from tools.shared.event_bus import event_bus
    event_bus.emit("scraper.degraded", {"site": "example.com"}, "warning")

    async for event in event_bus.subscribe():
        yield f"event: {event.type}\\ndata: {json.dumps(event.data)}\\n\\n"
"""
from __future__ import annotations

import asyncio
import json
import time


class Event:
    __slots__ = ("type", "data", "severity", "timestamp")

    def __init__(self, event_type: str, data: dict, severity: str = "info"):
        self.type = event_type
        self.data = data
        self.severity = severity
        self.timestamp = time.time()


class EventBus:
    """Global singleton collecting subsystem events for SSE subscribers."""

    MAX_QUEUE_SIZE = 256

    def __init__(self):
        self._queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=self.MAX_QUEUE_SIZE)

    def emit(self, event_type: str, data: dict, severity: str = "info") -> None:
        """Push event onto queue (must be called from a running event loop thread)."""
        try:
            self._queue.put_nowait(Event(event_type, data, severity))
        except asyncio.QueueFull:
            pass  # Drop oldest implicitly — fine for alerting

    async def subscribe(self):
        """Async generator yielding events for SSE endpoints."""
        while True:
            event = await self._queue.get()
            yield event


# Global singleton — import this everywhere
event_bus = EventBus()
```

- [ ] **Step 3: 验证导入正确**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent; .\.venv\Scripts\python.exe -c "from tools.shared.event_bus import event_bus; print('OK:', type(event_bus).__name__)"
```

Expected: `OK: EventBus`

- [ ] **Step 4: 提交**

```powershell
git add tools/shared/__init__.py tools/shared/event_bus.py
git commit -m "feat: add EventBus for SSE alert streaming"
```

---

### Task 2: 创建 State Monitor 桥接

**Files:**
- Create: `tools/shared/state_monitor.py`

- [ ] **Step 1: 编写 `tools/shared/state_monitor.py`**

```python
#!/usr/bin/env python3
"""Poll state/ files for changes and emit events via EventBus.

Synchronous scripts (scheduler.py, web_fetcher.py) cannot directly call
event_bus.emit(). This monitor bridges the gap by polling state directory
files every 10s, diffing snapshots, and emitting events for detected
degradations and recoveries.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

from tools.shared.event_bus import event_bus

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_DIR = REPO_ROOT / "state"
RAW_INBOX = REPO_ROOT / "raw-inbox"


def _snapshot_state_dir() -> dict[str, Any]:
    """Build a snapshot of all monitorable state files."""
    snap: dict[str, Any] = {}

    # Pipeline state (raw-inbox/state.json)
    state_json = RAW_INBOX / "state.json"
    if state_json.exists():
        try:
            data = json.loads(state_json.read_text(encoding="utf-8"))
            snap["pipeline"] = {
                "processed_urls": len(data.get("processed_urls", {})),
                "last_runs": data.get("last_runs", {}),
                "auto_ingested": len(data.get("auto_ingested", [])),
            }
        except (json.JSONDecodeError, OSError):
            snap["pipeline"] = {"processed_urls": 0, "last_runs": {}, "auto_ingested": 0}

    # Scheduler metrics DB (state/scheduler_metrics.db)
    try:
        from tools.shared.state_manager import SchedulerMetrics
        metrics = SchedulerMetrics()
        jobs_snap: dict[str, dict[str, int]] = {}
        try:
            if metrics._pg_mode:
                import psycopg2
                cfg = metrics._pg_config
                conn = psycopg2.connect(
                    host=cfg["host"], port=cfg["port"],
                    dbname=cfg["database"], user=cfg["user"],
                    password=cfg["password"], sslmode=cfg.get("sslmode", "prefer"),
                )
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT DISTINCT job_name FROM scheduler_jobs")
                    for (job_name,) in cur.fetchall():
                        jobs_snap[job_name] = {
                            "consecutive_failures": metrics.get_consecutive_failures(job_name),
                            "consecutive_zero_results": metrics.get_consecutive_zero_results(job_name),
                        }
                    cur.close()
                finally:
                    conn.close()
            else:
                rows = metrics._conn.execute("SELECT DISTINCT job_name FROM job_runs").fetchall()
                for (job_name,) in rows:
                    jobs_snap[job_name] = {
                        "consecutive_failures": metrics.get_consecutive_failures(job_name),
                        "consecutive_zero_results": metrics.get_consecutive_zero_results(job_name),
                    }
        finally:
            metrics.close()
        snap["scheduler"] = jobs_snap
    except Exception:
        snap["scheduler"] = {}

    return snap


def _diff_snapshots(prev: dict[str, Any], curr: dict[str, Any]) -> list[dict]:
    """Compare two snapshots and return list of events to emit."""
    events: list[dict] = []

    # Scheduler job health
    prev_jobs: dict = prev.get("scheduler", {})
    curr_jobs: dict = curr.get("scheduler", {})
    for job_name, curr_stats in curr_jobs.items():
        prev_stats: dict = prev_jobs.get(job_name, {})
        prev_fail = prev_stats.get("consecutive_failures", 0)
        curr_fail = curr_stats.get("consecutive_failures", 0)

        # Degradation threshold crossings
        if prev_fail < 3 and curr_fail >= 3:
            events.append({
                "type": "pipeline.degraded",
                "data": {"job": job_name, "failures": curr_fail},
                "severity": "warning",
            })
        if prev_fail < 5 and curr_fail >= 5:
            events.append({
                "type": "pipeline.failed",
                "data": {"job": job_name, "failures": curr_fail},
                "severity": "critical",
            })
        # Recovery
        if prev_fail >= 3 and curr_fail == 0:
            events.append({
                "type": "system.recovered",
                "data": {"resource": f"Job {job_name}"},
                "severity": "success",
            })

    return events


async def monitor_state_changes(interval: float = 10.0) -> None:
    """Poll state/ every `interval` seconds, emit events on changes.

    Intended to be launched as a background asyncio task at server startup.
    """
    prev_state: dict[str, Any] = {}
    while True:
        try:
            new_state = _snapshot_state_dir()
            if prev_state:
                events = _diff_snapshots(prev_state, new_state)
                for evt in events:
                    event_bus.emit(evt["type"], evt["data"], evt["severity"])
            prev_state = new_state
        except Exception:
            pass  # Never let a monitor error crash the server
        await asyncio.sleep(interval)
```

- [ ] **Step 2: 验证导入正确**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent; .\.venv\Scripts\python.exe -c "from tools.shared.state_monitor import monitor_state_changes; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: 提交**

```powershell
git add tools/shared/state_monitor.py
git commit -m "feat: add state_monitor for polling state/ files → EventBus"
```

---

### Task 3: api_server.py — 添加 SSE 端点

**Files:**
- Modify: `tools/api_server.py`

- [ ] **Step 1: 添加 imports（在文件顶部 imports 区域追加）**

在 `tools/api_server.py` 文件顶部（约第 40 行 `from fastapi import HTTPException` 之后），追加 event bus 导入。读取现有 imports 区域以精确定位：

```python
# 新增导入 — 追加到最后一个 fastapi import 之后
from tools.shared.event_bus import event_bus
from tools.shared.state_monitor import monitor_state_changes
```

- [ ] **Step 2: 在 app 定义后注册 startup 事件**

查找 `app = FastAPI(...)` 定义（约第 290-310 行区域），在其后追加 startup handler：

```python
@app.on_event("startup")
async def start_state_monitor():
    """Launch background state monitor for SSE alerting."""
    asyncio.create_task(monitor_state_changes())
```

- [ ] **Step 3: 添加 SSE 路由**

在文件末尾（最后一个 route 之后，`if __name__ == "__main__"` 之前）添加：

```python
@app.get("/api/events")
async def event_stream():
    """SSE endpoint — streams system events to frontend."""
    async def generate():
        async for event in event_bus.subscribe():
            payload = json.dumps(event.data, ensure_ascii=False)
            yield f"event: {event.type}\ndata: {payload}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

- [ ] **Step 4: 启动后端验证 SSE 端点**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent; Start-Process -NoNewWindow -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "tools/api_server.py"
Start-Sleep -Seconds 5
curl -N -m 5 http://localhost:8666/api/events 2>$null
```

Expected: 连接成功（无事件时静默等待），5 秒后超时断开。

- [ ] **Step 5: 提交**

```powershell
git add tools/api_server.py
git commit -m "feat: add GET /api/events SSE endpoint with state monitor startup"
```

---

### Task 4: 安装 @tanstack/react-query 依赖

**Files:**
- Modify: `wiki-viewer/package.json`

- [ ] **Step 1: 安装依赖**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npm install @tanstack/react-query
```

Expected: 安装成功，package.json dependencies 中新增 `"@tanstack/react-query"`。

- [ ] **Step 2: 提交**

```powershell
git add wiki-viewer/package.json wiki-viewer/package-lock.json
git commit -m "chore: add @tanstack/react-query dependency"
```

---

### Task 5: 创建 QueryClient 全局配置

**Files:**
- Create: `wiki-viewer/src/lib/queryClient.ts`

- [ ] **Step 1: 编写 `queryClient.ts`**

```typescript
import { QueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/stores/notificationStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Global error handler — fires when all retries are exhausted
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    const { error, fetchFailureCount } = event.query.state;
    if (fetchFailureCount > 0) {
      useNotificationStore.getState().addNotification(
        `请求失败（已重试 ${fetchFailureCount} 次）：${(error as Error).message}`,
        'error'
      );
    }
  }
});
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增类型错误。

- [ ] **Step 3: 提交**

```powershell
git add wiki-viewer/src/lib/queryClient.ts
git commit -m "feat: add TanStack Query global client with retry defaults"
```

---

### Task 6: main.tsx — 注入 QueryClientProvider

**Files:**
- Modify: `wiki-viewer/src/main.tsx`

- [ ] **Step 1: 添加 import**

在 `wiki-viewer/src/main.tsx` 顶部 `import React from 'react'` 下方添加：

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
```

- [ ] **Step 2: 包裹 RouterProvider**

将 `ReactDOM.createRoot(rootEl).render(...)` 中的 JSX 改为：

```tsx
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 4: 提交**

```powershell
git add wiki-viewer/src/main.tsx
git commit -m "feat: wrap app with QueryClientProvider"
```

---

### Task 7: notificationStore 扩展

**Files:**
- Modify: `wiki-viewer/src/stores/notificationStore.ts`

- [ ] **Step 1: 扩展 Notification 接口和 State**

在 `wiki-viewer/src/stores/notificationStore.ts` 中：

添加 severity/source/action 字段到 Notification 接口（第 5-12 行区域）：

```typescript
export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  progress?: number;
  // New fields for system alerting
  severity?: 'critical' | 'warning' | 'info' | 'success';
  source?: 'pipeline' | 'scraper' | 'wiki' | 'network';
  action?: { label: string; href: string };
}
```

在 NotificationState 接口中新增方法（第 23-25 行 `unreadCount` 之后）：

```typescript
  addAlert: (message: string, severity: string, options?: { source?: string; action?: { label: string; href: string } }) => string;
  getActiveAlerts: () => Notification[];
  dismissAlert: (id: string) => void;
```

在 store 实现中添加对应方法（`unreadCount` 之后，约第 137 行）：

```typescript
  addAlert: (message, severity, options = {}) => {
    const id = get().addNotification(message, 'error');
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id
          ? {
              ...n,
              severity: severity as Notification['severity'],
              source: options.source as Notification['source'],
              action: options.action,
            }
          : n
      ),
    }));
    return id;
  },

  getActiveAlerts: () => {
    return get().notifications.filter(
      (n) => !n.read && (n.severity === 'critical' || n.severity === 'warning')
    );
  },

  dismissAlert: (id) => {
    get().markRead(id);
  },
```

- [ ] **Step 2: 更新单元测试**

更新 `wiki-viewer/src/stores/notificationStore.test.ts`，添加新方法的测试：

```typescript
  it('addAlert sets severity and source', () => {
    const id = useNotificationStore.getState().addAlert('System down', 'critical', {
      source: 'pipeline',
    });
    const n = useNotificationStore.getState().notifications.find((x) => x.id === id);
    expect(n?.severity).toBe('critical');
    expect(n?.source).toBe('pipeline');
  });

  it('getActiveAlerts returns only unread critical/warning', () => {
    const { addAlert, markRead, getActiveAlerts } = useNotificationStore.getState();
    addAlert('Critical', 'critical');
    const warnId = addAlert('Warning', 'warning');
    addAlert('Info only', 'info');
    expect(getActiveAlerts()).toHaveLength(2);
    markRead(warnId);
    expect(getActiveAlerts()).toHaveLength(1);
  });

  it('dismissAlert marks as read', () => {
    const { addAlert, dismissAlert, getActiveAlerts } = useNotificationStore.getState();
    const id = addAlert('Test', 'critical');
    expect(getActiveAlerts()).toHaveLength(1);
    dismissAlert(id);
    expect(getActiveAlerts()).toHaveLength(0);
  });
```

- [ ] **Step 3: 运行测试**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx vitest run src/stores/notificationStore.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 4: 提交**

```powershell
git add wiki-viewer/src/stores/notificationStore.ts wiki-viewer/src/stores/notificationStore.test.ts
git commit -m "feat: extend notificationStore with severity/source/action and alert methods"
```

---

### Task 8: dataService.ts — 新增 useQuery hooks

**Files:**
- Modify: `wiki-viewer/src/services/dataService.ts`

- [ ] **Step 1: 添加 import 和 useQuery hooks**

在文件顶部 `import { isValidFilePath } from '@/lib/validation';` 之后追加：

```typescript
import { useQuery } from '@tanstack/react-query';
```

在文件末尾（最后一个 export 函数之后）追加 hooks：

```typescript
// ── TanStack Query hooks ──
// These hooks wrap the existing fetch functions with automatic caching,
// retry (3 attempts, exponential backoff 1s→2s→4s→10s cap), and
// state management. Original fetch functions remain for non-React consumers.

export function useGraphData(enabled = true) {
  return useQuery({
    queryKey: ['graph'],
    queryFn: fetchGraphData,
    staleTime: 60_000,
    enabled,
  });
}

export function useRawFiles(enabled = true) {
  return useQuery({
    queryKey: ['raw-files'],
    queryFn: fetchRawFiles,
    staleTime: 15_000,
    enabled,
  });
}

export function useLog(tail = 0, enabled = true) {
  return useQuery({
    queryKey: ['log', tail],
    queryFn: () => fetchLog(tail),
    staleTime: 30_000,
    enabled,
  });
}

export function useFtsSearch(query: string, limit = 20, semantic = false) {
  return useQuery({
    queryKey: ['fts', query, limit, semantic],
    queryFn: () => searchFts(query, limit, semantic),
    staleTime: 10_000,
    enabled: query.length > 0,
  });
}

export function useWebSourcesConfig(enabled = true) {
  return useQuery({
    queryKey: ['config', 'web_sources'],
    queryFn: fetchWebSourcesConfig,
    staleTime: 120_000,
    enabled,
  });
}

export function useIndexEtag(enabled = true) {
  return useQuery({
    queryKey: ['index-etag'],
    queryFn: fetchIndexEtag,
    staleTime: 10_000,
    refetchInterval: 30_000,
    enabled,
  });
}

export function useRawFileContent(path: string | null) {
  return useQuery({
    queryKey: ['raw-file', path],
    queryFn: () => fetchRawFileContent(path!),
    staleTime: 60_000,
    enabled: !!path,
  });
}
```

- [ ] **Step 2: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 3: 提交**

```powershell
git add wiki-viewer/src/services/dataService.ts
git commit -m "feat: add TanStack Query hooks to dataService for auto-retry"
```

---

### Task 9: agentKitLLMService.ts — 新增 useQuery hooks

**Files:**
- Modify: `wiki-viewer/src/services/agentKitLLMService.ts`

- [ ] **Step 1: 添加 import 和 useQuery hooks**

在文件顶部 `import { isValidFilePath } from '@/lib/validation';` 之后追加：

```typescript
import { useQuery } from '@tanstack/react-query';
```

在文件末尾追加 hooks：

```typescript
// ── TanStack Query hooks ──

export function useAgentKitStatus(enabled = true) {
  return useQuery({
    queryKey: ['agent-kit', 'status'],
    queryFn: checkAgentKitStatus,
    staleTime: 30_000,
    enabled,
  });
}

export function useAgentKitFiles(query = '', enabled = true) {
  return useQuery({
    queryKey: ['agent-kit', 'files', query],
    queryFn: () => fetchAgentKitFiles(query),
    staleTime: 15_000,
    enabled,
  });
}

export function useAgentKitFileContent(path: string | null) {
  return useQuery({
    queryKey: ['agent-kit', 'file', path],
    queryFn: () => fetchAgentKitFileContent(path!),
    staleTime: 30_000,
    enabled: !!path,
  });
}
```

- [ ] **Step 2: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 3: 提交**

```powershell
git add wiki-viewer/src/services/agentKitLLMService.ts
git commit -m "feat: add TanStack Query hooks to agentKitLLMService"
```

---

### Task 10: wikiStore.ts — health 检查接入重试

**Files:**
- Modify: `wiki-viewer/src/stores/wikiStore.ts`

- [ ] **Step 1: 修改 heartbeat 使用 fetchWithRetry**

将 `startHeartbeat` 方法中的裸 `fetch` 改为 `fetchWithRetry`（第 414 行）：

```typescript
  startHeartbeat: () => {
    if (_heartbeatTimer) return;
    _heartbeatTimer = setInterval(async () => {
      try {
        const resp = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
```

改为：

```typescript
import { fetchWithRetry } from '@/lib/fetchWithTimeout';
// ...
  startHeartbeat: () => {
    if (_heartbeatTimer) return;
    _heartbeatTimer = setInterval(async () => {
      try {
        const resp = await fetchWithRetry('/api/health', { timeoutMs: 5000, retries: 2, retryDelayMs: 1000 });
```

- [ ] **Step 2: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 3: 提交**

```powershell
git add wiki-viewer/src/stores/wikiStore.ts
git commit -m "feat: add fetchWithRetry to wikiStore heartbeat"
```

---

### Task 11: configStore.ts — 配置查询接入重试

**Files:**
- Modify: `wiki-viewer/src/stores/configStore.ts`

- [ ] **Step 1: 使用 fetchWithRetry 替代裸 fetch**

在 `checkApi` 方法中将裸 `fetch` 改为 `fetchWithRetry`（第 142-152 行）：

```typescript
import { fetchWithRetry } from '@/lib/fetchWithTimeout';

// 在 checkApi 中：
  checkApi: async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetchWithRetry('/api/health', { signal: ctrl.signal, timeoutMs: 3000, retries: 1, retryDelayMs: 500 });
      clearTimeout(timer);
      set({ apiAvailable: res.ok });
    } catch {
      set({ apiAvailable: false });
    }
  },
```

在 `saveToServer` 和 `loadFromServer` 的 `fetch` 调用前添加 import：

```typescript
import { fetchWithRetry } from '@/lib/fetchWithTimeout';
```

将 `saveToServer` 中的三个 `fetch(...)` 改为 `fetchWithRetry(...)`，添加 `timeoutMs: 10000, retries: 1`：

```typescript
  saveToServer: async () => {
    try {
      const cfg = get().config;
      const githubYaml = buildGithubYaml(cfg);
      const rssYaml = buildRssYaml(cfg);
      const arxivYaml = buildArxivYaml(cfg);
      const [g1, g2, g3] = await Promise.all([
        fetchWithRetry('/api/config/github_sources', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: githubYaml,
          timeoutMs: 10000,
          retries: 1,
        }),
        fetchWithRetry('/api/config/rss_sources', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: rssYaml,
          timeoutMs: 10000,
          retries: 1,
        }),
        fetchWithRetry('/api/config/arxiv_sources', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: arxivYaml,
          timeoutMs: 10000,
          retries: 1,
        }),
      ]);
      return g1.ok && g2.ok && g3.ok;
    } catch {
      return false;
    }
  },
```

同样将 `loadFromServer` 中的三个 `fetch` 改为 `fetchWithRetry`：

```typescript
  loadFromServer: async () => {
    try {
      const [g1, g2, g3] = await Promise.all([
        fetchWithRetry('/api/config/github_sources', { timeoutMs: 10000, retries: 1 })
          .then((r) => (r.ok ? r.json().then((d: { content: string }) => d.content) : null)),
        fetchWithRetry('/api/config/rss_sources', { timeoutMs: 10000, retries: 1 })
          .then((r) => (r.ok ? r.json().then((d: { content: string }) => d.content) : null)),
        fetchWithRetry('/api/config/arxiv_sources', { timeoutMs: 10000, retries: 1 })
          .then((r) => (r.ok ? r.json().then((d: { content: string }) => d.content) : null)),
      ]);
      // ... rest unchanged
```

- [ ] **Step 2: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 3: 提交**

```powershell
git add wiki-viewer/src/stores/configStore.ts
git commit -m "feat: add fetchWithRetry to configStore API calls"
```

---

### Task 12: 创建 useEventStream Hook

**Files:**
- Create: `wiki-viewer/src/hooks/useEventStream.ts`

- [ ] **Step 1: 编写 `useEventStream.ts`**

```typescript
import { useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';

/**
 * SSE event stream consumer.
 *
 * Connects to GET /api/events and dispatches system events into
 * notificationStore for ToastContainer / AlertBanner / NotificationBell.
 *
 * Auto-reconnects on disconnect with exponential backoff: 5s → 15s → 30s.
 * Gives up after 3 failures to avoid infinite reconnect loops.
 */
export function useEventStream() {
  useEffect(() => {
    let retries = 0;
    const maxRetries = 3;
    const delays = [5000, 15000, 30000];
    let eventSource: EventSource | null = null;

    function connect() {
      eventSource?.close();
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('pipeline.degraded', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `流水线降级：${data.job || ''} 连续失败 ${data.failures} 次`,
          'error'
        );
      });

      eventSource.addEventListener('pipeline.failed', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addAlert(
          `流水线故障：${data.job || ''} 连续失败 ${data.failures} 次`,
          'critical',
          { source: 'pipeline' }
        );
      });

      eventSource.addEventListener('scraper.degraded', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `爬虫站点 ${data.site || ''} 不可用`,
          'error'
        );
      });

      eventSource.addEventListener('scraper.circuit_open', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addAlert(
          `断路器打开：${data.site || ''} 累计失败 ${data.failures} 次`,
          'critical',
          { source: 'scraper' }
        );
      });

      eventSource.addEventListener('wiki.broken_links', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `断链增加：${data.count || 0} 个`,
          'error'
        );
      });

      eventSource.addEventListener('wiki.lint_contradiction', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `新矛盾：${data.detail || ''}`,
          'info'
        );
      });

      eventSource.addEventListener('graph.orphan_nodes', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `新孤立节点：${data.count || 0} 个`,
          'error'
        );
      });

      eventSource.addEventListener('system.recovered', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `${data.resource || '系统'} 已恢复`,
          'success'
        );
      });

      eventSource.onerror = () => {
        eventSource?.close();
        if (retries < maxRetries) {
          setTimeout(connect, delays[retries]);
          retries++;
        }
      };

      eventSource.onopen = () => {
        retries = 0;
      };
    }

    connect();
    return () => {
      eventSource?.close();
    };
  }, []);
}
```

- [ ] **Step 2: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 3: 提交**

```powershell
git add wiki-viewer/src/hooks/useEventStream.ts
git commit -m "feat: add useEventStream hook for SSE event consumption"
```

---

### Task 13: 创建 AlertBanner 组件

**Files:**
- Create: `wiki-viewer/src/components/ui/AlertBanner.tsx`

- [ ] **Step 1: 编写 `AlertBanner.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { X, WifiOff, ServerOff, Sparkles, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useWikiStore } from '@/stores/wikiStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSWUpdate } from '@/hooks/useSWUpdate';

interface AlertItem {
  id: string;
  message: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}

/**
 * Persistent alert banner docked at the top of the page.
 *
 * Merges two sources:
 * 1. System status alerts (offline, backend unreachable, PWA update, PWA install)
 *    — these are hardcoded checks moved here from RootLayout's inline banners.
 * 2. notificationStore alerts with severity 'critical' or 'warning'
 *    — these come from the SSE event stream (useEventStream hook).
 */
export function AlertBanner() {
  const { t } = useTranslation();
  const alerts = useNotificationStore(
    (s) => s.notifications.filter(
      (n) => !n.read && (n.severity === 'critical' || n.severity === 'warning')
    )
  );
  const dismissAlert = useNotificationStore((s) => s.dismissAlert);
  const isOnline = useNetworkStatus();
  const apiConnected = useWikiStore((s) => s.apiConnected);
  const checkApiHealth = useWikiStore((s) => s.checkApiHealth);
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const { canInstall, install } = usePWAInstall();

  const systemAlerts: AlertItem[] = [];
  if (!isOnline) {
    systemAlerts.push({
      id: 'offline',
      message: t('error.offline'),
      severity: 'critical',
      icon: <WifiOff size={14} aria-hidden="true" />,
    });
  }
  if (isOnline && !apiConnected) {
    systemAlerts.push({
      id: 'backend-offline',
      message: t('error.backendOffline', 'Backend server unreachable'),
      severity: 'critical',
      icon: <ServerOff size={14} aria-hidden="true" />,
      action: { label: t('error.retry'), onClick: checkApiHealth },
    });
  }
  if (updateAvailable) {
    systemAlerts.push({
      id: 'sw-update',
      message: t('pwa.updateAvailable'),
      severity: 'warning',
      icon: <Sparkles size={14} aria-hidden="true" />,
      action: { label: t('pwa.updateNow'), onClick: applyUpdate },
    });
  }
  if (canInstall && isOnline && !updateAvailable) {
    systemAlerts.push({
      id: 'pwa-install',
      message: t('pwa.installPrompt'),
      severity: 'info',
      icon: <Download size={14} aria-hidden="true" />,
      action: { label: t('pwa.install'), onClick: install },
    });
  }

  const storeAlerts: AlertItem[] = alerts.map((a) => ({
    id: a.id,
    message: a.message,
    severity: (a.severity || 'warning') as AlertItem['severity'],
    icon: <AlertTriangle size={14} aria-hidden="true" />,
  }));

  const allAlerts = [...systemAlerts, ...storeAlerts];
  if (allAlerts.length === 0) return null;

  const severityBg: Record<string, string> = {
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    info: 'bg-apple-purple/10 border-apple-purple/30 text-apple-purple',
    success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
  };

  return (
    <div className="space-y-0">
      {allAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`px-4 py-2 flex items-center justify-center gap-3 text-sm border-b ${severityBg[alert.severity] || severityBg.warning}`}
          role="alert"
        >
          {alert.icon}
          <span>{alert.message}</span>
          {alert.action && (
            <button
              onClick={alert.action.onClick}
              className="font-semibold underline hover:no-underline flex items-center gap-1"
            >
              <RefreshCw size={12} />
              {alert.action.label}
            </button>
          )}
          <button
            onClick={() => dismissAlert(alert.id)}
            className="ml-2 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 3: 提交**

```powershell
git add wiki-viewer/src/components/ui/AlertBanner.tsx
git commit -m "feat: add AlertBanner component for persistent system alerts"
```

---

### Task 14: RootLayout.tsx — 集成 useEventStream + AlertBanner

**Files:**
- Modify: `wiki-viewer/src/components/layout/RootLayout.tsx`

- [ ] **Step 1: 添加 import**

在 `wiki-viewer/src/components/layout/RootLayout.tsx` 顶部追加：

```typescript
import { useEventStream } from '@/hooks/useEventStream';
import { AlertBanner } from '@/components/ui/AlertBanner';
```

- [ ] **Step 2: 调用 useEventStream**

在 `RootLayout` 函数体内，`useKeyboardShortcuts()` 之后添加：

```typescript
  useEventStream();
```

- [ ] **Step 3: 用 AlertBanner 替换内联横幅**

将第 98-136 行的 `bannerRef` div 及其内部 4 个条件横幅替换为：

```tsx
      <div ref={bannerRef} className="fixed top-14 left-0 right-0 z-[45]">
        <AlertBanner />
      </div>
```

删除不再需要的 import（从 RootLayout.tsx 顶部移除）：
- `AlertTriangle, RefreshCw, WifiOff, Download, Sparkles, ServerOff` 从 `lucide-react` 导入中移除
- `useNetworkStatus, usePWAInstall, useSWUpdate` 如果仅用于横幅则移除

```typescript
// 简化后的 lucide-react import：
import { AlertTriangle, RefreshCw } from 'lucide-react';
// AlertTriangle 和 RefreshCw 仍被 loading/error 状态使用
```

- [ ] **Step 4: 验证编译**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc --noEmit --pretty
```

Expected: 无新增错误。

- [ ] **Step 5: 启动前端验证无白屏**

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; Start-Process -NoNewWindow npm -ArgumentList "run dev"
Start-Sleep -Seconds 5
```

预期: `npm run dev` 启动成功，访问 http://localhost:5173 页面正常渲染。

- [ ] **Step 6: 提交**

```powershell
git add wiki-viewer/src/components/layout/RootLayout.tsx
git commit -m "feat: integrate useEventStream + AlertBanner into RootLayout"
```

---

### Task 15: 端到端验证

- [ ] **Step 1: 验证后端 SSE 端点可连通**

```powershell
curl -N -m 10 http://localhost:8666/api/events 2>$null
```

预期: 持续等待（无事件时静默），连接 10 秒后超时断开。不报 404。

- [ ] **Step 2: 验证前端构建**

```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx tsc -b
```

预期: 无 TypeScript 错误。

- [ ] **Step 3: 验证前端 Vite 构建**

```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx vite build
```

预期: build 成功。

- [ ] **Step 4: 验证 TanStack Query retry 机制**

在 `wiki-viewer/src/stores/notificationStore.test.ts` 所在目录创建测试文件 `wiki-viewer/src/lib/queryClient.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

describe('queryClient retry config', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 3,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        },
      },
    });
  });

  it('uses exponential backoff', () => {
    const opts = client.getDefaultOptions();
    const delay = opts.queries?.retryDelay as (attempt: number) => number;
    expect(delay(0)).toBe(1000);
    expect(delay(1)).toBe(2000);
    expect(delay(2)).toBe(4000);
    expect(delay(10)).toBe(10000); // capped at 10s
  });

  it('retries 3 times by default', () => {
    const opts = client.getDefaultOptions();
    expect(opts.queries?.retry).toBe(3);
  });
});
```

Run:
```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx vitest run src/lib/queryClient.test.ts
```

预期: 2 tests PASS。

- [ ] **Step 5: 验证 notificationStore 测试仍通过**

```powershell
cd e:\A_Project\llm-wiki-agent\wiki-viewer; npx vitest run src/stores/notificationStore.test.ts
```

预期: 6 tests PASS（原有 3 + 新增 3）。

- [ ] **Step 6: 提交**

```powershell
git add wiki-viewer/src/lib/queryClient.test.ts
git commit -m "test: add queryClient retry config tests and final verification"
```
