import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "@tanstack/ai-react";
import type { ToolCallPart } from "@tanstack/ai-client";

import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolCall } from "@/components/ui/tool-call";
import { toastManager } from "@/components/ui/toast-manager";
import { apiPost } from "@/lib/ai/fetch";
import {
  getToolCallDisplayState,
  getToolCallStatusLabel,
  isDeleteTool,
} from "@/lib/ai/tool-call-display-state";

interface ChatConversationProps {
  messages: UIMessage[];
  error: Error | undefined;
  onSubmit: (text: string) => boolean;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
  /** Chat Session id — needed to grant Session Approval (docs/adr/0006) from an approval prompt. */
  sessionId: string;
  messagesClassName?: string;
}

export function ChatConversation({
  messages,
  error,
  onSubmit,
  addToolApprovalResponse,
  sessionId,
  messagesClassName = "mx-auto max-w-4xl px-4 py-4",
}: ChatConversationProps) {
  // Session Approval (docs/adr/0006) same-turn bridge: message ids where "Approve for this
  // session" was clicked, so any further non-delete approval-requested parts arriving later in
  // that same assistant reply are auto-resolved instead of prompting again. The persisted flag
  // (granted via the approve-mutations request below) is the real authority for future turns —
  // this only papers over the current in-flight one, per ADR-0006.
  const [approvedSessionMessageIds, setApprovedSessionMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const autoRespondedApprovalIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!error) return;
    toastManager.add({
      title: error.message || "Something went wrong. Please try again.",
      data: { variant: "error" },
    });
  }, [error]);

  useEffect(() => {
    if (approvedSessionMessageIds.size === 0) return;
    for (const message of messages) {
      if (!approvedSessionMessageIds.has(message.id)) continue;
      for (const part of message.parts) {
        if (part.type !== "tool-call" || part.state !== "approval-requested" || !part.approval) {
          continue;
        }
        if (isDeleteTool(part.name) || autoRespondedApprovalIdsRef.current.has(part.approval.id)) {
          continue;
        }
        autoRespondedApprovalIdsRef.current.add(part.approval.id);
        addToolApprovalResponse({ id: part.approval.id, approved: true });
      }
    }
  }, [messages, approvedSessionMessageIds, addToolApprovalResponse]);

  function handleApproveForSession(part: ToolCallPart, messageId: string) {
    autoRespondedApprovalIdsRef.current.add(part.approval!.id);
    addToolApprovalResponse({ id: part.approval!.id, approved: true });
    setApprovedSessionMessageIds((prev) => new Set(prev).add(messageId));
    apiPost(`/api/chat/sessions/${sessionId}/approve-mutations`).catch(() => {
      toastManager.add({
        title: "Couldn't save your approval for this session — you may be asked again.",
        data: { variant: "error" },
      });
    });
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
                          onApproveForSession={
                            isDeleteTool(part.name)
                              ? undefined
                              : () => handleApproveForSession(part, message.id)
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
