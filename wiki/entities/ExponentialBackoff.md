---
title: "ExponentialBackoff"
type: entity
tags: [pattern, network, resilience]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

ExponentialBackoff is a retry strategy used in [[WikiStore]]'s polling loop. On each consecutive failure, the polling interval doubles (30s → 1min → 2min → ... up to 5 min max). After 10 consecutive failures, polling stops permanently.