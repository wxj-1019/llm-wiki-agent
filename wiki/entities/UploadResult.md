---
title: "UploadResult"
type: entity
tags: [typescript, interface]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

`UploadResult` is an interface for upload responses with `success: boolean`, `path: string`, optional `converted_path: string | null`, and `size: number`. Returned by `uploadFile()` and `uploadText()` in [[data-service-dataservicets|dataService.ts]].