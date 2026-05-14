---
title: "ParseRssYaml"
type: code_func
tags: [typescript, yaml, rss]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# parseRssYaml

Lightweight regex-based YAML parser for RSS sources config.

## Signature

```typescript
function parseRssYaml(text: string): Partial<SystemConfig> | null
```

## Returns
- A partial [[SystemConfig]] with `rss` field populated, or `null` on parse failure.

## Parsing Strategy
- Splits text by lines
- Uses regex `/name:\s*"(.+)"/` and `/url:\s*"(.+)"/` to extract name/url pairs
- Assembles pairs in order (name immediately followed by url)
- Wraps in try/catch, returns null on any error

## Related
- [[useConfigStore]] — used in `loadFromServer`
- [[buildRssYaml]] — reverse generation function
- [[RegexBasedYamlParsing]] — the parsing pattern
