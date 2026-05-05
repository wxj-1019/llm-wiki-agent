# n8n Workflow Integration

Connect LLM Wiki Agent to n8n for automated ingestion and processing.

## Prerequisites

1. Set `WIKI_WEBHOOK_TOKEN` environment variable in both Wiki API and n8n:
   ```bash
   export WIKI_WEBHOOK_TOKEN="your-secure-random-token"
   ```

2. Expose Wiki API to n8n (same Docker network or public URL).

## Workflows

### 1. Auto Ingest (`webhook-workflow-example.json`)

Trigger: n8n webhook → Wiki API `/api/webhook/ingest`

Setup:
1. Import `webhook-workflow-example.json` into n8n
2. Set `WIKI_WEBHOOK_TOKEN` in n8n credentials
3. Update the HTTP Request node URL to your Wiki API endpoint
4. Activate the workflow

Usage:
```bash
curl -X POST https://n8n.your-domain.com/webhook/wiki-ingest \
  -H "Content-Type: application/json" \
  -d '{"path": "raw/my-file.md"}'
```

### 2. URL Clip Workflow

Trigger: RSS feed / Telegram / Email → n8n → Wiki API `/api/webhook/clip`

Steps:
1. Add an RSS Feed trigger node (or Telegram bot, email, etc.)
2. Extract URL from the payload
3. HTTP Request node → `POST /api/webhook/clip`
   ```json
   {
     "url": "{{ $json.url }}",
     "tags": ["rss", "auto"]
   }
   ```
4. Set header `X-Webhook-Token: {{ $env.WIKI_WEBHOOK_TOKEN }}`

### 3. GitHub Push → Refresh

Trigger: GitHub webhook → n8n → Wiki API `/api/webhook/github`

This triggers `tools/refresh.py` to update stale sources after a git push.
