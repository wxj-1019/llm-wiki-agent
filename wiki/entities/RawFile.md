---
title: "RawFile"
type: entity
tags: [typescript, interface]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

`RawFile` is an interface representing a file in the `raw/` directory, with fields: `path`, `name`, `size`, `modified`, and optional `ingested` flag. Returned by `fetchRawFiles()` in [[data-service-dataservicets|dataService.ts]].