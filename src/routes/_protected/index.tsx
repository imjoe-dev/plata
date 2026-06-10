import { createFileRoute } from "@tanstack/react-router";
import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  const hasMessages = false;

  if (!hasMessages) {
    return (
      <div className="bg-base flex h-screen flex-col items-center justify-center gap-6">
        <h1 className="text-fg-strong font-serif text-6xl leading-none tracking-tight">plata</h1>
        <p className="text-fg-muted text-sm">What would you like to know?</p>
        <div className="w-full max-w-xl px-4">
          <PromptInput.Root placeholder="Ask anything...">
            <PromptInput.Editor />
          </PromptInput.Root>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base flex h-screen flex-col">
      <div className="shrink-0 px-4 py-3">
        <span className="text-fg-faint font-mono text-[10px] font-medium tracking-wider uppercase">
          plata
        </span>
      </div>

      <ChatMessages.List className="mx-auto w-full max-w-xl flex-1">
        <ChatMessages.UserMessage>What's our Q2 revenue?</ChatMessages.UserMessage>
        <ChatMessages.AssistantMessage>
          Q2 revenue was $2.4M, up 12% from Q1.
        </ChatMessages.AssistantMessage>
      </ChatMessages.List>

      <div className="mx-auto w-full max-w-xl shrink-0 px-4 pb-6">
        <PromptInput.Root placeholder="Ask anything...">
          <PromptInput.Editor />
        </PromptInput.Root>
      </div>
    </div>
  );
}
