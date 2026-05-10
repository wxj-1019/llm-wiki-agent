# 三栏式聊天 + 搜索整合方案

> 创建: 2026-05-11 | 版本: v1.0 | 状态: **待执行**

---

## 实施进度

| Phase | 内容 | 状态 | 产出 |
|-------|------|------|------|
| P0 | 数据库：chat_sessions + chat_messages 表 | ⏳ 待执行 | `config/schema.sql` 追加 |
| P1 | 后端 API：10 个聊天 CRUD 端点 + 对话搜索 | ⏳ 待执行 | `tools/api_server.py` 追加 |
| P2 | 组件拆分：ChatPage → 子组件矩阵 | ⏳ 待执行 | 8 个新组件文件 |
| P3 | 三栏布局：Layout + 折叠/展开 + 响应式 | ⏳ 待执行 | `ChatPage.tsx` 重构 |
| P4 | 右侧面板：文档预览 Tab + 搜索 Tab | ⏳ 待执行 | `ChatRightPanel.tsx` 等 |
| P5 | 搜索整合：/api/search 增加对话搜索结果 | ⏳ 待执行 | 后端 + 前端 search.ts |
| P6 | 数据迁移：localStorage → PG + 双写策略 | ⏳ 待执行 | 迁移 hook |
| P7 | i18n + 动画 + 细节打磨 | ⏳ 待执行 | 翻译 key + 交互优化 |

---

## 一、现状分析

### 1.1 当前 ChatPage 架构

当前 `wiki-viewer/src/components/pages/ChatPage.tsx` 是一个 **单文件 2100+ 行** 的单栏布局组件，承载了所有聊天相关功能：

| 功能模块 | 当前实现 | 问题 |
|---|---|---|
| 会话管理 | 头部下拉菜单切换 | 只能在下拉菜单中浏览历史，不直观，搜索体验差 |
| 搜索 | 底部弹出式面板 (Ctrl+K) | 搜索结果在底部窄条中展示，空间有限且遮挡输入框 |
| 对话内容 | 中间主区域 | 和搜索/文档无法同时可见，需要反复切换 |
| 代码生成 | 底部 Generate Panel | 同样遮挡输入框，打断对话流 |
| 知识来源 | 消息内的 SourceCard | 点击后跳转到新页面，无法在对话上下文中预览 |

### 1.2 存储层

| 层级 | 技术 | 说明 |
|---|---|---|
| 对话存储 | `localStorage` | key: `wiki-chat-sessions`，纯浏览器本地，无法跨设备、无法被搜索 |
| 搜索索引 | PG FTS5 / pgvector | wiki_pages 全文 + 语义搜索 |
| 搜索历史 | `localStorage` | key: `wiki-chat-search-history`，最多 10 条 |
| 草稿 | `localStorage` | key: `wiki-chat-drafts`，按会话保存 |

**核心缺陷**：对话内容与 wiki 搜索完全隔离——用户在对话中获得的知识，后续无法通过搜索找到。

### 1.3 后端 API 现状

| 端点 | 方法 | 功能 | 说明 |
|---|---|---|---|
| `/api/wiki-chat` | POST | RAG 对话（SSE 流式） | 接收 query + history + context_pages |
| `/api/search` | GET | FTS 全文搜索 | 只搜 wiki_pages，不搜对话 |
| `/api/agent-kit/generate-from-knowledge` | POST | 知识生成 Skill/MCP | 依赖 wiki 搜索 |
| `/api/agent-kit/llm-chat-stream` | POST | 纯 LLM 对话 | 用于 summarize 等 |
| `/api/config/llm` | GET | LLM 配置信息 | 模型/提供商 |
| `/api/wiki/write` | POST | 写入 wiki 页面 | 用于保存 summary |

---

## 二、目标设计

### 2.1 三栏布局总览

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header: Chat · 模型信息 · 网络状态 · 折叠按钮                       │
├──────────┬─────────────────────────────┬────────────────────────────┤
│          │                             │                            │
│  LEFT    │      CENTER                 │      RIGHT                 │
│  260px   │      flex-1                 │      360px (可折叠)        │
│          │                             │                            │
│  🔍 搜索框│  消息气泡列表               │  Tab: 📄文档 | 🔎搜索     │
│  ➕ 新建  │  (流式渲染, 源引用)         │                            │
│  ─────── │                             │  [文档tab]                 │
│  历史列表 │  ──────────────────         │  当前关联 wiki 页面预览    │
│  (按日期  │  输入区域                    │  点击展开 Markdown 渲染    │
│   分组)  │  @mention · /slash          │                            │
│          │  发送/停止                   │  [搜索tab]                 │
│          │                             │  Wiki + Web 双模式搜索     │
│          │                             │  💬 对话搜索命中           │
│          │                             │  引用到对话                │
│          │                             │                            │
├──────────┴─────────────────────────────┴────────────────────────────┤
│  Footer (可选): 快捷操作 · /commands · token 计数                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心交互设计

