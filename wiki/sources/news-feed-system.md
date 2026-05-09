---
title: "新闻订阅系统 — 舆情监控与AI情感分析"
type: source
tags: [news, sentiment-analysis, ai-analysis, stock-market]
date: 2026-05-09
source_file: raw/uploads/10_新闻订阅系统.md
---

## Summary

新闻订阅系统是平台的舆情监控与信息聚合工具，从[[东方财富]]、[[新浪财经]]、[[财联社]]、[[同花顺]]、[[第一财经]]五大财经媒体抓取A股相关新闻，利用[[Qwen]]大模型进行情感分析和板块/股票提取，支持多维度查询和自动清理。该系统为[[MainFundSelection|主力选股系统]]提供舆情数据支撑。

## Key Claims

- 覆盖5大财经新闻源，每30分钟自动抓取一次
- 使用[[Qwen]]模型进行AI情感分析，分类为利好/中性/利空
- 提取52个固定板块标签和6位A股代码
- 基于URL+标题前100字符去重，每批10条批量分析降低API成本
- 30天旧新闻自动归档或删除，控制数据库体积
- 提供完整REST API：最新新闻、个股新闻、来源筛选、手动抓取等

## Key Quotes

> "新闻订阅系统是平台的舆情监控与信息聚合工具"
> "自动识别新闻情感倾向，量化舆情影响"

## Connections

- [[MainFundSelection]] — 主力选股系统可集成新闻舆情作为选股因子
- [[Qwen]] — 使用Qwen模型进行新闻情感分析和内容提取
- [[A股市场]] — 面向A股市场的新闻聚合与情感分析
- [[EventDriven]] — 新闻订阅系统可为事件驱动策略提供实时事件信号
- [[MoneyFlowStrategy]] — 重大新闻影响资金流向，两者可联动
- [[RiskManagement]] — 利空新闻可作为风控预警信号
- [[user-profile-system]] — 用户画像系统可整合新闻偏好分析

## Contradictions

None detected with existing wiki content.