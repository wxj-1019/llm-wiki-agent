---
title: "parseGithubYaml"
type: entity
tags: [typescript, yaml, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**parseGithubYaml** is a lightweight regex-based YAML parser that extracts GitHub config from backend YAML files. Called by [[useConfigStore]]'s `loadFromServer` method. Not a full YAML parser — uses line-by-line regex matching with fallback to `null` on failure.

### Related
- [[useConfigStore]] — uses this function in loadFromServer
- [[SystemConfig]] — the output data structure
- [[buildGithubYaml]] — the reverse generation function
