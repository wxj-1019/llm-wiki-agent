# 前端请求重试落地 + 全局告警/通知 设计规格

> 日期: 2026-05-12
> 状态: 待实施

## 1. 概述

为 LLM Wiki Agent 完善两个核心横切能力：
1. **前端 HTTP 请求重试**：基于 `@tanstack/react-query` 实现指数退避重试，替代裸 `fetchWithTimeout` 调用
2. **全局告警/通知**：后端 SSE 推送系统事件 + 前端 AlertBanner/Toast/通知铃铛三通道展示

## 2. 现有基础设施（可复用）

| 组件 | 路径 | 状态 | 说明 |
|---|---|---|---|
| `ToastContainer` | `components/ui/ToastContainer.tsx` | ✅ 已完成 | 右下角 toast 堆叠，含进度条、自动消失、动画 |
| `NotificationDropdown` | `components/layout/NotificationDropdown.tsx` | ✅ 已完成 | 铃铛角标、通知列表、已读/清除、日志链接 |
| `notificationStore` | `stores/notificationStore.ts` | ✅ 已完成 | toast + notification 双池，限流 300ms，50 条上限 |
| `apiUtils.ts` | `lib/apiUtils.ts` | ✅ 已完成 | 6 类错误分类 + `retryable` 标志（未被消费） |
| `fetchWithRetry` | `lib/fetchWithTimeout.ts` | ⚠️ 存在但未使用 | 仅重试 1 次、固定 500ms 延迟 |
| RootLayout banner slot | `components/layout/RootLayout.tsx` | ✅ 已完成 | 离线/后端断联/PWA 更新/PWA 安装 四个横幅 |

**关键发现**：UI 层已完备，缺的是"数据驱动系统事件"——没有任何系统事件源在往 notificationStore 写数据。

## 3. 架构设计

```
┌─ Backend (Python) ────────────────────────────────────────┐
│                                                              │
│  scheduler.py ──┐                                           │
│  web_fetcher.py ─┤── EventBus (asyncio.Queue) ──►            │
│  health.py ─────┘        ▲                                   │
│                          │                                   │
│  state_monitor.py ───────┘ (每10s检查 state/ 文件变化)        │
│                          │                                   │
│                     api_server.py                            │
│                     GET /api/events (SSE)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ SSE stream
┌─ Frontend (React) ───────┼──────────────────────────────────┐
│                           ▼                                   │
│  hooks/useEventStream.ts  ◄── EventSource('/api/events')     │
│       │                                                       │
│       ▼                                                       │
│  notificationStore ◄──────── useQuery 重试/错误回调            │
│       │                                                       │
│       ├──► AlertBanner       (页面顶部持久横幅)                │
│       ├──► ToastContainer    (右下角 3s 自动消失)             │
│       └──► NotificationBell   (导航栏铃铛 + 角标)             │
│                                                               │
│  QueryClientProvider                                          │
│       │                                                       │
│       └──► useQuery / useMutation (TanStack Query)            │
│               ├── 默认 retry:3, 指数退避 1s→2s→4s            │
│               └── 失败时 → notificationStore.addNotification() │
└───────────────────────────────────────────────────────────────┘
```

## 4. 后端改动

### 4.1 EventBus (`tools/shared/event_bus.py` — 新建)

```python
import asyncio
import json
import time
from typing import Optional

class Event:
    def __init__(self, event_type: str, data: dict, severity: str = "info"):
        self.type = event_type
        self.data = data
        self.severity = severity
        self.timestamp = time.time()

class EventBus:
    """全局单例，收集各子系统事件并分发给 SSE 订阅者"""
    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=256)

    def emit(self, event_type: str, data: dict, severity: str = "info"):
        """推送事件入队（需在运行中的 event loop 线程调用）"""
        try:
            self._queue.put_nowait(Event(event_type, data, severity))
        except asyncio.QueueFull:
            pass  # 丢弃最旧事件，保留最新

    async def subscribe(self):
        """异步生成器，SSE 端点用"""
        while True:
            event = await self._queue.get()
            yield event

# 全局单例
event_bus = EventBus()
```

### 4.2 State Monitor 桥接 (`tools/shared/state_monitor.py` — 新建)

