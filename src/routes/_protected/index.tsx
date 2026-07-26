import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ChatConversation } from "@/components/chat-conversation";
import { PromptInput } from "@/components/ui/prompt-input";
import { useChatContext } from "@/contexts/chat-context";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  const { messages, error, submit, resetChat } = useChatContext();

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
        <div className="w-full max-w-4xl px-4">
          <PromptInput.Root placeholder="Ask anything..." onSubmit={submit}>
            <PromptInput.Editor />
          </PromptInput.Root>
        </div>
      </div>
    );
  }

  return <ChatConversation messages={messages} error={error} onSubmit={submit} />;
}
