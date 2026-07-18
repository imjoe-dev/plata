import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/ai/fetch";

export interface ChatSessionItem {
  id: string;
  title: string;
  /** ISO timestamp of the most recent Chat Session Activity — the server's ordering key. */
  updated_at: string;
}

interface ChatSessionsPage {
  items: ChatSessionItem[];
  next_cursor: string | null;
}

/**
 * The user's Chat Session History: pages of `GET /api/chat/sessions`, newest Activity
 * first, keyed `["chat-sessions"]` (the key the chat provider will invalidate for
 * freshness). The cursor is opaque — passed back verbatim as the `cursor` query param.
 * `hasNextPage`/`fetchNextPage` are exposed for the "Show more" control (issue #31).
 */
export function useChatSessions() {
  const query = useInfiniteQuery({
    queryKey: ["chat-sessions"],
    queryFn: ({ pageParam }) =>
      apiGet<ChatSessionsPage>("/api/chat/sessions", { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: ChatSessionsPage) => lastPage.next_cursor,
  });

  return {
    sessions: query.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
