#!/usr/bin/env python3
"""Self-contained vis.js HTML template for the knowledge graph visualization."""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent

TYPE_COLORS = {
    "source": "#4CAF50",
    "entity": "#2196F3",
    "concept": "#FF9800",
    "synthesis": "#9C27B0",
    "unknown": "#9E9E9E",
}

EDGE_COLORS = {
    "EXTRACTED": "#555555",
    "INFERRED": "#FF5722",
    "AMBIGUOUS": "#BDBDBD",
}


def render_html(nodes: list[dict], edges: list[dict]) -> str:
    """Generate self-contained vis.js HTML with interactive filtering."""
    def _escape_json_for_script(value: str) -> str:
        """Escape JSON string for safe embedding inside <script> tags.
        Prevents </script> injection and JavaScript line-separator exploits."""
        return value.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")

    nodes_json = _escape_json_for_script(json.dumps(nodes, indent=2, ensure_ascii=False))
    edges_json = _escape_json_for_script(json.dumps(edges, indent=2, ensure_ascii=False))

    legend_items = "".join(
        f'<span style="background:{color};padding:3px 8px;margin:2px;border-radius:3px;font-size:12px">{t}</span>'
        for t, color in TYPE_COLORS.items() if t != "unknown"
    )

    n_extracted = len([e for e in edges if e.get('type') == 'EXTRACTED'])
    n_inferred = len([e for e in edges if e.get('type') == 'INFERRED'])
    n_ambiguous = len([e for e in edges if e.get('type') == 'AMBIGUOUS'])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LLM Wiki — Knowledge Graph</title>
