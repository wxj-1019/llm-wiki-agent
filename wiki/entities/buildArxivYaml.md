---
title: "buildArxivYaml"
type: entity
tags: [typescript, yaml, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**buildArxivYaml** is a TypeScript function that generates YAML-formatted string from the [[SystemConfig.arxiv]] section for backend persistence. Called by [[useConfigStore]]'s `saveToServer` method.

### Related
- [[useConfigStore]] — uses this function in saveToServer
- [[SystemConfig]] — the source data structure
- [[parseArxivYaml]] — the reverse parsing function