#### 左侧面板 — 历史记录

- 宽度固定 260px，圆角卡片风格
- 顶部：搜索框（过滤会话标题）+ 新建会话按钮
- 列表按日期分组展示：**今天** / **昨天** / **本周** / **更早**
- 每个会话条目显示：
  - 标题（自动截取首条 user 消息前 30 字符）
  - 最后更新时间
  - 消息数量徽章
  - 小圆点标记有新内容的会话
- 支持 inline 重命名（双击标题）
- 右键菜单：重命名 / 导出 / 删除
- 当前会话高亮（左侧蓝色指示条）
- 折叠按钮在右上角，折叠后仅显示图标列

#### 中间面板 — 对话区域

- 从现有 ChatPage 提取消息列表 + 流式渲染逻辑
- 当 assistant 消息包含 `sources` 时，自动通知右侧文档面板更新
- `@mention` 和 `/slash` 菜单保持不变
- 底部输入区域独立为 `ChatInput` 组件
- 消息气泡增加「发送到右侧面板」按钮（查看关联文档）

#### 右侧面板 — 文档 + 搜索

- 360px 宽，可折叠
- 顶部两个 Tab 切换：**📄 文档** | **🔎 搜索**

**文档 Tab**：
- 自动展示当前对话关联的 wiki 页面（从 assistant 的 `sources` 字段提取）
- 列表形式，按引用顺序排列
- 点击某个 source → 下方展开 `MarkdownRenderer` 预览
- 预览区支持「引用到对话」按钮（将关键段落插入输入框）
- 底部「在新标签页打开」链接

**搜索 Tab**：
- Wiki 搜索 + Web 搜索 切换（从现有搜索面板迁移）
- 实时搜索结果列表（防抖 400ms）
- 搜索结果中包含对话搜索命中（标记 💬 图标，区分来源）
- 点击结果 → 展开预览或引用到对话输入框
- 搜索历史保留（最近 10 条）

### 2.3 响应式策略

| 屏幕尺寸 | 断点 | 左栏 | 右栏 | 说明 |
|---|---|---|---|---|
| ≥ 1440px | xl | 始终展示 | 始终展示 | 完整三栏体验 |
| 1024–1439px | lg | 始终展示 | 可折叠 | 默认折叠右栏，点击 source 自动展开 |
| 768–1023px | md | 可折叠 | 可折叠 | 默认只显示对话，侧边栏抽屉式 overlay |
| < 768px | sm | 隐藏 | 隐藏 | 全屏对话，汉堡菜单调出历史，底部 sheet 调出搜索 |

右侧面板宽度响应式：
- `xl`: 380px
- `lg`: 340px
- `md`: 抽屉覆盖模式（overlay + backdrop blur）

---

## 三、数据库层：对话持久化到 PostgreSQL

### 3.1 新增表设计

当前对话仅存 `localStorage`，需迁移到 PG 以支持跨设备同步、对话搜索和历史管理。

#### chat_sessions — 聊天会话

```sql
CREATE TABLE chat_sessions (
    id              TEXT PRIMARY KEY,              -- nanoid / uuid
    title           TEXT NOT NULL DEFAULT '',
    is_default_title BOOLEAN NOT NULL DEFAULT TRUE,
    model           TEXT,                          -- 使用的模型标识 (e.g. 'anthropic/claude-3-5-sonnet-latest')
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,                  -- 软删除
    metadata_json   JSONB DEFAULT '{}'            -- 扩展字段
);

CREATE INDEX idx_chat_sessions_time ON chat_sessions (updated_at DESC)
    WHERE deleted_at IS NULL;
```

#### chat_messages — 聊天消息

```sql
CREATE TABLE chat_messages (
    id              TEXT PRIMARY KEY,              -- nanoid / uuid
    session_id      TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    sources_json    JSONB,                         -- [{path, preview}] assistant 来源引用
    meta_json       JSONB,                         -- {type: 'summary', style: 'brief'} 等
    bookmarked      BOOLEAN NOT NULL DEFAULT FALSE,
    truncated       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_tsv     TSVECTOR                      -- FTS 支持对话内搜索
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_messages_fts ON chat_messages USING GIN (content_tsv);
CREATE INDEX idx_chat_messages_bookmark ON chat_messages (bookmarked)
    WHERE bookmarked = TRUE;
```

### 3.2 触发器

```sql
-- 对话消息的 FTS 触发器
CREATE OR REPLACE FUNCTION chat_msg_tsv_trigger() RETURNS trigger AS $$
BEGIN
    NEW.content_tsv := to_tsvector('simple', coalesce(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_msg_tsv_update
    BEFORE INSERT OR UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION chat_msg_tsv_trigger();

-- 自动更新 chat_sessions.updated_at
CREATE OR REPLACE FUNCTION chat_session_touch() RETURNS trigger AS $$
BEGIN
    UPDATE chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_session_touch_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION chat_session_touch();
```

