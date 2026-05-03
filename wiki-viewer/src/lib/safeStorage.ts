/**
 * Safe localStorage wrapper with schema validation and error handling.
 *
 * Prevents XSS via poisoned storage by validating parsed data against
 * expected shapes before returning it to the application.
 */

export function safeGet<T>(key: string, validator: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (validator(parsed)) return parsed;
    console.warn(`[safeStorage] Invalid data for key "${key}", resetting to fallback.`);
    localStorage.removeItem(key);
    return fallback;
  } catch {
    return fallback;
  }
}

export function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be full or disabled — ignore silently
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// --- Common validators ---

export function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

export function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v);
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