同步脚本（`scheduler.py`, `web_fetcher.py`）无法直接调用 `event_bus.emit()`。采用 **状态文件轮询桥接**：

```python
async def monitor_state_changes(interval: float = 10.0):
    """每 interval 秒检查 state/ 文件变化，对比快照 emit 事件"""
    prev_state = {}
    while True:
        new_state = _snapshot_state_dir()
        events = _diff_snapshots(prev_state, new_state)
        for evt in events:
            event_bus.emit(evt["type"], evt["data"], evt["severity"])
        prev_state = new_state
        await asyncio.sleep(interval)
```

检测规则：
| 状态文件/字段 | 变化 | 事件 |
|---|---|---|
| `state.json` → `scraper.consecutive_failures[site]` | ≥3 | `scraper.degraded` 🟡 |
| 同上 | ≥10 | `scraper.circuit_open` 🔴 |
| 同上 | 0→恢复 | `system.recovered` 🟢 |
| `state.json` → `scheduler.consecutive_job_failures` | ≥3 | `pipeline.degraded` 🟡 |
| 同上 | ≥5 | `pipeline.failed` 🔴 |
| wiki health 检查结果 | broken_links 增加 | `wiki.broken_links` 🟡 |
| wiki lint 检查结果 | 新矛盾 | `wiki.lint_contradiction` 🔵 |
| graph.json 构建结果 | 新孤立节点 | `graph.orphan_nodes` 🟡 |

### 4.3 SSE 端点 (`tools/api_server.py` — 修改)

```python
from tools.shared.event_bus import event_bus
from tools.shared.state_monitor import monitor_state_changes

@app.on_event("startup")
async def start_monitor():
    asyncio.create_task(monitor_state_changes())

@app.get("/api/events")
async def event_stream():
    async def generate():
        async for event in event_bus.subscribe():
            yield f"event: {event.type}\ndata: {json.dumps(event.data)}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

## 5. 前端改动

### 5.1 新增依赖

```bash
npm install @tanstack/react-query
```

### 5.2 QueryClient 全局配置 (`lib/queryClient.ts` — 新建)

```typescript
import { QueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/stores/notificationStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30_000,      // 30s 内视为新鲜
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,               // mutation 不自动重试（POST 等幂问题）
    },
  },
});

// TanStack Query 全局 onError 回调 — 重试耗尽后推送通知
// 注意：TanStack Query v5 中 onError 回调通过 QueryClient 构造函数的
// defaultOptions.queries 或全局 QueryCache 订阅实现。以下为 v5 API：
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

### 5.3 Provider 注入 (`main.tsx` — 修改)

```tsx
// 在 <RouterProvider /> 外套一层
<QueryClientProvider client={queryClient}>
  <RouterProvider router={router} />
</QueryClientProvider>
```

### 5.4 Service Hooks 改造（示例：`services/dataService.ts`）

**改造前：**
```typescript
export async function fetchGraphData(): Promise<GraphData> {
  const res = await fetchWithTimeout('/api/graph', { timeoutMs: 10000 });
  return safeJson(res);
}
```

**改造后（新增 hooks，保留原始函数给非 React 场景）：**
```typescript
import { useQuery } from '@tanstack/react-query';

export function useGraphData(enabled = true) {
  return useQuery({
    queryKey: ['graph'],
    queryFn: () => fetchGraphData(),
    staleTime: 30_000,
    enabled,
  });
}

export function useWikiHealth(enabled = true) {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetchWithTimeout('/api/health', { timeoutMs: 5000 }).then(r => safeJson(r)),
    staleTime: 60_000,
    refetchInterval: 60_000,  // 每 60s 自动刷新
    enabled,
  });
}
```

**改造优先级：**

| 优先级 | 文件 | 当前裸调用数 | 迁移方式 |
|---|---|---|---|
| P0 | `services/dataService.ts` | 18 处 | 新增 `useQuery` hooks |
| P0 | `services/agentKitLLMService.ts` | 5 处 | 同上 |
| P1 | `stores/configStore.ts` | 6 处 | 用 `useQuery` 替代 store 内 fetch |
| P1 | `stores/wikiStore.ts` | 1 处 health | 接入 `useQuery` |
| P2 | `services/chatService.ts` | 5 处 | chat 偏 mutation |
| P2 | `pages/JarvisPage.tsx` | 6 处 | 独立页面，后迁移 |