### 3.3 设计考量

| 决策 | 理由 |
|---|---|
| `sources_json` 保留 assistant 来源 | 右侧面板自动展示关联文档的数据来源 |
| `content_tsv` 全文索引 | 对话内容可被全站搜索命中（整合进搜索的关键） |
| 软删除 `deleted_at` | 避免误删，支持恢复 |
| 每条新消息自动更新 session | 无需前端额外请求，排序自然正确 |
| `meta_json` 灵活扩展 | 支持 summary、skill/mcp 生成等不同消息类型的元数据 |
| TEXT 类型主键 | 与现有 jarvis_* 表保持一致，使用 nanoid |

### 3.4 数据规模预估

| 指标 | 预估值 | 说明 |
|---|---|---|
| 会话数/用户 | 50–200 | 一年日常使用 |
| 消息数/会话 | 10–100 | 对话轮次 |
| 总消息数 | 500–20000 | PG FTS 轻松应对 |
| 单条消息大小 | 100B–10KB | 平均 1KB |
| 总存储 | 0.5MB–20MB | 可忽略不计 |

---

## 四、后端 API 设计

### 4.1 新增端点列表

在 `tools/api_server.py` 中新增以下端点（放在 Jarvis 端点之前、SPA catch-all 之前）：

| 端点 | 方法 | 功能 | 请求体/参数 |
|---|---|---|---|
| `/api/chat/sessions` | GET | 会话列表 | `?q=&limit=50&offset=0` |
| `/api/chat/sessions` | POST | 创建新会话 | `{title?, model?}` |
| `/api/chat/sessions/{id}` | GET | 单个会话 + 最近 N 条消息 | `?messages_limit=50` |
| `/api/chat/sessions/{id}` | PATCH | 更新标题/元数据 | `{title?, metadata_json?}` |
| `/api/chat/sessions/{id}` | DELETE | 软删除 | — |
| `/api/chat/sessions/{id}/messages` | GET | 消息列表（分页） | `?before=&limit=50` |
| `/api/chat/sessions/{id}/messages` | POST | 追加消息 | `{role, content, sources_json?, meta_json?}` |
| `/api/chat/sessions/{id}/messages/{msg_id}` | PATCH | 编辑/收藏/截断 | `{content?, bookmarked?, truncated?}` |
| `/api/chat/sessions/{id}/messages/{msg_id}` | DELETE | 删除单条消息 | — |
| `/api/chat/sessions/{id}/export` | GET | 导出会话 | `?format=markdown\|json\|text` |
| `/api/chat/search` | GET | 跨会话搜索 | `?q=&limit=10` |

### 4.2 对话搜索整合（核心功能）

#### 方案：增强现有 /api/search 端点

```python
@app.get("/api/search")
async def search(
    q: str,
    limit: int = 20,
    include_chats: bool = True,       # 新增参数
    chat_limit: int = 5,              # 新增参数
):
    results = []

    # 1. 现有 wiki FTS 搜索
    wiki_results = backend.search(q, limit=limit)
    for r in wiki_results:
        results.append({**r, "source_type": "wiki"})

    # 2. 对话内容搜索（新增）
    if include_chats:
        chat_results = _search_chat_messages(q, limit=chat_limit)
        for r in chat_results:
            results.append({
                "id": f"chat:{r['session_id']}:{r['message_id']}",
                "path": f"chat/{r['session_id']}",
                "title": r["session_title"],
                "preview": r["excerpt"],
                "source_type": "chat",
                "score": r.get("rank", 0),
            })

    # 3. 合并排序
    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    return {"results": results[:limit]}
```

#### 对话搜索实现

```python
def _search_chat_messages(query: str, limit: int = 5) -> list[dict]:
    """Search across all chat messages using PG FTS."""
    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    cm.id AS message_id,
                    cm.session_id,
                    cs.title AS session_title,
                    ts_rank(cm.content_tsv, plainto_tsquery('simple', %s)) AS rank,
                    ts_headline('simple', cm.content, plainto_tsquery('simple', %s),
                                'MaxWords=30, MinWords=15, StartSel=<<, StopSel=>>') AS excerpt,
                    cm.created_at
                FROM chat_messages cm
                JOIN chat_sessions cs ON cs.id = cm.session_id
                WHERE cm.content_tsv @@ plainto_tsquery('simple', %s)
                  AND cs.deleted_at IS NULL
                ORDER BY rank DESC
                LIMIT %s
            """, (query, query, query, limit))
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()
```

### 4.3 前端 SearchPage 展示对话结果

搜索结果中 `source_type: 'chat'` 的条目用特殊样式展示：

