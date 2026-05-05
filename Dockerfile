# LLM Wiki Agent — Multi-stage Docker build
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/wiki-viewer
COPY wiki-viewer/package*.json ./
RUN npm ci --prefer-offline --no-audit
COPY wiki-viewer/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim AS backend
WORKDIR /app

# Install system deps for markitdown and general build
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libc6-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend tools
COPY tools/ ./tools/

# Copy data directories (will be overridden by volumes in compose)
COPY wiki/ ./wiki/
COPY raw/ ./raw/
COPY graph/ ./graph/
COPY config/ ./config/
COPY examples/ ./examples/
COPY docs/ ./docs/
COPY README.md LICENSE AGENTS.md CLAUDE.md GEMINI.md ./

# Copy built frontend
COPY --from=frontend-builder /app/wiki-viewer/dist ./wiki-viewer/dist

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["python", "tools/api_server.py", "--host", "0.0.0.0", "--port", "8000"]
