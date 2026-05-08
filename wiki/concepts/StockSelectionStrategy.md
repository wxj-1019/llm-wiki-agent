---
title: "StockSelectionStrategy"
type: concept
tags: [strategy, stock-selection, quant]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-08
---

# StockSelectionStrategy

AI驱动的股票选择策略框架。在[[MainFundSelectionSystem|主力选股系统]]中，选股策略定义了从数据过滤到量化评分的全套规则。

## 7种内置策略

| 策略ID | 中文名 | 核心特征 |
|--------|--------|----------|
| main_force_accumulation | 主力吸筹 | 资金大涨幅小，建仓特征 |
| short_term_breakout | 短期爆发 | 突破形态，涨幅5-30% |
| value_stable | 价值稳健 | 低PE/PB，高ROE |
| growth_potential | 成长潜力 | 高成长评分，容忍较高PE |
| sector_rotation | 板块轮动 | 板块热度+龙头效应 |
| low_risk_income | 低风险收益 | 低波动，低估值 |
| controlled_pullback | 温和回调多头 | 回调-1%~-3%，均线多头 |

## 策略配置分层

GLOBAL → STRATEGY-SPECIFIC → DATABASE VERSION → USER OVERRIDE

## Connections

- [[MainFundSelectionSystem]] — 所属系统
- [[QuantPreScoring]] — 策略自适应权重
- [[RiskManagement]] — 策略风控
- [[Backtesting]] — 回测验证