### 5.5 useEventStream Hook (`hooks/useEventStream.ts` — 新建)

```typescript
export function useEventStream() {
  useEffect(() => {
    let retries = 0;
    const maxRetries = 3;
    const delays = [5000, 15000, 30000];
    let eventSource: EventSource | null = null;

    function connect() {
      eventSource?.close();
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('pipeline.degraded', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `流水线降级：${data.job || ''} 连续失败 ${data.failures} 次`,
          'error'
        );
      });

      eventSource.addEventListener('scraper.degraded', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `爬虫站点 ${data.site || ''} 不可用`,
          'error'
        );
      });

      eventSource.addEventListener('pipeline.failed', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `流水线故障：${data.job || ''} 连续失败 ${data.failures} 次`,
          'error'
        );
      });

      eventSource.addEventListener('scraper.circuit_open', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `断路器打开：${data.site || ''} 累计失败 ${data.failures} 次`,
          'error'
        );
      });

      eventSource.addEventListener('wiki.broken_links', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `断链增加：${data.count || 0} 个`, 'error'
        );
      });

      eventSource.addEventListener('wiki.lint_contradiction', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `新矛盾：${data.detail || ''}`, 'info'
        );
      });

      eventSource.addEventListener('graph.orphan_nodes', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `新孤立节点：${data.count || 0} 个`, 'error'
        );
      });

      eventSource.addEventListener('system.recovered', (e) => {
        const data = JSON.parse(e.data);
        useNotificationStore.getState().addNotification(
          `${data.resource || '系统'} 已恢复`,
          'success'
        );
      });

      eventSource.onerror = () => {
        eventSource.close();
        if (retries < maxRetries) {
          setTimeout(connect, delays[retries]);
          retries++;
        }
      };

      eventSource.onopen = () => { retries = 0; };
    }

    connect();
    return () => eventSource?.close();
  }, []);
}
```

在 `RootLayout` 中调用 `useEventStream()` 即可激活。

### 5.6 notificationStore 扩展

```typescript
// 新增字段（保持现有 API 不变）
export interface Notification {
  // ... 现有字段 ...
  severity?: 'critical' | 'warning' | 'info' | 'success';
  source?: 'pipeline' | 'scraper' | 'wiki' | 'network';
  action?: { label: string; href: string };
}

// 新增方法
addAlert: (message: string, severity: string, options?: { action?: {...} }) => void;
getActiveAlerts: () => Notification[];  // 未读 + critical/warning
dismissAlert: (id: string) => void;
```

### 5.7 AlertBanner (`components/ui/AlertBanner.tsx` — 新建)

从 `RootLayout` 中提取现有 4 个内联横幅，统一为数据驱动组件：

```tsx
export function AlertBanner() {
  const alerts = useNotificationStore(s => 
    s.notifications.filter(n => !n.read && (n.severity === 'critical' || n.severity === 'warning'))
  );
  const dismissAlert = useNotificationStore(s => s.dismissAlert);
  const { isOnline } = useNetworkStatus();
  const { apiConnected } = useWikiStore(s => ({ apiConnected: s.apiConnected }));
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const { canInstall, install } = usePWAInstall();

  // 合并：系统状态(离线/断联/PWA) + notificationStore critical/warning 告警
  const systemAlerts = [];
  if (!isOnline) systemAlerts.push({ id: 'offline', message: t('error.offline'), severity: 'critical', icon: WifiOff });
  if (isOnline && !apiConnected) systemAlerts.push({ id: 'backend-offline', message: t('error.backendOffline'), severity: 'critical', icon: ServerOff, action: { label: t('error.retry'), onClick: checkApiHealth } });
  if (updateAvailable) systemAlerts.push({ id: 'sw-update', message: t('pwa.updateAvailable'), severity: 'warning', icon: Sparkles, action: { label: t('pwa.updateNow'), onClick: applyUpdate } });
  if (canInstall && isOnline && !updateAvailable) systemAlerts.push({ id: 'pwa-install', message: t('pwa.installPrompt'), severity: 'info', icon: Download, action: { label: t('pwa.install'), onClick: install } });

  const allAlerts = [...systemAlerts, ...alerts.map(a => ({ id: a.id, message: a.message, severity: a.severity || 'warning' }))];
  // 渲染为 banner 列表
}
```

