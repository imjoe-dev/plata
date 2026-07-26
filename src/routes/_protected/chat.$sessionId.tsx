import { createFileRoute } from "@tanstack/react-router";

import { ChatConversation } from "@/components/chat-conversation";
import { useChatContext } from "@/contexts/chat-context";

export const Route = createFileRoute("/_protected/chat/$sessionId")({
  component: ChatSessionPage,
});

function ChatSessionPage() {
  const { messages, error, submit } = useChatContext();

  return (
    <ChatConversation
      messages={messages}
      error={error}
      onSubmit={submit}
      messagesClassName="px-4 py-4"
    />
  );
}
