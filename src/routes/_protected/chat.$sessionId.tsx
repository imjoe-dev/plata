import { createFileRoute } from "@tanstack/react-router";

import { Chat } from "@/components/chat";

export const Route = createFileRoute("/_protected/chat/$sessionId")({
  component: ChatSessionPage,
});

function ChatSessionPage() {
  return (
    <Chat.Root>
      <Chat.Scroll>
        <Chat.Viewport>
          <Chat.Messages />
        </Chat.Viewport>
      </Chat.Scroll>
      <Chat.Composer />
    </Chat.Root>
  );
}
