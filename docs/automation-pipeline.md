# 自动化数据流水线方案

> 本方案让你的 LLM Wiki Agent 能够定时从外部数据源（RSS、GitHub、arXiv 等）自动获取新知识，经过去重、合并、摄入后沉淀到 wiki 中，同时定期清理过时内容，避免冗余膨胀。

---

## 架构总览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  外部数据源  │ --> │  Fetchers   │ --> │   Batch     │ --> │   Ingest    │
│ RSS/GitHub  │     │  (原始抓取)  │     │  Compiler   │     │   (Agent)   │
│ arXiv/API   │     │             │     │ (合并去重)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                    │
                                                                    v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Archive     │ <-- │   Lint /    │ <-- │  Graph      │ <-- │    Wiki     │
│ Stale       │     │   Health    │     │  Build      │     │  (知识层)    │
│ (过期清理)   │     │  (质量检查)  │     │ (图谱更新)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**数据流向：**

1. **Fetch** → `raw-inbox/fetched/<source>/<date>/`（单条原始内容）
2. **Compile** → `raw-inbox/batches/batch-<type>-<week>.md`（按周/日合并去重）
3. **Ingest** → `wiki/sources/` + `wiki/entities/` + `wiki/concepts/`（Agent 结构化）
4. **Maintain** → 过期归档 + 健康检查 + 图谱重建

---

## 目录说明

| 路径 | 作用 |
|------|------|
| `raw-inbox/fetched/` | Fetcher 输出目录，每条原始内容一个 `.md` |
| `raw-inbox/batches/` | Batch Compiler 输出，合并后的待摄入文件 |
| `raw-inbox/batches/archived/` | 已摄入成功的批次归档 |
| `raw-inbox/state.json` | 去重状态、已处理 URL、最后运行时间 |
| `config/*.yaml` | 各数据源的配置文件 |

---

## 第一步：配置数据源

### RSS 源

编辑 `config/rss_sources.yaml`：

```yaml
feeds:
  - name: "Hacker News - AI"
    url: "https://hnrss.org/newest?q=artificial+intelligence"
  - name: "OpenAI Blog"
    url: "https://openai.com/blog/rss.xml"
```

运行：
```bash
python tools/fetchers/rss_fetcher.py --config config/rss_sources.yaml --max-per-feed 10
```

### GitHub 跟踪

编辑 `config/github_sources.yaml`：

```yaml
repos:
  - repo: "microsoft/markitdown"
    kinds: ["info", "releases"]
  - repo: "openai/openai-python"
    kinds: ["releases"]
```

可选设置 Token（提高 API 限额）：
```bash
export GITHUB_TOKEN=ghp_xxxxxxxx
python tools/fetchers/github_fetcher.py --config config/github_sources.yaml
```

### arXiv 论文

编辑 `config/arxiv_sources.yaml`：

```yaml
queries:
  - label: "LLMs"
    query: "cat:cs.AI OR cat:cs.CL"
```

运行：
```bash
python tools/fetchers/arxiv_fetcher.py --config config/arxiv_sources.yaml --max-results 10
```

---

## 第二步：合并批次（Batch Compiler）

Fetchers 产出的是零散单条文件。Compiler 会把它们按 **source_type + 时间窗口** 合并成一个批次文件，同时按 `source_url` 去重。

```bash
# 按周合并（推荐）
python tools/batch_compiler.py --window weekly

# 或按日合并（新闻量特别大时）
python tools/batch_compiler.py --window daily

# 试运行，不实际写入
python tools/batch_compiler.py --dry-run
```

输出示例：
```
raw-inbox/batches/batch-rss-2026-W17.md
raw-inbox/batches/batch-github-2026-W17.md
raw-inbox/batches/batch-arxiv-2026-W17.md
```

---

## 第三步：批次摄入（Batch Ingest）

调用已有的 `tools/ingest.py`，逐个处理批次文件：

```bash
python tools/batch_ingest.py
```

流程：
1. 扫描 `raw-inbox/batches/*.md`
2. 对每个文件执行 `python tools/ingest.py <batch>`
3. 成功后自动移至 `raw-inbox/batches/archived/`
4. 更新 `state.json`

如需保留批次文件（不移动）：
```bash
python tools/batch_ingest.py --skip-archive
```

---

## 第四步：过期内容归档（Archive Stale）

新闻类源页面天然有时效性。给需要自动清理的源页面 frontmatter 加 `ttl`：

```yaml
---
title: "OpenAI GPT-5 发布新闻"
type: source
date: 2026-04-20
ttl: 90   # 90 天后自动归档
---
```

或设置绝对过期时间：
```yaml
archive_after: "2026-07-01"
```

运行归档：
```bash
# 试运行
python tools/archive_stale.py --dry-run

# 执行归档并生成报告
python tools/archive_stale.py --save-report
```

**规则：**
- 只处理 `wiki/sources/*.md`
- **绝不触碰** `wiki/entities/` 和 `wiki/concepts/`（长期知识）
- 归档后自动更新 `wiki/index.md`
- 归档文件移至 `wiki/sources/archive/`

---

## 第五步：质量保障（每周/每月）

自动化摄入后，必须定期运行质量检查，否则噪声会累积。

