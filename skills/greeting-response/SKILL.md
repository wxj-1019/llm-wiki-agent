---
name: greeting-response
version: 1.0.0
author: jarvis-auto
description: Responds to a greeting with a welcome message and notification log.
tags: [greeting, response, notification]
priority: 10
requires: [notify_log, notify_desktop]
---

# Greeting Response

## Description
This skill handles a simple greeting from the user by logging the request and displaying a friendly welcome message on the desktop.

## Usage
- Trigger: When the user sends a greeting message such as "你好" or "hello".
- Input: The greeting text from the user.
- Output: A desktop notification with a welcome message and a log entry for the interaction.

## Workflow
1. Log the user's greeting request via `notify_log`.
2. Display a friendly desktop notification via `notify_desktop` with a welcome message.

## Example Prompts
- "你好"
- "Hello"
- "Hi there"