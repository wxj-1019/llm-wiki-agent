---
title: "AI智能盯盘"
type: entity
tags: [ai-monitoring, smart-alert, real-time]
sources: [price-monitoring-and-alert-system]
last_updated: 2026-05-09
---

# AI智能盯盘

AI 智能盯盘是[[价格监控与预警系统]]的高级功能，位于 `app/api/v1/stock/ai_monitoring.py`。它利用 AI 实时监控持仓股票，自动识别异常信号，结合市场环境、个股技术面、资金流向综合判断，生成智能交易建议（减仓/加仓/持有/清仓）。

## 关键特性

- 支持自定义盯盘规则（价格偏离、成交量异动、技术信号）
- 告警触发时自动生成交易计划
- 与通知与消息系统集成进行多渠道通知
- 支持启动/停止 AI 盯盘