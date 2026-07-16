import { createContext, useContext, useEffect, useRef } from "react";
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
  sendMessage: (text: string, sessionId: string) => void;
  resetChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within a ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
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
    // chat.setMessages isn't listed: including chat would re-run this on every streamed token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, messagesQuery.data]);

  useEffect(() => {
    if (!sessionId || !messagesQuery.isError) return;
    toastManager.add({ title: "Chat not found", data: { variant: "error" } });
    void navigate({ to: "/" });
    // navigate isn't listed: TanStack Router's useNavigate() returns a stable reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, messagesQuery.isError]);

  function startNewChat(text: string, newSessionId: string) {
    loadedSessionIdRef.current = newSessionId;
    void chat.sendMessage(text, newSessionId);
  }

  function sendMessage(text: string, currentSessionId: string) {
    void chat.sendMessage(text, currentSessionId);
  }

  function resetChat() {
    chat.setMessages([]);
    loadedSessionIdRef.current = undefined;
  }

  const value: ChatContextValue = {
    messages: chat.messages,
    isLoading: chat.isLoading,
    error: chat.error,
    addToolApprovalResponse: chat.addToolApprovalResponse,
    startNewChat,
    sendMessage,
    resetChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
