---
title: "BuildArxivYaml"
type: code_func
tags: [typescript, yaml, arxiv]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# buildArxivYaml

Generates YAML string for arXiv sources config from [[SystemConfig.arxiv]] state.

## Signature

```typescript
function buildArxivYaml(cfg: SystemConfig): string
```

## Returns
- A string containing YAML with arXiv query list (label/query pairs) with a comment header.

## Related
- [[useConfigStore]] — used in `saveToServer`
- [[parseArxivYaml]] — reverse parsing function
