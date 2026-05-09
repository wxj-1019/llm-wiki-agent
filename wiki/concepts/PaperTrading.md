---
title: "PaperTrading"
type: concept
tags: [trading, simulation, realtime]
sources: [backtest-engine]
last_updated: 2026-05-09
---

[[PaperTrading|纸面交易 / 实时回测]] 是 [[backtest-engine|回测引擎]] 的高级功能之一，支持三种模式：`paper`（模拟真实交易）、`signal`（仅生成信号）、`backtest`（今日验证）。通过 WebSocket 实时推送交易信号、成交记录和实时盈亏，支持盘中策略验证。
