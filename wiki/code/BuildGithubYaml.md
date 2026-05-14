---
title: "BuildGithubYaml"
type: code_func
tags: [typescript, yaml, github]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# buildGithubYaml

Generates YAML string for GitHub sources config from [[SystemConfig.github]] state.

## Signature

```typescript
function buildGithubYaml(cfg: SystemConfig): string
```

## Returns
- A string containing YAML with token, trending enabled/languages/since_days/per_language, with a comment header.

## Related
- [[useConfigStore]] — used in `saveToServer`
- [[parseGithubYaml]] — reverse parsing function
