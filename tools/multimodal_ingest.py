#!/usr/bin/env python3
"""Multimodal ingestion — describe images and embed them into wiki.

Usage:
    python tools/multimodal_ingest.py describe <image_path>
    python tools/multimodal_ingest.py describe-pdf <pdf_path>

Requires: PIL (pip install Pillow)
Optional: google-generativeai or anthropic for vision API
"""
from __future__ import annotations

import argparse
import base64
import datetime
import io
import json
import os
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).parent.parent


def _encode_image(path: Path) -> str:
    """Base64 encode an image file."""
    return base64.b64encode(path.read_bytes()).decode()


def describe_image_gemini(image_input: Path | io.BytesIO, api_key: str | None = None) -> str | None:
    """Describe an image using Gemini Flash vision API."""
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    try:
        from PIL import Image
        img = Image.open(image_input)
        # Resize if too large
        max_size = 1024
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            img = img.resize((int(img.width * ratio), int(img.height * ratio)))
        # Save to temp for base64
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode()

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key={key}"
        body = json.dumps({
            "contents": [{
                "parts": [
                    {"text": "Describe this image in detail. Focus on objects, text, diagrams, and relationships."},
                    {"inlineData": {"mimeType": "image/jpeg", "data": b64}},
                ]
            }]
        }).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"Vision API error: {e}", file=sys.stderr)
        return None


def describe_image_ollama(image_input: Path | io.BytesIO | bytes) -> str | None:
    """Describe an image using Ollama vision model (llava)."""
    try:
        from tools.ollama_client import _post
        if isinstance(image_input, Path):
            b64 = _encode_image(image_input)
        elif isinstance(image_input, bytes):
            b64 = base64.b64encode(image_input).decode()
        elif isinstance(image_input, io.BytesIO):
            b64 = base64.b64encode(image_input.getvalue()).decode()
        else:
            b64 = base64.b64encode(image_input.read()).decode()
        result = _post("/api/generate", {
            "model": "llava",
            "prompt": "Describe this image in detail.",
            "images": [b64],
            "stream": False,
        })
        return result.get("response")
    except Exception as e:
        print(f"Ollama vision error: {e}", file=sys.stderr)
        return None


def describe_image(image_input: str | Path | io.BytesIO | bytes) -> str | None:
    """Auto-select vision backend: Gemini → Ollama → None.

    Accepts a file path (str or Path) or a file-like object / bytes.
    """
    pil_input: Path | io.BytesIO
    b64_source: Path | io.BytesIO | bytes

    if isinstance(image_input, str):
        p = Path(image_input)
        if not p.exists():
            return None
        pil_input = p
        b64_source = p
    elif isinstance(image_input, Path):
        if not image_input.exists():
            return None
        pil_input = image_input
        b64_source = image_input
    elif isinstance(image_input, bytes):
        pil_input = io.BytesIO(image_input)
        b64_source = image_input
    elif isinstance(image_input, io.BytesIO):
        pil_input = image_input
        b64_source = image_input
    elif hasattr(image_input, "read"):
        # Generic file-like object
        pos = image_input.tell() if hasattr(image_input, "tell") else 0
        data = image_input.read()
        if hasattr(image_input, "seek"):
            image_input.seek(pos)
        pil_input = io.BytesIO(data)
        b64_source = io.BytesIO(data)
    else:
        return None

    # Try Gemini first
    if os.environ.get("GEMINI_API_KEY"):
        result = describe_image_gemini(pil_input)
        if result:
            return result

    # Fallback to Ollama
    if os.environ.get("OLLAMA_URL"):
        result = describe_image_ollama(b64_source)
        if result:
            return result

    return None


def save_description(image_path: str, description: str) -> Path:
    """Save image description to raw/.image-descriptions/."""
    p = Path(image_path)
    out_dir = REPO / "raw" / ".image-descriptions"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{p.stem}.md"
    header = f"""---
title: "Image Description: {p.name}"
type: source
tags: [image, multimodal]
date: {datetime.datetime.now().strftime('%Y-%m-%d')}
source_image: {p.name}
---

"""
    out_path.write_text(header + description, encoding="utf-8")
    return out_path


def ingest_image(image_path: str) -> Path | None:
    """Describe an image and save the description to raw/.image-descriptions/.

    Returns the path to the generated markdown file, or None if description failed.
    """
    description = describe_image(image_path)
    if not description:
        return None
    return save_description(image_path, description)


def main() -> int:
    parser = argparse.ArgumentParser(description="Multimodal ingestion")
    sub = parser.add_subparsers(dest="cmd")

    p_desc = sub.add_parser("describe", help="Describe an image")
    p_desc.add_argument("image_path")
    p_desc.add_argument("--save", action="store_true", help="Save to raw/.image-descriptions/")

    p_ingest = sub.add_parser("ingest", help="Ingest an image (describe + save)")
    p_ingest.add_argument("image_path")

    args = parser.parse_args()

    if args.cmd == "describe":
        result = describe_image(args.image_path)
        if result:
            print(result)
            if args.save:
                out = save_description(args.image_path, result)
                print(f"\nSaved to {out}")
        else:
            print("Failed to describe image. Set GEMINI_API_KEY or OLLAMA_URL.", file=sys.stderr)
            return 1
    elif args.cmd == "ingest":
        out = ingest_image(args.image_path)
        if out:
            print(f"Ingested to {out}")
        else:
            print("Failed to describe image. Set GEMINI_API_KEY or OLLAMA_URL.", file=sys.stderr)
            return 1
    else:
        parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