## 6. 事件类型全景

| 事件 | 触发源 | 严重度 | 前端通道 |
|---|---|---|---|
| `pipeline.degraded` | scheduler 连续失败≥3 | 🟡 warning | Toast + 铃铛 |
| `pipeline.failed` | scheduler 连续失败≥5 | 🔴 critical | AlertBanner |
| `scraper.degraded` | 站点 3 次重试均失败 | 🟡 warning | Toast + 铃铛 |
| `scraper.circuit_open` | 站点累计失败≥10 | 🔴 critical | AlertBanner |
| `wiki.broken_links` | health 断链数增加 | 🟡 warning | Toast + 铃铛 |
| `wiki.lint_contradiction` | lint 检测到新矛盾 | 🔵 info | Toast → 铃铛 |
| `graph.orphan_nodes` | 图谱出现孤立节点 | 🟡 warning | Toast + 铃铛 |
| `system.recovered` | 之前异常已恢复 | 🟢 success | Toast |
| `network.retry_status` | 请求重试中 | 🔵 progress | Toast (进度条) |
| `network.retry_exhausted` | 重试耗尽 | 🔴 error | Toast + 铃铛 |

## 7. 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| **新建** | `tools/shared/event_bus.py` | 全局事件总线 |
| **新建** | `tools/shared/state_monitor.py` | 状态文件轮询 → 事件桥接 |
| **新建** | `wiki-viewer/src/lib/queryClient.ts` | TanStack Query 全局配置 |
| **新建** | `wiki-viewer/src/hooks/useEventStream.ts` | SSE 连接 + 事件分发 |
| **新建** | `wiki-viewer/src/components/ui/AlertBanner.tsx` | 持久系统告警横幅 |
| **修改** | `tools/api_server.py` | 新增 `/api/events` SSE 路由 + 启动 monitor task |
| **修改** | `wiki-viewer/src/main.tsx` | 注入 QueryClientProvider |
| **修改** | `wiki-viewer/src/stores/notificationStore.ts` | 扩展 severity/source/action 字段 + addAlert 方法 |
| **修改** | `wiki-viewer/src/services/dataService.ts` | 新增 useQuery hooks（保留原始函数） |
| **修改** | `wiki-viewer/src/services/agentKitLLMService.ts` | 新增 useQuery hooks |
| **修改** | `wiki-viewer/src/stores/wikiStore.ts` | health 查询改用 useQuery |
| **修改** | `wiki-viewer/src/stores/configStore.ts` | 配置查询改用 useQuery |
| **修改** | `wiki-viewer/src/components/layout/RootLayout.tsx` | 集成 useEventStream + AlertBanner |
| **修改** | `wiki-viewer/package.json` | 新增 `@tanstack/react-query` 依赖 |

## 8. 测试策略

| 测试 | 方法 |
|---|---|
| `event_bus.py` 单元测试 | `pytest tools/shared/event_bus.py` — emit→subscribe 流程 |
| SSE 端点连通性 | `curl -N http://localhost:8666/api/events` 验证流输出 |
| QueryClient 重试 | `vitest` 模拟 fetch 失败 → 验证 retry 次数 + toast 出现 |
| useEventStream 重连 | 杀死后端 → 验证前端 5s→15s→30s 重连 |
| AlertBanner 渲染 | Storybook/手动：critical 告警出现 + 手动关闭 |

## 9. 安全与边界

- SSE 不需要认证（内网项目，localhost only）
- EventBus 队列上限 256，防止内存溢出
- `useEventStream` 重连上限 3 次，防止无限重连
- 前端 retry 仅对 GET 类 query 启用，mutation (POST/PUT/DELETE) 默认 retry=0
- `state_monitor.py` 只读取 `state/` 文件，不写入
