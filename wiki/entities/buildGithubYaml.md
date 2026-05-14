---
title: "buildGithubYaml"
type: entity
tags: [typescript, yaml, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**buildGithubYaml** is a TypeScript function that generates YAML-formatted string from the [[SystemConfig.github]] section for backend persistence. Called by [[useConfigStore]]'s `saveToServer` method.

### Related
- [[useConfigStore]] — uses this function in saveToServer
- [[SystemConfig]] — the source data structure
- [[parseGithubYaml]] — the reverse parsing function
