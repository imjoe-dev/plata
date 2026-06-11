import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "@tanstack/ai-react";
import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";
import { usePlataChat } from "@/hooks/use-plata-chat";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  const { messages, sendMessage, isLoading, error } = usePlataChat();

  function handleSubmit(text: string) {
    void sendMessage(text);
  }

  const prompt = (
    <PromptInput.Root placeholder="Ask anything..." disabled={isLoading} onSubmit={handleSubmit}>
      <PromptInput.Editor />
    </PromptInput.Root>
  );

  if (!messages.length) {
    return (
      <div className="bg-base flex h-screen flex-col items-center justify-center gap-6">
        <h1 className="text-fg-strong font-serif text-6xl leading-none tracking-tight">plata</h1>
        <p className="text-fg-muted text-sm">What would you like to know?</p>
        <div className="w-full max-w-4xl px-4">{prompt}</div>
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

      <ChatMessages.List className="mx-auto w-full max-w-4xl flex-1">
        {messages.map((message: UIMessage) =>
          message.role === "user" ? (
            <ChatMessages.UserMessage key={message.id}>
              {message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.content)
                .join("")}
            </ChatMessages.UserMessage>
          ) : (
            <ChatMessages.AssistantMessage key={message.id}>
              {message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.content)
                .join("")}
            </ChatMessages.AssistantMessage>
          ),
        )}
      </ChatMessages.List>

      <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-6">{prompt}</div>

      {error && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-4">
          <p className="text-fg-error text-sm">Something went wrong. Please try again.</p>
        </div>
      )}
    </div>
  );
}
