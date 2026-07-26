import { useEffect } from "react";
import type { UIMessage } from "@tanstack/ai-react";

import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolCall } from "@/components/ui/tool-call";
import { toastManager } from "@/components/ui/toast-manager";
import { useToolApproval } from "@/contexts/tool-approval-context";
import { getToolCallDisplayState, getToolCallStatusLabel } from "@/lib/ai/tool-call-display-state";

interface ChatConversationProps {
  messages: UIMessage[];
  error: Error | undefined;
  onSubmit: (text: string) => boolean;
  messagesClassName?: string;
}

export function ChatConversation({
  messages,
  error,
  onSubmit,
  messagesClassName = "mx-auto max-w-4xl px-4 py-4",
}: ChatConversationProps) {
  const { actions } = useToolApproval();

  useEffect(() => {
    if (!error) return;
    toastManager.add({
      title: error.message || "Something went wrong. Please try again.",
      data: { variant: "error" },
    });
  }, [error]);

  return (
    <div className="bg-base flex h-screen flex-col">
      <div className="shrink-0 px-4 py-3">
        <span className="text-fg-faint font-mono text-[10px] font-medium tracking-wider uppercase">
          plata
        </span>
      </div>

      <ScrollArea.Root className="flex-1">
        <ScrollArea.Viewport>
          <ScrollArea.Content className={messagesClassName}>
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
                      const { approve, deny, approveForSession } = actions.forPart(
                        part,
                        message.id,
                      );
                      return (
                        <ToolCall.Root
                          key={`${message.id}-${i}`}
                          displayState={displayState}
                          statusLabel={statusLabel}
                          onApprove={approve}
                          onDeny={deny}
                          onApproveForSession={approveForSession}
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

      <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-6">
        <PromptInput.Root placeholder="Ask anything..." onSubmit={onSubmit}>
          <PromptInput.Editor />
        </PromptInput.Root>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-4">
          <p className="text-fg-error text-sm">Something went wrong. Please try again.</p>
        </div>
      )}
    </div>
  );
}