- 图标：💬（区别于 wiki 的 📄/👤/💡/📦）
- 颜色：`text-apple-cyan bg-apple-cyan/10`（新颜色，区别于现有四种类型）
- 点击行为：跳转到 `/chat?session={session_id}` 打开对应会话
- 预览文本：高亮匹配关键词（ts_headline 已处理）

---

## 五、前端组件架构

### 5.1 组件拆分矩阵

当前 2100 行的 ChatPage 需要拆分为以下组件：

```
wiki-viewer/src/components/
├── chat/
│   ├── ChatPage.tsx              # 主容器：三栏布局协调 + 全局状态管理
│   ├── ChatHistory.tsx           # 左侧：会话列表面板
│   ├── ChatHistoryItem.tsx       # 单个会话条目（标题+时间+操作）
│   ├── ChatConversation.tsx      # 中间：消息列表 + 流式渲染
│   ├── ChatInput.tsx             # 输入框 + 工具栏 + @mention + /slash
│   ├── ChatRightPanel.tsx        # 右侧面板容器（Tab 切换）
│   ├── ChatDocPreview.tsx        # 右侧文档预览（Markdown 渲染）
│   ├── ChatSearchPanel.tsx       # 右侧搜索面板（Wiki + Web）
│   ├── ChatMessage.tsx           # 消息气泡（已存在，需增强）
│   └── SourceCard.tsx            # wiki 来源引用卡片（新增）
```

### 5.2 各组件详细职责

#### ChatPage.tsx — 主容器

```tsx
// 职责：三栏布局协调、全局状态管理、会话 CRUD
export function ChatPage() {
  // ── 状态 ──
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightTab, setRightTab] = useState<'doc' | 'search'>('doc');
  const [activeDocPath, setActiveDocPath] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [entries, setEntries] = useState<ChatEntry[]>([]);

  // ── 会话 CRUD ──
  // 通过 PG API 操作，localStorage 作为 fallback

  // ── 消息发送 ──
  // doSend → chatWithWikiStream → 自动同步到 PG

  // ── Source 联动 ──
  // 当 assistant 消息有 sources → 更新 activeDocPath → 右侧面板自动刷新

  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex">
      {/* Left: History */}
      <AnimatePresence>
        {!leftCollapsed && (
          <ChatHistory ... />
        )}
      </AnimatePresence>

      {/* Center: Conversation */}
      <ChatConversation ... />

      {/* Right: Docs + Search */}
      <AnimatePresence>
        {!rightCollapsed && (
          <ChatRightPanel ... />
        )}
      </AnimatePresence>
    </div>
  );
}
```

**关键数据流**：

```
用户发送消息
    ↓
ChatPage.handleSend()
    ↓
├── doSend(query)                    → chatWithWikiStream (SSE)
│       ↓
│   Assistant 回复 + sources
│       ↓
│   setEntries(update)               → 更新中间面板
│       ↓
│   setActiveDocPath(sources[0])     → 右侧文档面板自动更新
│
└── syncToPg(sessionId, message)     → POST /api/chat/sessions/{id}/messages
```

#### ChatHistory.tsx — 左侧面板

```tsx
// 职责：会话列表展示、搜索、CRUD 操作
interface ChatHistoryProps {
  sessions: ChatSession[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ChatHistory({ ... }: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 按日期分组
  const grouped = useMemo(() => {
    const filtered = sessions.filter(s =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return groupByDate(filtered);  // today / yesterday / thisWeek / earlier
  }, [sessions, searchQuery]);

  return (
    <div className="w-[260px] border-r ...">
      {/* Header: 搜索 + 新建 */}
      {/* Groups: 今天 / 昨天 / 本周 / 更早 */}
      {/* Each group → ChatHistoryItem[] */}
    </div>
  );
}
```

#### ChatHistoryItem.tsx — 单个会话条目

```tsx
// 职责：单个会话的展示和操作
interface ChatHistoryItemProps {
  session: ChatSession;
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

// 显示：标题、时间、消息数徽章
// 交互：点击切换、双击重命名、右键菜单
```

#### ChatConversation.tsx — 中间对话区域

```tsx
// 职责：消息列表渲染、流式更新、滚动管理
// 从现有 ChatPage 提取以下逻辑：
// - RENDER_WINDOW 虚拟化
// - 日期分隔线
// - 滚动到底部按钮
// - Find in conversation (Ctrl+F)
// - 消息操作（复制、编辑、删除、回复、收藏）
```

#### ChatInput.tsx — 输入区域

```tsx
// 职责：输入框、工具栏、@mention、/slash 菜单
// 从现有 ChatPage 提取以下逻辑：
// - textarea 自动高度
// - @mention 触发和搜索
// - /slash 命令菜单
// - 工具栏按钮（搜索、总结、Skill、MCP、更多）
// - 发送/停止按钮
// - 草稿自动保存
```

