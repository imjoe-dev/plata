import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Chat } from "@/components/chat";
import { useChatContext } from "@/contexts/chat-context";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  const { messages, resetChat } = useChatContext();

  // Landing on `/` always means a fresh chat — including via browser Back from an existing
  // conversation, since only the layout (not this route) persists across navigation.
  useEffect(() => {
    resetChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!messages.length) {
    return (
      <div className="bg-base flex h-screen flex-col items-center justify-center gap-6">
        <h1 className="text-fg-strong font-serif text-6xl leading-none tracking-tight">plata</h1>
        <p className="text-fg-muted text-sm">What would you like to know?</p>
        {/* pb-0 drops the bottom-anchored spacing the composer carries in a conversation — here
            the surrounding column centres it and supplies its own gap. */}
        <Chat.Composer className="pb-0" />
      </div>
    );
  }

  // Kept rendering after the first message so the conversation is on screen without a blank
  // frame while navigation to the new Chat Session lands.
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
