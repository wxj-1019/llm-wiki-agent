---
title: "ParseArxivYaml"
type: code_func
tags: [typescript, yaml, arxiv]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# parseArxivYaml

Lightweight regex-based YAML parser for arXiv sources config.

## Signature

```typescript
function parseArxivYaml(text: string): Partial<SystemConfig> | null
```

## Returns
- A partial [[SystemConfig]] with `arxiv` field populated, or `null` on parse failure.

## Parsing Strategy
- Splits text by lines
- Uses regex `/label:\s*"(.+)"/` and `/query:\s*"(.+)"/` to extract label/query pairs
- Assembles pairs in order (label immediately followed by query)
- Wraps in try/catch, returns null on any error

## Related
- [[useConfigStore]] — used in `loadFromServer`
- [[buildArxivYaml]] — reverse generation function
- [[RegexBasedYamlParsing]] — the parsing pattern
