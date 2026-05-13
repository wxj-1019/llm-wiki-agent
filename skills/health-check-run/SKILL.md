---
name: health-check-run
version: 1.0.0
author: jarvis-auto
description: Run a comprehensive health check on the knowledge base, including integrity, content quality, and git status.
tags: [health, knowledge-base, quality, git]
priority: 10
requires: []
---

# Health Check Run

## Description
Executes a three-step health check routine to verify knowledge base integrity, assess content quality scores, and report current git status. Ensures the system is in good working order with actionable improvement insights.

## Usage
- Trigger: When asked to perform a health check, system checkup, or status review of the knowledge base.
- Input: No parameters required.
- Output: A summary of three checks: health_check, quality_score, and git_status.

## Workflow
1. Run health check: Verify knowledge base integrity, including file count, missing files, broken links, and sync issues.
2. Assess quality score: Calculate average content quality score and identify pages rated as poor.
3. Check git status: Report commit status relative to origin/main and list modified files.

## Example Prompts
- "Run a health check on my wiki."
- "Perform a system checkup of the knowledge base."
- "What's the current status of the project?"
- "Check the health and quality of the wiki."