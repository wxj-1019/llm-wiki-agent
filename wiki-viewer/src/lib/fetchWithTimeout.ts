export class FetchTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchInit } = init;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  if (fetchInit.signal) {
    const externalSignal = fetchInit.signal;
    const onExternalAbort = () => controller.abort();
    externalSignal.addEventListener('abort', onExternalAbort);
    const originalClear = id;
    const cleanup = () => {
      clearTimeout(originalClear);
      externalSignal.removeEventListener('abort', onExternalAbort);
    };
    try {
      const res = await fetch(input, { ...fetchInit, signal: controller.signal });
      cleanup();
      return res;
    } catch (err) {
      cleanup();
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (externalSignal.aborted) throw err;
        throw new FetchTimeoutError();
      }
      throw err;
    }
  }

  try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FetchTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

/** Fetch with automatic retry on transient failures. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number; retries?: number; retryDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 1, retryDelayMs = 500, ...rest } = init;
  let lastError: Error | undefined;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchWithTimeout(input, rest);
    } catch (err) {
      lastError = err as Error;
      if (i < retries && !(err instanceof FetchTimeoutError)) {
        await new Promise((r) => setTimeout(r, retryDelayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}