<script src="https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js" crossorigin="anonymous" integrity="sha384-Ux6phic9PEHJ38YtrijhkzyJ8yQlH8i/+buBR8s3mAZOJrP1gwyvAcIYl3GWtpX1"></script>
<style>
  body {{ margin: 0; background: #1a1a2e; font-family: 'Inter', sans-serif; color: #eee; }}
  #graph {{ width: 100vw; height: 100vh; }}
  #controls {{
    position: fixed; top: 10px; left: 10px; background: rgba(10,10,30,0.88);
    padding: 14px; border-radius: 10px; z-index: 10; max-width: 280px;
    backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08);
  }}
  #controls h3 {{ margin: 0 0 10px; font-size: 15px; letter-spacing: 0.5px; }}
  #search {{ width: 100%; padding: 6px 8px; margin-bottom: 10px; background: #222; color: #eee; border: 1px solid #444; border-radius: 6px; font-size: 13px; }}
  #controls p {{ margin: 10px 0 0; font-size: 11px; color: #9ea3b0; line-height: 1.5; }}
  .filter-group {{ margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); }}
  .filter-group label {{ display: block; font-size: 12px; color: #bbb; margin-bottom: 4px; }}
  .slider-row {{ display: flex; align-items: center; gap: 8px; margin-top: 4px; }}
  .slider-row input[type=range] {{ flex: 1; accent-color: #FF5722; }}
  .slider-val {{ font-size: 12px; color: #FF5722; min-width: 28px; text-align: right; font-weight: bold; }}
  .cb-row {{ display: flex; align-items: center; gap: 6px; font-size: 12px; margin: 3px 0; cursor: pointer; }}
  .cb-row input {{ accent-color: #FF5722; }}
  #drawer {{
    position: fixed; top: 0; right: 0; width: clamp(480px, 33vw, 720px); max-width: 100vw; height: 100vh;
    background: rgba(7, 10, 24, 0.96); border-left: 1px solid rgba(255,255,255,0.08);
    box-shadow: -18px 0 36px rgba(0,0,0,0.35); z-index: 20; display: none;
    flex-direction: column; backdrop-filter: blur(10px);
  }}
  #drawer.open {{ display: flex; }}
  #drawer-header {{
    padding: 18px 18px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);
  }}
  #drawer-topline {{
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }}
  #drawer-title {{ margin: 0; font-size: 20px; line-height: 1.2; }}
  #drawer-close {{
    background: transparent; color: #9ea3b0; border: 0; font-size: 24px; line-height: 1;
    cursor: pointer; padding: 0;
  }}
  #drawer-meta {{ margin-top: 8px; font-size: 12px; color: #9ea3b0; }}
  #drawer-path {{ margin-top: 6px; font-size: 12px; color: #72788a; word-break: break-all; }}
  #drawer-preview {{
    margin-top: 12px; font-size: 13px; color: #d7d9e0; line-height: 1.6;
  }}
  #drawer-related {{
    padding: 12px 18px 0; font-size: 12px; color: #9ea3b0;
  }}
  #drawer-related-list {{
    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;
  }}
  .related-chip {{
    background: rgba(255,255,255,0.08); color: #f1f2f7; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px; font-size: 12px; padding: 5px 10px; cursor: pointer;
  }}
  #drawer-content {{
    flex: 1; min-height: 0; padding: 14px 18px 18px; overflow: auto;
  }}
  #drawer-markdown {{
    color: #e6e8ef; font-size: 13px; line-height: 1.72;
  }}
  #drawer-markdown h1, #drawer-markdown h2, #drawer-markdown h3,
  #drawer-markdown h4, #drawer-markdown h5, #drawer-markdown h6 {{
    margin: 1.2em 0 0.55em; line-height: 1.3; color: #fff;
  }}
  #drawer-markdown h1 {{ font-size: 24px; }}
  #drawer-markdown h2 {{ font-size: 20px; }}
  #drawer-markdown h3 {{ font-size: 17px; }}
  #drawer-markdown p {{ margin: 0 0 0.95em; }}
  #drawer-markdown ul, #drawer-markdown ol {{ margin: 0 0 1em 1.35em; padding: 0; }}
  #drawer-markdown li {{ margin: 0.35em 0; }}
  #drawer-markdown hr {{ border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.2em 0; }}
  #drawer-markdown blockquote {{
    margin: 0 0 1em; padding: 0.85em 1em; border-left: 3px solid rgba(101, 181, 255, 0.8);
    background: rgba(255,255,255,0.04); color: #d7d9e0; border-radius: 0 10px 10px 0;
  }}
  #drawer-markdown pre {{
    margin: 0 0 1em; white-space: pre-wrap; word-break: break-word; line-height: 1.55;
    font-size: 12px; color: #e6e8ef; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }}
  #drawer-markdown code {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.92em; background: rgba(255,255,255,0.08); padding: 0.16em 0.38em;
    border-radius: 6px; color: #ffde91;
  }}
  #drawer-markdown pre code {{ background: transparent; padding: 0; color: inherit; border-radius: 0; }}
  #drawer-markdown .wikilink {{ color: #86c8ff; font-weight: 600; }}
  @media (max-width: 960px) {{
    #drawer {{ width: 100vw; }}
  }}
  #stats {{
    position: fixed; top: 10px; right: 10px; background: rgba(10,10,30,0.88);
    padding: 10px 14px; border-radius: 10px; font-size: 12px;
    backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08);
  }}
  /* Loading overlay */
  #loading-overlay {{
    position: fixed; inset: 0; background: #1a1a2e; z-index: 100;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    transition: opacity 0.8s ease;
  }}
  #loading-overlay.hidden {{ opacity: 0; pointer-events: none; }}

  /* ── Neural Constellation Loader ── */
  .kb-loader {{
    position: relative;
    width: 140px; height: 140px;
    margin-bottom: 24px;
  }}
  /* Core */
  .kb-core {{
    position: absolute;
    top: 50%; left: 50%;
    width: 16px; height: 16px;
    margin: -8px 0 0 -8px;
    background: radial-gradient(circle, #ffab91 0%, #ff5722 70%);
    border-radius: 50%;
    box-shadow:
      0 0 20px rgba(255,87,34,0.5),
      0 0 40px rgba(255,87,34,0.25),
      0 0 80px rgba(255,87,34,0.1);
    animation: kbCorePulse 2.4s ease-in-out infinite;
    z-index: 5;
  }}
  /* Orbit rings */
  .kb-orbit {{
    position: absolute;
    top: 50%; left: 50%;
    border-radius: 50%;
    border: 1px dashed rgba(255,255,255,0.07);
    transform: translate(-50%, -50%);
  }}
  .kb-orbit.o1 {{ width: 44px; height: 44px; --orbit-r: 22px; animation: kbSpin 6s linear infinite; }}
  .kb-orbit.o2 {{ width: 76px; height: 76px; --orbit-r: 38px; animation: kbSpin 10s linear infinite reverse; }}
  .kb-orbit.o3 {{ width: 108px; height: 108px; --orbit-r: 54px; animation: kbSpin 14s linear infinite; }}
  /* Orbital nodes */
  .kb-node {{
    position: absolute;
    top: 50%; left: 50%;
    width: 6px; height: 6px;
    margin: -3px 0 0 -3px;
    background: var(--color);
    border-radius: 50%;
    transform: rotate(var(--angle)) translateY(calc(var(--orbit-r) * -1));
    animation: kbNodeGlow 2.5s ease-in-out infinite;
    animation-delay: var(--delay, 0s);
  }}
  .kb-orbit.o1 .kb-node {{ animation-duration: 2.2s; }}
  .kb-orbit.o2 .kb-node {{ animation-duration: 2.8s; }}
  .kb-orbit.o3 .kb-node {{ animation-duration: 3.4s; }}
  /* Data particles that travel along orbital paths */
  .kb-particle {{
    position: absolute;
    top: 50%; left: 50%;
    width: 3px; height: 3px;
    margin: -1.5px 0 0 -1.5px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 6px #fff;
    opacity: 0;
    transform: rotate(var(--p-angle)) translateY(calc(var(--orbit-r) * -1));
    animation: kbParticleTravel 3s ease-out infinite;
    animation-delay: var(--p-delay, 0s);
  }}
  /* Text & progress */
  .loader-text {{ margin-top: 4px; font-size: 15px; color: #ddd; letter-spacing: 0.3px; font-weight: 500; }}
  .loader-sub {{ margin-top: 6px; font-size: 12px; color: #777; min-height: 18px; }}
  .loader-bar {{
    width: 240px; height: 3px; background: rgba(255,255,255,0.06);
    border-radius: 3px; margin-top: 14px; overflow: hidden;
  }}
  .loader-bar-inner {{
    height: 100%; background: linear-gradient(90deg, #ff5722, #ff8a65);
    border-radius: 3px;
    transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: 0 0 8px rgba(255,87,34,0.3);
  }}
  /* Keyframes — only transform and opacity for 60fps compositor animation */
  @keyframes kbCorePulse {{
    0%, 100% {{ transform: scale(1); opacity: 1; }}
    50% {{ transform: scale(1.35); opacity: 0.85; }}
  }}
  @keyframes kbCoreRing {{
    0%, 100% {{ transform: scale(1); opacity: 0.25; }}
    50% {{ transform: scale(1.6); opacity: 0; }}
  }}
  @keyframes kbSpin {{
    from {{ transform: translate(-50%, -50%) rotate(0deg); }}
    to {{ transform: translate(-50%, -50%) rotate(360deg); }}
  }}
  @keyframes kbNodeBreathe {{
    0%, 100% {{ opacity: 0.35; }}
    50% {{ opacity: 1; }}
  }}
  @keyframes kbAmbient {{
    0%, 100% {{ opacity: 0.15; }}
    50% {{ opacity: 0.35; }}
  }}
</style>
</head>
<body>
<div id="controls">
  <h3>LLM Wiki Graph</h3>
  <input id="search" type="text" placeholder="Search nodes..." oninput="searchNodes(this.value)">
  <div>{legend_items}</div>
  <div class="filter-group">
    <label>Edge Types</label>
    <div class="cb-row"><input type="checkbox" id="cb-extracted" checked onchange="applyFilters()"><span style="color:#888">━</span> Extracted ({n_extracted})</div>
    <div class="cb-row"><input type="checkbox" id="cb-inferred" checked onchange="applyFilters()"><span style="color:#FF5722">━</span> Inferred ({n_inferred})</div>
    <div class="cb-row"><input type="checkbox" id="cb-ambiguous" onchange="applyFilters()"><span style="color:#BDBDBD">━</span> Ambiguous ({n_ambiguous})</div>
  </div>
  <div class="filter-group">
    <label>Min Confidence</label>
    <div class="slider-row">
      <input type="range" id="conf-slider" min="0" max="100" value="50" oninput="applyFilters()">
      <span class="slider-val" id="conf-val">0.50</span>
    </div>
  </div>
  <p>Click a node to highlight its connected neighbors and view the markdown on the right. Click the background to restore the full graph.</p>
</div>
<div id="loading-overlay">
  <div class="kb-loader">
    <div class="kb-ambient"></div>
    <div class="kb-core"></div>
    <div class="kb-core-ring"></div>
    <div class="kb-orbit o1">
      <div class="kb-node" style="--angle:0deg;--color:#4fc3f7;--delay:0s;"></div>
    </div>
    <div class="kb-orbit o2">
      <div class="kb-node" style="--angle:70deg;--color:#81c784;--delay:0.5s;"></div>
      <div class="kb-node" style="--angle:250deg;--color:#ffb74d;--delay:1.1s;"></div>
    </div>
    <div class="kb-orbit o3">
      <div class="kb-node" style="--angle:140deg;--color:#ba68c8;--delay:0.2s;"></div>
      <div class="kb-node" style="--angle:260deg;--color:#e57373;--delay:1.3s;"></div>
      <div class="kb-node" style="--angle:20deg;--color:#4dd0e1;--delay:1.9s;"></div>
    </div>
  </div>
  <div class="loader-text" id="loader-text">Synthesizing knowledge graph...</div>
  <div class="loader-sub" id="loader-progress">0 / 0 nodes</div>
  <div class="loader-bar"><div class="loader-bar-inner" id="loader-bar-inner" style="width:0%"></div></div>
</div>
<div id="graph"></div>
<aside id="drawer">
  <div id="drawer-header">
    <div id="drawer-topline">
      <h2 id="drawer-title"></h2>
      <button id="drawer-close" onclick="clearSelection()" aria-label="Close drawer">×</button>
    </div>
    <div id="drawer-meta"></div>
    <div id="drawer-path"></div>
    <div id="drawer-preview"></div>
  </div>
  <div id="drawer-related">
    Related nodes
    <div id="drawer-related-list"></div>
  </div>
  <div id="drawer-content">
    <div id="drawer-markdown"></div>
  </div>
</aside>
<div id="stats"></div>
<script>
const originalNodes = {nodes_json};
const originalEdges = {edges_json}.map(edge => ({{
  ...edge,
  id: edge.id || `${{edge.from}}->${{edge.to}}:${{edge.type || "INFERRED"}}`,
}}));
const nodes = new vis.DataSet();
const edges = new vis.DataSet();
const adjacency = new Map();
const searchInput = document.getElementById("search");
const stats = document.getElementById("stats");
const loaderProgress = document.getElementById("loader-progress");
const loaderBarInner = document.getElementById("loader-bar-inner");
const loadingOverlay = document.getElementById("loading-overlay");
const controls = {{
  extracted: document.getElementById("cb-extracted"),
  inferred: document.getElementById("cb-inferred"),
  ambiguous: document.getElementById("cb-ambiguous"),
  confSlider: document.getElementById("conf-slider"),
  confValue: document.getElementById("conf-val"),
}};
const nodeMap = new Map(originalNodes.map(node => [node.id, node]));
let activeNodeId = null;

// Batch load data to avoid blocking the UI on large graphs
const BATCH_SIZE = 80;
function batchAddItems(dataSet, items, onProgress) {{
  return new Promise((resolve) => {{
    let idx = 0;
    function addBatch() {{
      const batch = items.slice(idx, idx + BATCH_SIZE);
      dataSet.add(batch);
      idx += batch.length;
      if (onProgress) onProgress(idx, items.length);
      if (idx < items.length) {{
        requestAnimationFrame(addBatch);
      }} else {{
        resolve();
      }}
    }}
    addBatch();
  }});
}}

async function initGraph() {{
  // Phase 1: load nodes
  await batchAddItems(nodes, originalNodes, (done, total) => {{
    loaderProgress.textContent = `Loading nodes... ${{done}} / ${{total}}`;
    loaderBarInner.style.width = `${{(done / total) * 35}}%`;
  }});
  // Phase 2: load edges
  await batchAddItems(edges, originalEdges, (done, total) => {{
    loaderProgress.textContent = `Loading edges... ${{done}} / ${{total}}`;
    loaderBarInner.style.width = `${{35 + (done / total) * 25}}%`;
  }});
  // Phase 3: build network (triggers physics)
  loaderProgress.textContent = "Computing layout...";
  loaderBarInner.style.width = "65%";
  initNetwork();
}}

function hexToRgba(color, alpha) {{
  if (!color) return `rgba(255, 255, 255, ${{alpha}})`;
  const normalized = color.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map(ch => ch + ch).join("")
    : normalized;
  const intValue = Number.parseInt(value, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${{r}}, ${{g}}, ${{b}}, ${{alpha}})`;
}}

function escapeHtml(text) {{
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}}

function stripFrontmatter(markdown) {{
  return (markdown || "").replace(/^---\\n[\\s\\S]*?\\n---\\n?/, "");
}}

function renderInlineMarkdown(text) {{
  let html = escapeHtml(text);
  html = html.replace(/\\[\\[([^\\]]+)\\]\\]/g, '<span class="wikilink">[[$1]]</span>');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>");
  html = html.replace(/\\*([^*]+)\\*/g, "<em>$1</em>");
  return html;
}}

function renderMarkdown(markdown) {{
  const lines = stripFrontmatter(markdown).split(/\\r?\\n/);
  const html = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quoteLines = [];
  let inCodeBlock = false;
  let codeLines = [];

  function flushParagraph() {{
    if (!paragraph.length) return;
    html.push(`<p>${{renderInlineMarkdown(paragraph.join(" "))}}</p>`);
    paragraph = [];
  }}

  function flushList() {{
    if (!listType || !listItems.length) return;
    const items = listItems.map(item => `<li>${{renderInlineMarkdown(item)}}</li>`).join("");
    html.push(`<${{listType}}>${{items}}</${{listType}}>`);
    listType = null;
    listItems = [];
  }}

  function flushQuote() {{
    if (!quoteLines.length) return;
    html.push(`<blockquote>${{quoteLines.map(line => renderInlineMarkdown(line)).join("<br>")}}</blockquote>`);
    quoteLines = [];
  }}

  function flushCode() {{
    if (!codeLines.length) {{
      html.push("<pre><code></code></pre>");
      return;
    }}
    html.push(`<pre><code>${{escapeHtml(codeLines.join("\\n"))}}</code></pre>`);
    codeLines = [];
  }}

  for (const rawLine of lines) {{
    const line = rawLine.replace(/\\t/g, "    ");
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {{
      flushParagraph();
      flushList();
      flushQuote();
      if (inCodeBlock) {{
        flushCode();
        inCodeBlock = false;
      }} else {{
        inCodeBlock = true;
      }}
      continue;
    }}

    if (inCodeBlock) {{
      codeLines.push(rawLine);
      continue;
    }}

    if (!trimmed) {{
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }}

    const headingMatch = trimmed.match(/^(#{{1,6}})\\s+(.+)$/);
    if (headingMatch) {{
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      html.push(`<h${{level}}>${{renderInlineMarkdown(headingMatch[2])}}</h${{level}}>`);
      continue;
    }}

    if (/^(-{{3,}}|\\*{{3,}})$/.test(trimmed)) {{
      flushParagraph();
      flushList();
      flushQuote();
      html.push("<hr>");
      continue;
    }}

    const quoteMatch = trimmed.match(/^>\\s?(.*)$/);
    if (quoteMatch) {{
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }}
    flushQuote();

    const unorderedMatch = trimmed.match(/^[-*]\\s+(.+)$/);
    if (unorderedMatch) {{
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      continue;
    }}

    const orderedMatch = trimmed.match(/^\\d+\\.\\s+(.+)$/);
    if (orderedMatch) {{
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }}

    flushList();
    paragraph.push(trimmed);
  }}

  if (inCodeBlock) flushCode();
  flushParagraph();
  flushList();
  flushQuote();
  return html.join("");
}}

function rebuildAdjacency(filteredEdges) {{
  adjacency.clear();
  for (const node of originalNodes) {{
    adjacency.set(node.id, new Set());
  }}
  for (const edge of filteredEdges) {{
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }}
}}

function currentEdgeState() {{
  const minConf = parseInt(controls.confSlider.value, 10) / 100;
  controls.confValue.textContent = minConf.toFixed(2);
  return {{
    showExtracted: controls.extracted.checked,
    showInferred: controls.inferred.checked,
    showAmbiguous: controls.ambiguous.checked,
    minConf,
  }};
}}

function passesEdgeFilters(edge, edgeState) {{
  const typeOk = (edge.type === "EXTRACTED" && edgeState.showExtracted)
    || (edge.type === "INFERRED" && edgeState.showInferred)
    || (edge.type === "AMBIGUOUS" && edgeState.showAmbiguous);
  const confOk = (edge.confidence ?? 1.0) >= edgeState.minConf;
  return typeOk && confOk;
}}

function searchNodes(q) {{
  applyFilters(q, activeNodeId);
}}

function clearSelection() {{
  activeNodeId = null;
  closeDrawer();
  applyFilters(searchInput.value, null);
}}

function closeDrawer() {{
  document.getElementById("drawer").classList.remove("open");
}}

function openDrawer(node, relatedIds) {{
  document.getElementById("drawer").classList.add("open");
  document.getElementById("drawer-title").textContent = node.label;
  const communityText = Number.isInteger(node.group) && node.group >= 0 ? ` · community ${{node.group}}` : "";
  document.getElementById("drawer-meta").textContent = `${{node.type}}${{communityText}}`;
  document.getElementById("drawer-path").textContent = node.path;
  document.getElementById("drawer-preview").textContent = node.preview || "";
  document.getElementById("drawer-markdown").innerHTML = renderMarkdown(node.markdown || "");

  const relatedList = document.getElementById("drawer-related-list");
  relatedList.innerHTML = "";
  const relatedNodes = originalNodes
    .filter(item => relatedIds.has(item.id) && item.id !== node.id)
    .sort((a, b) => a.label.localeCompare(b.label));

  if (relatedNodes.length === 0) {{
    const empty = document.createElement("span");
    empty.textContent = "No directly connected nodes";
    relatedList.appendChild(empty);
    return;
  }}

  for (const related of relatedNodes) {{
    const chip = document.createElement("button");
    chip.className = "related-chip";
    chip.textContent = related.label;
    chip.onclick = () => focusNode(related.id);
    relatedList.appendChild(chip);
  }}
}}

function applyFilters(query = searchInput.value, selectedNodeId = activeNodeId) {{
  const lower = (query || "").trim().toLowerCase();
  const edgeState = currentEdgeState();
  const filteredEdges = originalEdges.filter(edge => passesEdgeFilters(edge, edgeState));
  rebuildAdjacency(filteredEdges);

  const relatedIds = selectedNodeId
    ? new Set([selectedNodeId, ...(adjacency.get(selectedNodeId) || [])])
    : null;
  const filteredNodeIds = new Set();
  for (const edge of filteredEdges) {{
    filteredNodeIds.add(edge.from);
    filteredNodeIds.add(edge.to);
  }}

  let visibleNodeCount = 0;
  const nodeUpdates = originalNodes.map(node => {{
    const matchesSearch = !lower || node.label.toLowerCase().includes(lower);
    const isActive = selectedNodeId === node.id;
    const isConnected = filteredNodeIds.has(node.id);
    const isRelated = !relatedIds || relatedIds.has(node.id);
    const hidden = !selectedNodeId && !lower && !isConnected;
    const emphasized = matchesSearch && isRelated && (isConnected || !!lower || isActive);

    if (!hidden) {{
      visibleNodeCount += 1;
    }}

    return {{
      id: node.id,
      hidden,
      color: {{
        background: emphasized ? node.color : hexToRgba(node.color, hidden ? 0.05 : 0.14),
        border: emphasized ? hexToRgba(node.color, 0.96) : hexToRgba(node.color, hidden ? 0.08 : 0.22),
        highlight: {{ background: node.color, border: hexToRgba(node.color, 1) }},
        hover: {{ background: node.color, border: hexToRgba(node.color, 1) }},
      }},
      font: {{
        color: emphasized ? "#f2f3f8" : hidden ? "rgba(242,243,248,0.08)" : "rgba(242,243,248,0.2)",
      }},
      borderWidth: isActive ? 5 : 2,
      size: isActive ? 18 : 12,
    }};
  }});

  const edgeUpdates = originalEdges.map(edge => {{
    const enabled = passesEdgeFilters(edge, edgeState);
    if (!enabled) {{
      return {{ id: edge.id, hidden: true }};
    }}

    const matchesSearch = !lower
      || nodeMap.get(edge.from)?.label.toLowerCase().includes(lower)
      || nodeMap.get(edge.to)?.label.toLowerCase().includes(lower);
    const isRelated = !relatedIds || relatedIds.has(edge.from) || relatedIds.has(edge.to);
    const touchesActive = !!selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId);
    const emphasized = matchesSearch && isRelated;

    return {{
      id: edge.id,
      hidden: false,
      width: touchesActive ? 2.8 : emphasized ? 1.2 : 0.6,
      color: emphasized ? edge.color : hexToRgba(edge.color, 0.08),
    }};
  }});

  nodes.update(nodeUpdates);
  edges.update(edgeUpdates);

  if (selectedNodeId) {{
    const activeNode = nodeMap.get(selectedNodeId);
    if (activeNode) {{
      openDrawer(activeNode, relatedIds || new Set([selectedNodeId]));
    }}
  }}

  const focusSuffix = selectedNodeId && nodeMap.get(selectedNodeId)
    ? ` · focused: ${{nodeMap.get(selectedNodeId).label}}`
    : "";
  stats.textContent = `${{visibleNodeCount}} nodes · ${{filteredEdges.length}} edges${{focusSuffix}}`;
}}

const container = document.getElementById("graph");

// Adaptive physics based on graph size
const nodeCount = originalNodes.length;
const gravConst = nodeCount > 150 ? -12000 : nodeCount > 80 ? -8000 : nodeCount > 30 ? -5000 : -2000;
const springLen = nodeCount > 150 ? 300 : nodeCount > 80 ? 250 : nodeCount > 30 ? 200 : 150;

let network = null;

function initNetwork() {{
  network = new vis.Network(container, {{ nodes, edges }}, {{
    nodes: {{
      shape: "dot",
      font: {{ color: "#ddd", size: 12, strokeWidth: 3, strokeColor: "#111" }},
      borderWidth: 1.5,
      scaling: {{
        min: 8,
        max: 40,
        label: {{ enabled: true, min: 10, max: 20, drawThreshold: 6, maxVisible: 24 }},
      }},
    }},
    edges: {{
      width: 0.8,
      smooth: {{ type: "continuous" }},
      arrows: {{ to: {{ enabled: true, scaleFactor: 0.4 }} }},
      color: {{ inherit: false }},
      hoverWidth: 2,
    }},
    physics: {{
      stabilization: {{ iterations: 200, updateInterval: 25, fit: true }},
      barnesHut: {{ gravitationalConstant: gravConst, springLength: springLen, springConstant: 0.02, damping: 0.15 }},
      minVelocity: 0.75,
    }},
    interaction: {{ hover: true, tooltipDelay: 150, hideEdgesOnDrag: true, hideEdgesOnZoom: true }},
  }});

  // Update progress during physics stabilization
  network.on("stabilizationProgress", function(params) {{
    const pct = Math.min(100, Math.round((params.iterations / params.total) * 100));
    loaderBarInner.style.width = `${{65 + (pct * 0.32)}}%`;
    loaderProgress.textContent = `Computing layout... ${{params.iterations}} / ${{params.total}}`;
  }});

  // Hide loader when stable, then fit viewport for a seamless transition
  network.once("stabilizationIterationsDone", function () {{
    loaderBarInner.style.width = "100%";
    loaderProgress.textContent = "Ready!";
    setTimeout(() => {{
      loadingOverlay.classList.add("hidden");
      network.fit({{ animation: {{ duration: 400, easingFunction: "easeInOutQuad" }} }});
    }}, 300);
  }});

  network.on("click", params => {{
    if (params.nodes.length > 0) {{
      focusNode(params.nodes[0]);
    }} else {{
      clearSelection();
    }}
  }});

  applyFilters();
}}

// Start initialization when DOM is ready
if (document.readyState === "loading") {{
  document.addEventListener("DOMContentLoaded", initGraph);
}} else {{
  initGraph();
}}

function focusNode(nodeId) {{
  activeNodeId = nodeId;
  applyFilters(searchInput.value, nodeId);
  const node = nodeMap.get(nodeId) || nodes.get(nodeId);
  const relatedIds = new Set([nodeId, ...(adjacency.get(nodeId) || [])]);
  openDrawer(node, relatedIds);
  network.focus(nodeId, {{
    scale: 1.1,
    animation: {{ duration: 300, easingFunction: "easeInOutQuad" }},
  }});
}}

// Click handler moved into initNetwork
</script>
</body>
</html>"""
