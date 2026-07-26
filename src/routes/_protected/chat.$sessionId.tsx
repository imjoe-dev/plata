import { createFileRoute } from "@tanstack/react-router";

import { ChatConversation } from "@/components/chat-conversation";
import { useChatContext } from "@/contexts/chat-context";

export const Route = createFileRoute("/_protected/chat/$sessionId")({
  component: ChatSessionPage,
});

function ChatSessionPage() {
  const { sessionId } = Route.useParams();
  const { messages, isLoading, error, addToolApprovalResponse, sendMessage } = useChatContext();

  function handleSubmit(text: string): boolean {
    if (isLoading) return false;
    sendMessage(text, sessionId);
    return true;
  }

  return (
    <ChatConversation
      messages={messages}
      error={error}
      onSubmit={handleSubmit}
      addToolApprovalResponse={addToolApprovalResponse}
      sessionId={sessionId}
      messagesClassName="px-4 py-4"
    />
  );
}
