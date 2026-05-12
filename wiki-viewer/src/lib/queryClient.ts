/**
 * Global QueryClient with exponential-backoff retry defaults.
 *
 * Config:
 *   queries:  retry 3, delay 1s→2s→4s→cap 10s, staleTime 30s, no refetch on focus
 *   mutations: retry 0 (side effects must not automatically retry)
 *
 * Also subscribes to query errors to push network retry events to notificationStore.
 */
import { QueryClient } from "@tanstack/react-query";
import { useNotificationStore } from "../stores/notificationStore";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ── Global error observer ──
// Push retry-exhausted events to notificationStore so the user sees
// something is wrong even without an SSE connection.
queryClient.getQueryCache().subscribe((event) => {
  if (
    "query" in event &&
    event.query.state.status === "error" &&
    event.query.state.error
  ) {
    const err = event.query.state.error as Error;
    const failedQuery = Array.isArray(event.query.queryKey)
      ? event.query.queryKey.join("/")
      : String(event.query.queryKey);

    useNotificationStore.getState().addNotification(
      `请求失败 (已重试 3 次): ${failedQuery} — ${err.message}`,
      "error",
      undefined,
    );
  }
});
