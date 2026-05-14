---
title: "ParseGithubYaml"
type: code_func
tags: [typescript, yaml, github]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# parseGithubYaml

Lightweight regex-based YAML parser for GitHub sources config.

## Signature

```typescript
function parseGithubYaml(text: string): Partial<SystemConfig> | null
```

## Returns
- A partial [[SystemConfig]] with `github` field populated, or `null` on parse failure.

## Parsing Strategy
- Splits text by lines
- Uses regex patterns for `token:`, `enabled:`, `languages:`, `since_days:`, `per_language:`
- Handles list items under `languages:` with `- "..."` pattern
- Wraps in try/catch, returns null on any error

## Related
- [[useConfigStore]] — used in `loadFromServer`
- [[buildGithubYaml]] — reverse generation function
- [[RegexBasedYamlParsing]] — the parsing pattern
