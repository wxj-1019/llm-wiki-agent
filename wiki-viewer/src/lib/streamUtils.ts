/**
 * Streaming chunk deduplication and delta detection utilities.
 *
 * LLM streaming APIs (especially via litellm) may resend identical chunks
 * due to network retries or provider quirks. These helpers skip duplicates
 * and detect whether the provider sends cumulative text or true deltas.
 */

export interface StreamChunk {
  chunk?: string;
  error?: string;
  done?: boolean;
  sources?: unknown;
}

export class StreamDeduplicator {
  private lastChunk = '';
  private fullText = '';

  process(chunk: string | undefined): { text: string; isDelta: boolean } | null {
    if (!chunk) return null;
    if (chunk === this.lastChunk) return null;

    const previous = this.lastChunk;
    this.lastChunk = chunk;

    // Case 1: chunk extends the full text (most common cumulative pattern)
    if (this.fullText && chunk.startsWith(this.fullText) && chunk.length > this.fullText.length) {
      const delta = chunk.slice(this.fullText.length);
      this.fullText = chunk;
      return { text: delta, isDelta: true };
    }

    // Case 2: chunk extends the previous chunk (fallback cumulative pattern)
    if (previous && chunk.startsWith(previous) && chunk.length > previous.length) {
      const delta = chunk.slice(previous.length);
      this.fullText = chunk;
      return { text: delta, isDelta: true };
    }

    // Case 3: partial overlap (handles skipped chunks or network reordering)
    if (this.fullText) {
      const overlap = this._findOverlap(this.fullText, chunk);
      if (overlap > 0 && overlap < chunk.length) {
        const delta = chunk.slice(overlap);
        this.fullText += delta;
        return { text: delta, isDelta: true };
      }
    }

    // Case 4: treat as independent delta
    this.fullText += chunk;
    return { text: chunk, isDelta: true };
  }

  private _findOverlap(a: string, b: string): number {
    const maxOverlap = Math.min(a.length, b.length);
    for (let i = maxOverlap; i > 0; i--) {
      if (a.endsWith(b.slice(0, i))) return i;
    }
    return 0;
  }

  reset() {
    this.lastChunk = '';
    this.fullText = '';
  }
}

/**
 * Convenience helper that merges a new chunk into an existing assistant
 * message content string, handling both cumulative and delta providers.
 */
export function mergeStreamChunk(currentContent: string, chunkResult: { text: string; isDelta: boolean }): string {
  return currentContent + chunkResult.text;
}