#### ChatRightPanel.tsx — 右侧面板容器

```tsx
// 职责：Tab 切换、面板折叠/展开
interface ChatRightPanelProps {
  tab: 'doc' | 'search';
  onTabChange: (tab: 'doc' | 'search') => void;
  sources: WikiChatSource[];
  activeDocPath: string | null;
  onQuoteToChat: (text: string) => void;
  onClose: () => void;
}

export function ChatRightPanel({ ... }: ChatRightPanelProps) {
  return (
    <div className="w-[360px] border-l ...">
      {/* Tab bar */}
      <div className="flex border-b ...">
        <TabButton active={tab === 'doc'} onClick={() => onTabChange('doc')}>
          📄 文档
        </TabButton>
        <TabButton active={tab === 'search'} onClick={() => onTabChange('search')}>
          🔎 搜索
        </TabButton>
      </div>

      {/* Content */}
      {tab === 'doc'
        ? <ChatDocPreview sources={sources} activePath={activeDocPath} onQuote={onQuoteToChat} />
        : <ChatSearchPanel onQuote={onQuoteToChat} />
      }
    </div>
  );
}
```

#### ChatDocPreview.tsx — 文档预览

```tsx
// 职责：展示当前对话关联的 wiki 页面
interface ChatDocPreviewProps {
  sources: WikiChatSource[];
  activePath: string | null;
  onQuote: (text: string) => void;
}

// 功能：
// - 来源列表（按引用顺序）
// - 点击展开 MarkdownRenderer 预览
// - 预览区「引用到对话」按钮
// - 预览区「新标签页打开」链接
// - 加载状态骨架屏
// - 空状态提示
```

#### ChatSearchPanel.tsx — 搜索面板

```tsx
// 职责：Wiki + Web 搜索，结果展示和引用
// 从现有 ChatPage 的搜索逻辑迁移：
// - Wiki / Web 切换
// - 搜索历史（最近 10 条）
// - 实时搜索（防抖 400ms）
// - 结果列表展示
// - 💬 对话搜索命中标识
// - 引用到对话按钮
```

#### SourceCard.tsx — 来源引用卡片

```tsx
// 职责：在消息气泡中展示 wiki 来源引用
interface SourceCardProps {
  path: string;
  preview: string;
  onClick: () => void;  // 打开右侧面板文档预览
}

// 样式：紧凑卡片，显示页面类型图标 + 标题 + 摘要预览
// 点击：激活右侧面板并展开对应文档
```

### 5.3 现有 ChatMessage.tsx 增强

在现有消息气泡组件中增加：

1. **SourceCard 集成**：assistant 消息的 sources 改为使用新的 SourceCard 组件
2. **「查看文档」按钮**：点击后通知 ChatPage 更新右侧 activeDocPath
3. **消息内搜索高亮**：支持 Ctrl+F 匹配时的高亮样式

---

## 六、对话内容整合进搜索

### 6.1 数据流设计

```
用户发送消息
    ↓
前端 POST /api/chat/sessions/{id}/messages  →  存入 chat_messages 表
    ↓
同时 POST /api/wiki-chat  →  LLM RAG 对话（SSE 流式）
    ↓
Assistant 回复完成  →  存入 chat_messages (含 sources_json)
    ↓
chat_messages.content_tsv 自动更新  →  可被 /api/search 命中
```

### 6.2 搜索结果分类

| source_type | 图标 | 颜色 | 点击行为 |
|---|---|---|---|
| `wiki` (source) | 📄 | blue | 跳转到 `/s/{slug}` |
| `wiki` (entity) | 👤 | green | 跳转到 `/e/{name}` |
| `wiki` (concept) | 💡 | purple | 跳转到 `/c/{name}` |
| `wiki` (synthesis) | 📦 | orange | 跳转到 `/y/{slug}` |
| `chat` | 💬 | cyan | 跳转到 `/chat?session={id}` |

### 6.3 SearchPage 前端改动

在 `SearchPage.tsx` 中：

1. 搜索结果列表增加 `chat` 类型的渲染分支
2. 新增颜色映射：`chat: 'text-apple-cyan bg-apple-cyan/10'`
3. 点击 chat 结果 → `navigate('/chat?session=' + sessionId)`
4. 搜索结果标签显示「对话」文字

---

## 七、数据迁移策略

### 7.1 localStorage → PG 迁移

