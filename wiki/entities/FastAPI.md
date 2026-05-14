---
title: "FastAPI"
type: entity
tags: [python, web-framework, api, async]
sources: [APIServer.md, api-server-fastapi-backend-for-llm-wiki-viewer.md]
---

# FastAPI

**FastAPI** is a modern, high-performance Python web framework used exclusively in this project to build the backend API server for the LLM Wiki Viewer. It is the foundation upon which `api_server.py` is constructed, providing asynchronous request handling, automatic OpenAPI documentation generation, WebSocket support, and type-validated request/response models via Pydantic. In this codebase, FastAPI enables the server to serve static frontend assets, expose RESTful endpoints for wiki page listing, retrieval, and full-text search, support streaming server-sent events (SSE) for chat and ingestion progress, and handle GraphQL-style graph queries. Its async-native design is particularly well-suited to the concurrency demands of streaming LLM chat interactions, file uploads, and webhook processing. The framework also underpins the server's security measures—such as path traversal protection and token-based webhook authentication—by providing middleware and dependency injection capabilities. As the sole web framework in the project, FastAPI is tightly coupled with the J.A.R.V.I.S. persona chat feature, the webhook ingestion system, and the file upload pipeline, making it the central orchestrator for all HTTP and WebSocket communication between the React frontend and the underlying wiki data layer.