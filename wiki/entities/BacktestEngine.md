---
title: "BacktestEngine"
type: entity
tags: [backtest, engine, backtrader]
sources: [backtest-engine]
last_updated: 2026-05-09
---

[[backtest-engine|回测引擎]] 是基于 [[BackTrader]] 封装的回测核心，位于 `app/services/backtest/engine.py`。支持 A股真实手续费、自适应滑点、三种仓位管理（fixed/percent/risk_based）、止损止盈和追踪止损。是 [[MainFundSelection|主力选股系统]] 策略验证的核心组件。