```bash
# 1. 结构检查（快，无 LLM 调用）
python tools/health.py

# 2. 内容质量检查（慢，调用 LLM）
python tools/lint.py

# 3. 自动修复缺失实体页
python tools/heal.py

# 4. 重建知识图谱
python tools/build_graph.py
```

---

## 定时调度配置

### Linux / macOS (Cron)

编辑 crontab：

```bash
# 每天早上 8 点抓取 RSS 和 arXiv
0 8 * * * cd /path/to/llm-wiki-agent && python tools/fetchers/rss_fetcher.py --config config/rss_sources.yaml >> logs/fetch.log 2>&1
0 8 * * * cd /path/to/llm-wiki-agent && python tools/fetchers/arxiv_fetcher.py --config config/arxiv_sources.yaml >> logs/fetch.log 2>&1

# 每周一早上 9 点合并并摄入
0 9 * * 1 cd /path/to/llm-wiki-agent && python tools/batch_compiler.py && python tools/batch_ingest.py >> logs/ingest.log 2>&1

# 每月 1 号归档过期内容 + 质量检查
0 10 1 * * cd /path/to/llm-wiki-agent && python tools/archive_stale.py && python tools/health.py && python tools/lint.py >> logs/maintain.log 2>&1
```

### Windows (Task Scheduler)

创建 `scripts/schedule.ps1`：

```powershell
$repo = "E:\A_Project\llm-wiki-agent"
Set-Location $repo

# Fetch
python tools/fetchers/rss_fetcher.py --config config/rss_sources.yaml
python tools/fetchers/arxiv_fetcher.py --config config/arxiv_sources.yaml

# Compile & Ingest
python tools/batch_compiler.py
python tools/batch_ingest.py

# Maintenance (weekly)
python tools/archive_stale.py
python tools/health.py
python tools/build_graph.py
```

然后在 Task Scheduler 中创建任务：
- **触发器**：每天 8:00
- **操作**：启动程序 `powershell.exe`，参数 `-File scripts/schedule.ps1`
- **工作目录**：`E:\A_Project\llm-wiki-agent`

### 跨平台 Python 调度（无 Cron/Task Scheduler 时）

安装 `schedule`：
```bash
pip install schedule
```

创建 `tools/scheduler.py`（可选）：

```python
import schedule
import time
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent

def run(cmd):
    subprocess.run([sys.executable, *cmd.split()], cwd=REPO)

schedule.every().day.at("08:00").do(run, "tools/fetchers/rss_fetcher.py --config config/rss_sources.yaml")
schedule.every().monday.at("09:00").do(run, "tools/batch_compiler.py && tools/batch_ingest.py")

while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## 实体收敛策略（防止重复实体页）

高频摄入最大的风险是同一实体被写成不同页面（如 `OpenAI.md`、`OpenAI-2.md`）。

**三层防护：**

1. **Ingest Prompt 强化**  
   在 `ingest.py` 的 prompt 中加入：
   > "摄入前必须检查 wiki/index.md 和 wiki/entities/ 目录。如果实体已存在（文件名或 label 匹配），必须更新现有页面，禁止创建新页面。"

2. **Batch Compiler 去重**  
   同一批次内按 `source_url` 去重，避免同一新闻被不同 feed 重复抓取。

3. **定期 Heal**  
   每周运行 `python tools/heal.py`，它会扫描 wiki 中提及但未建页的实体，并基于上下文生成页面。这能把分散的引用收敛到统一实体页。

---

## 性能预期与上限

| 指标 | 当前架构承受力 | 优化建议 |
|------|---------------|----------|
| 每周新增源页面 | ~50 篇无压力 | 超过 100 时改用 daily 窗口 |
| 总源页面数 | ~500 篇前端仍流畅 | 超过时启用 archive_stale |
| Graph 节点数 | ~2000 节点 vis.js 正常 | 超过 5000 时考虑图谱分页 |
| 单次 Ingest LLM 调用 | 1 次 / 批次 | Batch Compiler 已减少调用次数 |

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `state.json` 越来越大 | 记录了所有历史 URL | 定期手动清理旧 `processed_urls` 条目 |
| Batch ingest 失败 | `ingest.py` 本身报错 | 检查 LLM API 密钥和余额；单独运行 `python tools/ingest.py <file>` 调试 |
| RSS fetch 无新内容 | URL 被去重过滤 | 删除 `state.json` 中对应 URL 条目再试 |
| Graph 加载变慢 | `graph.json` 太大 | 运行 `python tools/build_graph.py` 确保缓存命中；考虑前端懒加载 |
| 归档后 index.md 仍有链接 | archive_stale 的正则未完全匹配 | 手动编辑 index.md 或使用 `tools/health.py --save` 修复 |

---

## 扩展：添加新的 Fetcher

以 `tools/fetchers/my_fetcher.py` 为例，必须满足：

1. 输出到 `raw-inbox/fetched/<my_source>/<date>-<slug>.md`
2. 文件 frontmatter 必须包含 `source_url` 和 `source_type`
3. 通过 `raw-inbox/state.json` 的 `processed_urls` 做去重
4. 脚本退出码 `0` 表示成功

然后添加到定时任务即可，Batch Compiler 会自动识别并合并。