```typescript
// 迁移逻辑（在 ChatPage mount 时一次性执行）
async function migrateLocalStorageToPg() {
  const localData = safeGet('wiki-chat-sessions', isValidSessions, null);
  if (!localData || localData.sessions.length === 0) return;

  let migratedCount = 0;
  for (const session of localData.sessions) {
    if (session.messages.length === 0) continue;

    // 1. 创建 session
    const sessionRes = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: session.title,
        is_default_title: session.isDefaultTitle,
      }),
    });
    if (!sessionRes.ok) continue;
    const { id: newSessionId } = await sessionRes.json();

    // 2. 批量写入 messages
    const messagesRes = await fetch(`/api/chat/sessions/${newSessionId}/messages/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: session.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources_json: m.sources || null,
          meta_json: m.meta || null,
          bookmarked: m.bookmarked || false,
          truncated: m.truncated || false,
          created_at: m.timestamp ? new Date(m.timestamp).toISOString() : null,
        })),
      }),
    });
    if (messagesRes.ok) migratedCount++;
  }

  // 3. 迁移成功后清除 localStorage（保留备份）
  if (migratedCount > 0) {
    localStorage.setItem('wiki-chat-sessions-backup', JSON.stringify(localData));
    localStorage.removeItem('wiki-chat-sessions');
  }

  return migratedCount;
}
```

### 7.2 双写策略

迁移期间（过渡期）采用双写：

```
发送消息
    ↓
├── 写入 localStorage（原有逻辑，保持兼容）
└── 写入 PG（POST /api/chat/sessions/{id}/messages）
    ↓
读取消息
    ↓
