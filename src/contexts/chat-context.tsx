import { createContext, use, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { UIMessage } from "@tanstack/ai-react";

import { usePlataChat } from "@/hooks/use-plata-chat";
import { CHAT_SESSIONS_QUERY_KEY } from "@/hooks/use-chat-sessions";
import { apiGet } from "@/lib/ai/fetch";
import { toastManager } from "@/components/ui/toast-manager";

interface ChatContextValue {
  messages: UIMessage[];
  isLoading: boolean;
  error: Error | undefined;
  addToolApprovalResponse: ReturnType<typeof usePlataChat>["addToolApprovalResponse"];
  /** The route's param, falling back to a minted id the route hasn't caught up to yet. Empty
   *  only on the landing route before anything has been sent. */
  sessionId: string;
  /** Starts a new Chat Session when there isn't one. Returns false while a send is in flight. */
  submit: (text: string) => boolean;
  resetChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = use(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within a ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const chat = usePlataChat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeSessionId = useParams({ strict: false })?.sessionId;
  // Covers the window where a brand-new chat has been sent but navigation hasn't landed, so
  // nothing else knows which Chat Session is in view.
  const [mintedSessionId, setMintedSessionId] = useState<string | undefined>(undefined);
  const loadedSessionIdRef = useRef<string | undefined>(undefined);
  const wasLoadingRef = useRef(false);

  const messagesQuery = useQuery({
    queryKey: ["chat-session-messages", routeSessionId],
    queryFn: () => apiGet<UIMessage[]>(`/api/chat/sessions/${routeSessionId}/messages`),
    enabled: Boolean(routeSessionId) && loadedSessionIdRef.current !== routeSessionId,
  });

  useEffect(() => {
    if (!routeSessionId || !messagesQuery.data) return;
    chat.setMessages(messagesQuery.data);
    loadedSessionIdRef.current = routeSessionId;
    // chat.setMessages isn't listed: including chat would re-run this on every streamed token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSessionId, messagesQuery.data]);

  useEffect(() => {
    if (!chat.error) return;
    toastManager.add({
      title: chat.error.message || "Something went wrong. Please try again.",
      data: { variant: "error" },
    });
  }, [chat.error]);

  useEffect(() => {
    if (!routeSessionId || !messagesQuery.isError) return;
    toastManager.add({ title: "Chat not found", data: { variant: "error" } });
    void navigate({ to: "/" });
    // navigate isn't listed: TanStack Router's useNavigate() returns a stable reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSessionId, messagesQuery.isError]);

  // History freshness: when a send completes (loading → idle) the session row and its
  // Activity bump are committed server-side, so invalidate the sidebar's History query.
  // The previous value is tracked in a ref so this fires only on the actual transition —
  // never on mount, at send start, or on unrelated re-renders. Deliberately fires on
  // errored sends too: the user message (and its bump) may have been persisted before
  // the stream failed, so a refetch is the safe read of what actually committed.
  useEffect(() => {
    if (wasLoadingRef.current && !chat.isLoading) {
      void queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_QUERY_KEY });
    }
    wasLoadingRef.current = chat.isLoading;
    // queryClient isn't listed: useQueryClient() returns a stable reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.isLoading]);

  function submit(text: string): boolean {
    if (chat.isLoading) return false;

    if (routeSessionId) {
      void chat.sendMessage(text, routeSessionId);
      return true;
    }

    // Minted client-side (ADR-0002) and marked already-loaded so the hydration query above skips
    // it — the Chat Session doesn't exist server-side yet. Sending before navigating keeps the
    // conversation on screen across the route change.
    const newSessionId = crypto.randomUUID();
    loadedSessionIdRef.current = newSessionId;
    setMintedSessionId(newSessionId);
    void chat.sendMessage(text, newSessionId);
    void navigate({ to: "/chat/$sessionId", params: { sessionId: newSessionId } });
    return true;
  }

  function resetChat() {
    chat.setMessages([]);
    loadedSessionIdRef.current = undefined;
    // Otherwise a later Session Approval lands on the Chat Session the user just left.
    setMintedSessionId(undefined);
  }

  const value: ChatContextValue = {
    messages: chat.messages,
    isLoading: chat.isLoading,
    error: chat.error,
    addToolApprovalResponse: chat.addToolApprovalResponse,
    sessionId: routeSessionId ?? mintedSessionId ?? "",
    submit,
    resetChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
