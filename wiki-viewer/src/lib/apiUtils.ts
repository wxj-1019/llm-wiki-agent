/**
 * Safe JSON parse — checks for empty body first to avoid the cryptic
 * "Unexpected end of JSON input" error when the backend is down or
 * returns an empty response.
 */
export async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error(
      `Backend returned empty response (HTTP ${res.status}). Is the API server running on port 8666?`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.length > 200 ? text.slice(0, 200) + '...' : text;
    throw new Error(
      `Backend returned non-JSON response (HTTP ${res.status}): ${preview}`
    );
  }
}

export type ErrorCategory =
  | 'auth-failure'
  | 'not-found'
  | 'rate-limited'
  | 'server-error'
  | 'network-error'
  | 'timeout';

export interface ClassifiedError {
  category: ErrorCategory;
  statusCode?: number;
  message: string;
  retryable: boolean;
}

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof Response) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return { category: 'auth-failure', statusCode: status, message: 'Authentication failed', retryable: false };
    }
    if (status === 404) {
      return { category: 'not-found', statusCode: status, message: 'Resource not found', retryable: false };
    }
    if (status === 429) {
      return { category: 'rate-limited', statusCode: status, message: 'Rate limited', retryable: true };
    }
    if (status >= 500) {
      return { category: 'server-error', statusCode: status, message: `Server error (${status})`, retryable: true };
    }
    return { category: 'server-error', statusCode: status, message: `HTTP ${status}`, retryable: false };
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return { category: 'timeout', message: 'Request timed out', retryable: true };
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return { category: 'network-error', message: 'Network error', retryable: true };
    }
    return { category: 'network-error', message: error.message, retryable: false };
  }

  return { category: 'network-error', message: 'Unknown error', retryable: false };
}

export function getErrorDisplayMessage(classified: ClassifiedError): string {
  switch (classified.category) {
    case 'auth-failure':
      return 'Authentication required. Please check your credentials.';
    case 'not-found':
      return 'The requested resource was not found.';
    case 'rate-limited':
      return 'Too many requests. Please wait a moment and try again.';
    case 'server-error':
      return 'Server error. Please try again later.';
    case 'network-error':
      return 'Network error. Please check your connection.';
    case 'timeout':
      return 'Request timed out. Please try again.';
    default:
      return 'An unexpected error occurred.';
  }
}