优先从 PG 读取 → 失败则 fallback 到 localStorage
```

过渡期结束后（确认 PG 数据完整），移除 localStorage 写入逻辑。

### 7.3 迁移安全措施

| 措施 | 说明 |
|---|---|
| 迁移前备份 | localStorage 数据复制到 `wiki-chat-sessions-backup` |
| 幂等性 | 使用 session/message 的原始 ID，重复迁移不会创建重复数据 |
| 分批迁移 | 每个 session 独立迁移，单个失败不影响其他 |
| 进度提示 | 迁移过程显示进度条和成功/失败计数 |
| 回退机制 | 如果 PG 不可用，自动 fallback 到 localStorage |

---

## 八、i18n 新增翻译 key

```json
{
  "chat.history.title": "会话历史",
  "chat.history.search": "搜索会话...",
  "chat.history.newSession": "新建会话",
  "chat.history.today": "今天",
  "chat.history.yesterday": "昨天",
  "chat.history.thisWeek": "本周",
  "chat.history.earlier": "更早",
  "chat.history.messages": "{{count}} 条消息",
  "chat.history.empty": "暂无会话",
  "chat.history.rename": "重命名",
  "chat.history.delete": "删除",
  "chat.history.export": "导出",

  "chat.right.title": "知识面板",
  "chat.right.doc": "文档",
  "chat.right.search": "搜索",
  "chat.right.noDoc": "暂无关联文档",
  "chat.right.noDocDesc": "发送消息后，关联的 wiki 页面将在此显示",
  "chat.right.quoteToChat": "引用到对话",
  "chat.right.openInNewTab": "新标签页打开",
  "chat.right.sources": "关联来源 ({{count}})",

  "chat.search.chatResult": "对话",
  "chat.search.chatResultDesc": "来自历史对话的匹配",
  "chat.search.jumpToChat": "跳转到对话",

  "chat.migrate.title": "迁移对话数据",
  "chat.migrate.description": "正在将本地对话数据迁移到云端...",
  "chat.migrate.progress": "已迁移 {{migrated}} / {{total}} 个会话",
  "chat.migrate.success": "对话数据迁移完成",
  "chat.migrate.error": "部分会话迁移失败，已保留本地备份",
  "chat.migrate.skip": "跳过迁移"
}
```

---

## 九、技术风险与应对

| 风险 | 概率 | 影响 | 应对方案 |
|---|---|---|---|
| 对话数据量大导致 FTS 慢 | 低 | 中 | 限制搜索最近 90 天的对话；PG FTS 对 2 万条消息性能充足 |
| 左栏历史列表过长 | 中 | 低 | 虚拟滚动（react-window）+ 按日期分组折叠 |
| 右栏文档预览加载慢 | 中 | 低 | 骨架屏 + 懒加载 MarkdownRenderer + 缓存已加载文档 |
| 移动端三栏体验差 | 高 | 中 | 默认全屏对话，侧边栏用 Drawer overlay，底部 Sheet 调出搜索 |
| localStorage 迁移丢失数据 | 低 | 高 | 双写策略 + 迁移前备份到 `wiki-chat-sessions-backup` |
| PG 连接失败 | 低 | 高 | 自动 fallback 到 localStorage；显示离线提示 |
| 组件拆分导致回归 | 中 | 中 | 逐步拆分，每步保持功能一致；使用现有 ChatMessage 测试 |
| 右侧面板遮挡输入框 | 低 | 低 | 右侧面板独立滚动，不影响中间输入框 |

---

## 十、实施分步计划

### Phase 0: 数据库 (P0)

**目标**：chat_sessions + chat_messages 表就绪

- [ ] 在 `config/schema.sql` 末尾追加 2 张表 + 2 个触发器
- [ ] 在本地 PG 执行 schema 更新
- [ ] 验证表结构和触发器工作正常

### Phase 1: 后端 API (P1)

**目标**：11 个新 API 端点可用

- [ ] 在 `tools/api_server.py` 中实现聊天 CRUD 端点
- [ ] 实现 `/api/chat/search` 对话搜索端点
- [ ] 增强 `/api/search` 包含对话搜索结果
- [ ] 使用 `tools/test_api.py` 或手动 curl 测试

### Phase 2: 组件拆分 (P2)

**目标**：ChatPage 拆分为独立子组件，功能无回归

- [ ] 创建 `ChatHistory.tsx` + `ChatHistoryItem.tsx`
- [ ] 提取 `ChatConversation.tsx`（消息列表 + 流式渲染）
- [ ] 提取 `ChatInput.tsx`（输入框 + 工具栏 + @mention + /slash）
- [ ] 创建 `SourceCard.tsx`
- [ ] 重构 `ChatPage.tsx` 为组合容器
- [ ] 验证所有原有功能正常

### Phase 3: 三栏布局 (P3)

**目标**：三栏布局可用，折叠/展开正常

- [ ] 实现三栏 flex 布局
- [ ] 实现左栏折叠/展开动画
- [ ] 实现右栏折叠/展开动画
- [ ] 响应式断点适配（xl/lg/md/sm）
- [ ] 移动端 Drawer 模式

### Phase 4: 右侧面板 (P4)

**目标**：文档预览 + 搜索 Tab 可用

- [ ] 实现 `ChatRightPanel.tsx` Tab 切换
- [ ] 实现 `ChatDocPreview.tsx` 文档预览
- [ ] 迁移搜索逻辑到 `ChatSearchPanel.tsx`
- [ ] Source 联动：assistant sources → 自动更新右侧面板

### Phase 5: 搜索整合 (P5)

**目标**：搜索结果包含对话内容

- [ ] 后端 `_search_chat_messages()` 实现
- [ ] 前端 SearchPage 展示 chat 类型结果
- [ ] 对话结果点击跳转到对应会话

### Phase 6: 数据迁移 (P6)

**目标**：localStorage 数据安全迁移到 PG

- [ ] 实现迁移 hook `useChatMigration()`
- [ ] 双写策略：PG + localStorage 并行写入
- [ ] 迁移进度 UI
- [ ] 回退机制

### Phase 7: 打磨 (P7)

**目标**：体验细节完善

- [ ] 新增 i18n 翻译 key
- [ ] 动画优化（framer-motion）
- [ ] 键盘快捷键更新
- [ ] 性能优化（虚拟滚动、懒加载）

---

## 十一、关键文件清单

### 需要修改的文件

| 文件 | 改动内容 |
|---|---|
| `config/schema.sql` | 追加 chat_sessions + chat_messages 表 + 触发器 |
| `tools/api_server.py` | 新增 11 个聊天 API 端点 + 增强 /api/search |
| `wiki-viewer/src/components/pages/ChatPage.tsx` | 重构为三栏容器，拆分逻辑到子组件 |
| `wiki-viewer/src/services/chatService.ts` | 新增 CRUD API 调用函数 |
| `wiki-viewer/src/lib/search.ts` | hybridSearch 增加 chat 结果类型 |
| `wiki-viewer/src/components/pages/SearchPage.tsx` | 展示 chat 类型搜索结果 |
| `wiki-viewer/src/components/chat/ChatMessage.tsx` | 集成 SourceCard、增加「查看文档」按钮 |

### 需要新增的文件

| 文件 | 说明 |
|---|---|
| `wiki-viewer/src/components/chat/ChatHistory.tsx` | 左侧会话列表面板 |
| `wiki-viewer/src/components/chat/ChatHistoryItem.tsx` | 单个会话条目 |
| `wiki-viewer/src/components/chat/ChatConversation.tsx` | 中间对话区域 |
| `wiki-viewer/src/components/chat/ChatInput.tsx` | 输入框 + 工具栏 |
| `wiki-viewer/src/components/chat/ChatRightPanel.tsx` | 右侧面板容器 |
| `wiki-viewer/src/components/chat/ChatDocPreview.tsx` | 文档预览组件 |
| `wiki-viewer/src/components/chat/ChatSearchPanel.tsx` | 搜索面板组件 |
| `wiki-viewer/src/components/chat/SourceCard.tsx` | 来源引用卡片 |
| `wiki-viewer/src/hooks/useChatMigration.ts` | localStorage → PG 迁移 hook |

---

## 附录 A: API 请求/响应示例

### 创建会话

```http
POST /api/chat/sessions
Content-Type: application/json

