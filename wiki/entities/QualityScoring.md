---
title: "QualityScoring"
type: entity
tags: [automation, quality, scoring]
sources: [auto-ingest-pipeline-auto-ingest-py]
last_updated: 2026-05-14
---

# QualityScoring

A heuristic quality assessment system used by [[AutoIngestPipeline]] to score fetched content on a 0-100 scale. It penalizes noise patterns (login forms, copyright boilerplate, navigation links, financial calculator widgets) and rewards content signals (headings, bold text, markdown links, bullet lists, Chinese prose with punctuation). Pages below the threshold (default 30) are skipped.

## Scoring Components
- **Noise penalties**: Login/register forms (-50), copyright disclaimers (-20 to -30), navigation patterns (-30), navigation titles (-60)
- **Content rewards**: Headings (+10), bold text (+5), markdown links (+5), bullet lists (+10), English prose (+10), Chinese prose (+15), dates (+15), Chinese punctuation (+10)
- **Length scoring**: <100 chars (-30), 100-500 (+10), 500-5000 (+30), >5000 (+40)
- **Structure bonus**: 5+ paragraphs (+20), 2+ paragraphs (+10)
- **Link farm penalty**: >3 links per paragraph (-30), >1 link per paragraph (-10)

## Output
Returns a tuple of `(score: float, grade: str, reasons: list[str])` where grade is one of: excellent (≥80), good (≥60), fair (≥40), poor (≥20), noise (<20).

## Related
- [[AutoIngestPipeline]] — primary consumer
- [[ContentFingerprinting]] — complementary dedup mechanism
