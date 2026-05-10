---
title: "News Aggregration"
type: concept
tags: [news, aggregation, data-pipeline, finance]
sources: [news-feed-system]
last_updated: 2026-05-09
---

新闻聚合是指从多个来源自动抓取、去重、分析新闻的技术方案。在[[新闻订阅系统]]中，系统从东方财富、新浪财经、财联社、同花顺、第一财经五大财经媒体聚合A股相关新闻，通过URL+标题双重去重机制避免重复，再经批量AI情感分析和个股/板块提取后入库，为后续的投资决策和舆情监控提供数据支撑。