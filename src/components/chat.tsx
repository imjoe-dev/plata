import { createContext, use } from "react";
import type { UIMessage } from "@tanstack/ai-react";

import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolCall as ToolCallPrimitive } from "@/components/ui/tool-call";
import { useChatContext } from "@/contexts/chat-context";
import { useToolApproval } from "@/contexts/tool-approval-context";
import { joinTextParts } from "@/lib/ai/message-text";
import { getToolCallDisplayState, getToolCallStatusLabel } from "@/lib/ai/tool-call-display-state";
import { cn } from "@/lib/utils";

type MessagePart = UIMessage["parts"][number];

// The Chat Message and the part currently being rendered. Passed by context rather than props so
// each part below reads exactly what it needs, and adding a part never means threading an
// argument through Messages.
const MessageContext = createContext<UIMessage | null>(null);
const PartContext = createContext<MessagePart | null>(null);

function useMessage(): UIMessage {
  const message = use(MessageContext);
  if (!message) throw new Error("This Chat part must be rendered inside Chat.Messages");
  return message;
}

function usePart(): MessagePart {
  const part = use(PartContext);
  if (!part) throw new Error("This Chat part must be rendered inside Chat.Messages");
  return part;
}

function Root({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("bg-base flex h-screen flex-col", className)} {...props} />;
}

function Scroll({ children, className, ...props }: React.ComponentProps<typeof ScrollArea.Root>) {
  return (
    <ScrollArea.Root className={cn("flex-1", className)} {...props}>
      <ScrollArea.Viewport>{children}</ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}

function Viewport({ className, ...props }: React.ComponentProps<typeof ScrollArea.Content>) {
  return <ScrollArea.Content className={cn("px-4 py-4", className)} {...props} />;
}

function Messages({ className, ...props }: React.ComponentProps<"div">) {
  const { messages } = useChatContext();

  return (
    <ChatMessages.List className={cn("overflow-y-visible p-0", className)} {...props}>
      {messages.map((message) => (
        <MessageContext.Provider key={message.id} value={message}>
          {message.role === "user" ? (
            <UserMessage />
          ) : (
            message.parts.map((part, index) => (
              <PartContext.Provider key={`${message.id}-${index}`} value={part}>
                <Part />
              </PartContext.Provider>
            ))
          )}
        </MessageContext.Provider>
      ))}
    </ChatMessages.List>
  );
}

/** Picks the part component for whatever the assistant emitted. Unknown kinds render nothing
 *  rather than failing — the stream may carry part types this UI doesn't handle yet. */
function Part() {
  const part = usePart();

  if (part.type === "text") return <AssistantMessage />;
  if (part.type === "tool-call") return <ToolCall />;
  return null;
}

function UserMessage(
  props: Omit<React.ComponentProps<typeof ChatMessages.UserMessage>, "children">,
) {
  const message = useMessage();

  return <ChatMessages.UserMessage {...props}>{joinTextParts(message)}</ChatMessages.UserMessage>;
}

function AssistantMessage(
  props: Omit<React.ComponentProps<typeof ChatMessages.AssistantMessage>, "children">,
) {
  const part = usePart();
  if (part.type !== "text") return null;

  return <ChatMessages.AssistantMessage {...props}>{part.content}</ChatMessages.AssistantMessage>;
}

function ToolCall(
  props: Omit<
    React.ComponentProps<typeof ToolCallPrimitive.Root>,
    "displayState" | "onApprove" | "onDeny" | "onApproveForSession" | "children"
  >,
) {
  const message = useMessage();
  const part = usePart();
  const { actions } = useToolApproval();

  if (part.type !== "tool-call") return null;

  const displayState = getToolCallDisplayState(part);
  const { approve, deny, approveForSession } = actions.forPart(part, message.id);
  const output = part.output !== undefined ? JSON.stringify(part.output) : undefined;

  return (
    <ToolCallPrimitive.Root
      displayState={displayState}
      statusLabel={getToolCallStatusLabel(displayState)}
      onApprove={approve}
      onDeny={deny}
      onApproveForSession={approveForSession}
      {...props}
    >
      <ToolCallPrimitive.Name>{part.name}</ToolCallPrimitive.Name>
      <ToolCallPrimitive.Content>
        <ToolCallPrimitive.Args>{part.arguments}</ToolCallPrimitive.Args>
        <ToolCallPrimitive.ApprovalActions />
        <ToolCallPrimitive.Response>{output}</ToolCallPrimitive.Response>
        <ToolCallPrimitive.DeniedNotice>You declined this action.</ToolCallPrimitive.DeniedNotice>
        <ToolCallPrimitive.Error>
          {(part.output as { error?: string } | undefined)?.error ?? output}
        </ToolCallPrimitive.Error>
      </ToolCallPrimitive.Content>
    </ToolCallPrimitive.Root>
  );
}

function Composer({ className, ...props }: React.ComponentProps<"div">) {
  const { submit } = useChatContext();

  return (
    <div className={cn("mx-auto w-full max-w-4xl shrink-0 px-4 pb-6", className)} {...props}>
      <PromptInput.Root placeholder="Ask anything..." onSubmit={submit}>
        <PromptInput.Editor />
      </PromptInput.Root>
    </div>
  );
}

export const Chat = {
  Root,
  Scroll,
  Viewport,
  Messages,
  UserMessage,
  AssistantMessage,
  ToolCall,
  Composer,
};
