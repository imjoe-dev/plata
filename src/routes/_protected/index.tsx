import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "@tanstack/ai-react";
import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolCall } from "@/components/ui/tool-call";
import { usePlataChat } from "@/hooks/use-plata-chat";
import { getToolCallDisplayState, getToolCallStatusLabel } from "@/lib/ai/tool-call-display-state";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  const { messages, sendMessage, isLoading, error, addToolApprovalResponse } = usePlataChat();

  function handleSubmit(text: string): boolean {
    if (isLoading) return false;
    void sendMessage(text);
    return true;
  }

  const prompt = (
    <PromptInput.Root placeholder="Ask anything..." onSubmit={handleSubmit}>
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

      <ScrollArea.Root className="flex-1">
        <ScrollArea.Viewport>
          <ScrollArea.Content className="mx-auto max-w-4xl px-4 py-4">
            <ChatMessages.List className="overflow-y-visible p-0">
              {messages.map((message: UIMessage) =>
                message.role === "user" ? (
                  <ChatMessages.UserMessage key={message.id}>
                    {message.parts
                      .filter((p) => p.type === "text")
                      .map((p) => p.content)
                      .join("")}
                  </ChatMessages.UserMessage>
                ) : (
                  message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <ChatMessages.AssistantMessage key={`${message.id}-${i}`}>
                          {part.content}
                        </ChatMessages.AssistantMessage>
                      );
                    }
                    if (part.type === "tool-call") {
                      const displayState = getToolCallDisplayState(part);
                      const statusLabel = getToolCallStatusLabel(displayState);
                      return (
                        <ToolCall.Root
                          key={`${message.id}-${i}`}
                          displayState={displayState}
                          statusLabel={statusLabel}
                          onApprove={() =>
                            addToolApprovalResponse({ id: part.approval!.id, approved: true })
                          }
                          onDeny={() =>
                            addToolApprovalResponse({ id: part.approval!.id, approved: false })
                          }
                        >
                          <ToolCall.Name>{part.name}</ToolCall.Name>
                          <ToolCall.Content>
                            <ToolCall.Args>{part.arguments}</ToolCall.Args>
                            <ToolCall.ApprovalActions />
                            <ToolCall.Response>
                              {part.output !== undefined ? JSON.stringify(part.output) : undefined}
                            </ToolCall.Response>
                            <ToolCall.DeniedNotice>You declined this action.</ToolCall.DeniedNotice>
                            <ToolCall.Error>
                              {(part.output as { error?: string } | undefined)?.error ??
                                (part.output !== undefined
                                  ? JSON.stringify(part.output)
                                  : undefined)}
                            </ToolCall.Error>
                          </ToolCall.Content>
                        </ToolCall.Root>
                      );
                    }
                    return null;
                  })
                ),
              )}
            </ChatMessages.List>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-6">{prompt}</div>

      {error && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-4">
          <p className="text-fg-error text-sm">Something went wrong. Please try again.</p>
        </div>
      )}
    </div>
  );
}
