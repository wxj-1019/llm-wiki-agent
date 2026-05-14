---
title: "BuildRssYaml"
type: code_func
tags: [typescript, yaml, rss]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# buildRssYaml

Generates YAML string for RSS sources config from [[SystemConfig.rss]] state.

## Signature

```typescript
function buildRssYaml(cfg: SystemConfig): string
```

## Returns
- A string containing YAML with RSS feed list (name/url pairs) with a comment header.

## Related
- [[useConfigStore]] — used in `saveToServer`
- [[parseRssYaml]] — reverse parsing function
