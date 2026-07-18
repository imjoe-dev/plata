import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/ai/fetch";

export interface ChatSessionItem {
  id: string;
  title: string;
  /** ISO timestamp of the most recent Chat Session Activity — the server's ordering key. */
  updated_at: string;
}

interface HistoryPage {
  items: ChatSessionItem[];
  next_cursor: string | null;
}

/** Shared with the chat provider, whose freshness invalidation must target this exact key. */
export const CHAT_SESSIONS_QUERY_KEY = ["chat-sessions"] as const;

/**
 * The user's Chat Session History: pages of `GET /api/chat/sessions`, newest Activity
 * first. The cursor is opaque — passed back verbatim as the `cursor` query param.
 * `hasNextPage`/`fetchNextPage` are exposed for the "Show more" control (issue #31).
 */
export function useChatSessions() {
  const query = useInfiniteQuery({
    queryKey: CHAT_SESSIONS_QUERY_KEY,
    queryFn: ({ pageParam }) => apiGet<HistoryPage>("/api/chat/sessions", { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: HistoryPage) => lastPage.next_cursor,
  });

  return {
    sessions: query.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
