---
title: "LogEntry"
type: entity
tags: [typescript, interface]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

`LogEntry` is an interface with `date` (YYYY-MM-DD), `operation` (string), and `title` (string) fields representing a parsed wiki log entry. Parsed from `wiki/log.md` via regex in `parseLogEntries()` within [[data-service-dataservicets|dataService.ts]].