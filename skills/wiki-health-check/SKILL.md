---
name: wiki-health-check
version: 1.0.0
author: jarvis-auto
description: Runs a comprehensive health check on a wiki, including quality scoring, page statistics, and issue detection.
tags: [wiki, health-check, quality-score, maintenance]
priority: 10
requires: []
---

# Wiki Health Check

## Description
Performs a full health check on a wiki by running three sequential steps: a general health check, a quality score evaluation, and a notification log. The skill analyzes page count, quality scores (excellent, good, poor), identifies top issues (e.g., missing wikilinks, frontmatter fields), and checks for empty files, sync issues, or broken links.

## Usage
- Trigger: When a user requests a wiki health check, status, or quality assessment.
- Input: No explicit parameters required; runs standard health check and quality score operations on the current wiki.
- Output: A summary report with page count, average quality score, breakdown of excellent/good/poor pages, top issues, and list of worst-scoring pages.

## Workflow
1. Run the general health check operation to verify wiki integrity.
2. Run the quality score operation to calculate page quality metrics and identify issues.
3. Run the notification log operation to log the completion and results for review.

## Example Prompts
- "Run a health check on the wiki."
- "Perform a wiki quality assessment."
- "Check wiki status and give me a report."
- "Do a health check and show me the quality scores."