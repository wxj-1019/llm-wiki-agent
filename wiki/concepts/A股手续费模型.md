---
title: "A股手续费模型"
type: concept
tags: [finance, cost, trading]
sources: [backtest-engine]
last_updated: 2026-05-09
---

[[A股手续费模型]] 是 [[backtest-engine|回测引擎]] 中的真实成本模拟，包含：印花税（卖出0.1%）、佣金（双向0.025%可配置）、过户费（沪市双向0.002%）。配合自适应滑点模型，确保回测结果贴近真实交易环境，避免过拟合下的虚假盈利。
