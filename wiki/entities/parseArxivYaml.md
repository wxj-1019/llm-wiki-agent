---
title: "parseArxivYaml"
type: entity
tags: [typescript, yaml, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**parseArxivYaml** is a lightweight regex-based YAML parser that extracts arXiv query configurations from backend YAML files. Called by [[useConfigStore]]'s `loadFromServer` method. Uses regex patterns `label:"(.+)"` and `query:"(.+)"` for extraction.

### Related
- [[useConfigStore]] — uses this function in loadFromServer
- [[SystemConfig]] — the output data structure
- [[buildArxivYaml]] — the reverse generation function
