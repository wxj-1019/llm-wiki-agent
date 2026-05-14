---
title: "config/database.yaml"
type: entity
tags: [config, database, search]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

Configuration file that determines which search backend is active. Fields: `database.backend` (sqlite|postgresql), `database.postgresql` (connection config). Read by [[get_search_backend]].