---
title: "DataPipeline"
type: concept
tags: [data, pipeline, system-design]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# DataPipeline

[[MainFundSelection|主力选股系统]]的数据管道从多种来源获取并处理数据。

## Key Components

- **主数据源**：[[WencaiAPI]]（问财API，通过pywencai）获取主力资金流向
- **备选降级**：[[Tushare]]主力资金数据
- **技术指标**：Tushare计算MA5/MA20/MA60、MACD、KDJ、布林带、RSI、量比、波动率
- **增强数据**：龙虎榜数据（近30日）、北向资金持股变动
- **数据质量保障**：3次重试 + 指数退避超时、20条/65%完整率门槛

## Connections

- [[WencaiAPI]] — 主要数据源
- [[Tushare]] — 备选数据源
- [[MainFundSelection]] — 数据管道的消费方
- [[RiskManagement]] — 数据质量检查是风险控制的一环