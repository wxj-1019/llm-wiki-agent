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

  /** Returns the *effective* delta (or full replacement) for this chunk.
   *  If the chunk is a duplicate, returns `null`.
   */
  process(chunk: string | undefined): { text: string; isDelta: boolean } | null {
    if (!chunk) return null;
    if (chunk === this.lastChunk) return null;

    const previous = this.lastChunk;
    this.lastChunk = chunk;

    // Cumulative content detection: some providers send the full text so far
    // instead of just the new tokens.
    if (previous && chunk.startsWith(previous) && chunk.length > previous.length) {
      return { text: chunk.slice(previous.length), isDelta: true };
    }

    return { text: chunk, isDelta: false };
  }

  reset() {
    this.lastChunk = '';
  }
}

/**
 * Convenience helper that merges a new chunk into an existing assistant
 * message content string, handling both cumulative and delta providers.
 */
export function mergeStreamChunk(currentContent: string, chunkResult: { text: string; isDelta: boolean }): string {
  if (chunkResult.isDelta) {
    return currentContent + chunkResult.text;
  }
  // Non-delta: provider sent full text (or we have no prior state)
  return chunkResult.text;
}
