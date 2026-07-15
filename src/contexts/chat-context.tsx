import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { UIMessage } from "@tanstack/ai-react";

import { usePlataChat } from "@/hooks/use-plata-chat";
import { apiGet } from "@/lib/ai/fetch";
import { toastManager } from "@/components/ui/toast-manager";

interface ChatContextValue {
  messages: UIMessage[];
  isLoading: boolean;
  error: Error | undefined;
  addToolApprovalResponse: ReturnType<typeof usePlataChat>["addToolApprovalResponse"];
  /** Starts a brand-new chat: marks `sessionId` as already-loaded (skipping hydration,
   *  since the session doesn't exist server-side yet) and sends the first message. */
  startNewChat: (text: string, sessionId: string) => void;
  /** Sends a message into an already-hydrated session. */
  sendMessage: (text: string, sessionId: string) => void;
  /** Clears the conversation and forgets which session was last loaded. */
  resetChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within a ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = usePlataChat();
  const navigate = useNavigate();
  const sessionId = useParams({ strict: false })?.sessionId;
  const loadedSessionIdRef = useRef<string | undefined>(undefined);

  const messagesQuery = useQuery({
    queryKey: ["chat-session-messages", sessionId],
    queryFn: () => apiGet<UIMessage[]>(`/api/chat/sessions/${sessionId}/messages`),
    enabled: Boolean(sessionId) && loadedSessionIdRef.current !== sessionId,
  });

  useEffect(() => {
    if (!sessionId || !messagesQuery.data) return;
    chat.setMessages(messagesQuery.data);
    loadedSessionIdRef.current = sessionId;
    // chat.setMessages isn't listed: this effect only fires when sessionId or the query result
    // actually changes, and whichever render that happens on already closes over the current
    // chat — including chat itself would instead re-run this effect on every chat-state change
    // (e.g. every streamed token), which isn't what this effect is reacting to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, messagesQuery.data]);

  useEffect(() => {
    if (!sessionId || !messagesQuery.isError) return;
    toastManager.add({ title: "Chat not found", data: { variant: "error" } });
    void navigate({ to: "/" });
    // navigate isn't listed: TanStack Router's useNavigate() returns a stable function
    // reference, the standard reason it's safe to omit from effect deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, messagesQuery.isError]);

  const startNewChat = useCallback(
    (text: string, newSessionId: string) => {
      loadedSessionIdRef.current = newSessionId;
      void chat.sendMessage(text, newSessionId);
    },
    [chat.sendMessage],
  );

  const sendMessage = useCallback(
    (text: string, currentSessionId: string) => {
      void chat.sendMessage(text, currentSessionId);
    },
    [chat.sendMessage],
  );

  const resetChat = useCallback(() => {
    chat.setMessages([]);
    loadedSessionIdRef.current = undefined;
  }, [chat.setMessages]);

  const value: ChatContextValue = useMemo(
    () => ({
      messages: chat.messages,
      isLoading: chat.isLoading,
      error: chat.error,
      addToolApprovalResponse: chat.addToolApprovalResponse,
      startNewChat,
      sendMessage,
      resetChat,
    }),
    [
      chat.messages,
      chat.isLoading,
      chat.error,
      chat.addToolApprovalResponse,
      startNewChat,
      sendMessage,
      resetChat,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