{
  "title": "讨论 Transformer 架构",
  "model": "anthropic/claude-3-5-sonnet-latest"
}
```

```json
{
  "id": "cs_abc123",
  "title": "讨论 Transformer 架构",
  "is_default_title": false,
  "model": "anthropic/claude-3-5-sonnet-latest",
  "created_at": "2026-05-11T10:30:00Z",
  "updated_at": "2026-05-11T10:30:00Z"
}
```

### 获取会话列表

```http
GET /api/chat/sessions?limit=20&offset=0
```

```json
{
  "sessions": [
    {
      "id": "cs_abc123",
      "title": "讨论 Transformer 架构",
      "message_count": 12,
      "last_message_preview": "Transformer 的核心创新在于...",
      "updated_at": "2026-05-11T10:35:00Z"
    }
  ],
  "total": 1
}
```

### 搜索（含对话结果）

```http
GET /api/search?q=transformer&limit=10&include_chats=true&chat_limit=3
```

```json
{
  "results": [
    {
      "id": "wiki/sources/attention-is-all-you-need.md",
      "path": "wiki/sources/attention-is-all-you-need.md",
      "title": "Attention Is All You Need",
      "preview": "...the Transformer model based solely on attention...",
      "source_type": "wiki",
      "score": 0.95
    },
    {
      "id": "chat:cs_abc123:cm_xyz789",
      "path": "chat/cs_abc123",
      "title": "讨论 Transformer 架构",
      "preview": "<<Transformer>> 的核心创新在于自注意力机制...",
      "source_type": "chat",
      "score": 0.72
    }
  ]
}
```

## 附录 B: 组件 Props 接口汇总

```typescript
// ChatHistory
interface ChatHistoryProps {
  sessions: ChatSession[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// ChatHistoryItem
interface ChatHistoryItemProps {
  session: ChatSession & { message_count: number };
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

// ChatConversation
interface ChatConversationProps {
  entries: ChatEntry[];
  streaming: boolean;
  loading: boolean;
  onSend: (query: string) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onEdit: (index: number, content: string) => void;
  onDelete: (index: number) => void;
  onCopy: (content: string, index: number) => void;
  onReply: (index: number) => void;
  onToggleBookmark: (index: number) => void;
  onContinue: (index: number) => void;
  onSourceClick: (path: string) => void;
  copiedIndex: number | null;
}

// ChatInput
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  streaming: boolean;
  online: boolean;
  onSearchOpen: () => void;
  onSummarize: (style: string) => void;
  onGenerate: (target: 'skill' | 'mcp') => void;
}

// ChatRightPanel
interface ChatRightPanelProps {
  tab: 'doc' | 'search';
  onTabChange: (tab: 'doc' | 'search') => void;
  sources: WikiChatSource[];
  activeDocPath: string | null;
  onQuoteToChat: (text: string) => void;
  onSourceClick: (path: string) => void;
  onClose: () => void;
}

// ChatDocPreview
interface ChatDocPreviewProps {
  sources: WikiChatSource[];
  activePath: string | null;
  onSelectPath: (path: string) => void;
  onQuote: (text: string) => void;
}

// ChatSearchPanel
interface ChatSearchPanelProps {
  onQuote: (text: string) => void;
}

// SourceCard
interface SourceCardProps {
  path: string;
  preview: string;
  onClick: () => void;
}
```

## 附录 C: 布局 CSS 参考

```css
/* 三栏容器 */
.chat-layout {
  display: flex;
  height: calc(100vh - 7rem);
  overflow: hidden;
}

/* 左栏 */
.chat-left {
  width: 260px;
  min-width: 260px;
  border-right: 1px solid var(--border-default);
  overflow-y: auto;
  transition: width 0.2s ease, min-width 0.2s ease;
}
.chat-left.collapsed {
  width: 0;
  min-width: 0;
  overflow: hidden;
}

/* 中间 */
.chat-center {
  flex: 1;
  min-width: 0;          /* 防止 flex 子项溢出 */
  display: flex;
  flex-direction: column;
}

/* 右栏 */
.chat-right {
  width: 360px;
  min-width: 360px;
  border-left: 1px solid var(--border-default);
  overflow-y: auto;
  transition: width 0.2s ease, min-width 0.2s ease;
}
.chat-right.collapsed {
  width: 0;
  min-width: 0;
  overflow: hidden;
}

/* 响应式 */
@media (max-width: 1439px) {
  .chat-right { width: 340px; min-width: 340px; }
}
@media (max-width: 1023px) {
  .chat-left, .chat-right {
    position: fixed;
    z-index: 40;
    height: 100%;
    top: 0;
    backdrop-filter: blur(8px);
  }
  .chat-left { left: 0; }
  .chat-right { right: 0; }
}
@media (max-width: 767px) {
  .chat-left, .chat-right {
    width: 100%;
    min-width: 100%;
  }
}
```
