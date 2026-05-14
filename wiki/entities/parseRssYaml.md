---
title: "parseRssYaml"
type: entity
tags: [typescript, yaml, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**parseRssYaml** is a lightweight regex-based YAML parser that extracts RSS feed configurations from backend YAML files. Called by [[useConfigStore]]'s `loadFromServer` method. Uses regex patterns `name:"(.+)"` and `url:"(.+)"` for extraction.

### Related
- [[useConfigStore]] — uses this function in loadFromServer
- [[SystemConfig]] — the output data structure
- [[buildRssYaml]] — the reverse generation function
