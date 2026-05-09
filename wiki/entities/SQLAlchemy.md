---
title: "SQLAlchemy"
type: entity
tags: []
sources: [data-model-overview]
last_updated: 2026-05-09
---

# SQLAlchemy

SQLAlchemy 是 [[MainFundSelection|主力选股系统]] 使用的 ORM 框架，模型目录为 `app/models/`。根据 [[data-model-overview|数据模型总览]]，所有数据库模型均使用 SQLAlchemy 定义，遵循自增 Integer 主键、统一时间戳（created_at / updated_at）、JSON/JSONB 灵活数据类型等设计规范。

相关页面：[[data-model-overview|数据模型总览]]、[[MainFundSelection]]、[[PostgreSQL]]