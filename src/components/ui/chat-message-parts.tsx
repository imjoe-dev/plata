import type { ReactNode } from "react";
import type { MessagePart, ToolCallPart, ToolResultPart } from "@tanstack/ai";
import { ChatMessages } from "@/components/ui/chat-messages";

export type ToolCallStatus = "pending" | "complete" | "error";

/**
 * Derives the display status of a tool call from the call part and its
 * (optional) paired result part. A paired result is authoritative; without
 * one, the call's own state decides (client-executed tools never get a
 * separate tool-result part).
 */
export function getToolCallStatus(part: ToolCallPart, result?: ToolResultPart): ToolCallStatus {
  if (result?.state === "error") return "error";
  if (result?.state === "streaming") return "pending";
  if (result?.state === "complete") return "complete";
  return part.state === "complete" ? "complete" : "pending";
}

/** Finds the tool-result part paired with a tool call by `toolCallId`. */
export function findToolResult(
  parts: ReadonlyArray<MessagePart>,
  toolCallId: string,
): ToolResultPart | undefined {
  return parts.find(
    (p): p is ToolResultPart => p.type === "tool-result" && p.toolCallId === toolCallId,
  );
}

/** Pretty-prints a JSON string; returns it untouched when it isn't valid JSON
 * (e.g. arguments still streaming in). */
function prettyJsonString(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function prettyJsonValue(value: unknown): string {
  if (typeof value === "string") return prettyJsonString(value);
  return JSON.stringify(value, null, 2) ?? String(value);
}

function responseText(part: ToolCallPart, result?: ToolResultPart): string | undefined {
  if (result) return prettyJsonValue(result.content);
  if (part.output !== undefined) return prettyJsonValue(part.output);
  return undefined;
}

/**
 * A single tool call in the transcript: collapsible row with the raw tool
 * name, a pending indicator while in flight, an error variant on failure, and
 * Arguments/Response (or Error) detail on expand.
 */
export function ToolCallView({
  part,
  result,
  defaultOpen,
}: {
  part: ToolCallPart;
  result?: ToolResultPart;
  defaultOpen?: boolean;
}) {
  const status = getToolCallStatus(part, result);
  const variant = status === "error" ? "error" : "default";
  const response = responseText(part, result);

  return (
    <ChatMessages.ToolCall variant={variant} defaultOpen={defaultOpen} data-status={status}>
      <ChatMessages.ToolCallName variant={variant} pending={status === "pending"}>
        {part.name}
      </ChatMessages.ToolCallName>
      <ChatMessages.ToolCallContent>
        <ChatMessages.ToolCallArgs>{prettyJsonString(part.arguments)}</ChatMessages.ToolCallArgs>
        {status === "error" ? (
          <ChatMessages.ToolCallError>
            {result?.error ?? "Tool call failed."}
          </ChatMessages.ToolCallError>
        ) : (
          response !== undefined && (
            <ChatMessages.ToolCallResponse>{response}</ChatMessages.ToolCallResponse>
          )
        )}
      </ChatMessages.ToolCallContent>
    </ChatMessages.ToolCall>
  );
}

/**
 * Renders an assistant message's parts in part order, interleaving text
 * bubbles with tool-call rows. Consecutive text parts merge into a single
 * bubble; tool-result parts render inside their paired tool-call row.
 */
export function AssistantMessageParts({ parts }: { parts: ReadonlyArray<MessagePart> }) {
  const blocks: ReactNode[] = [];
  let textBuffer = "";

  const flushText = () => {
    if (!textBuffer) return;
    blocks.push(
      <ChatMessages.AssistantMessage key={`text-${blocks.length}`}>
        {textBuffer}
      </ChatMessages.AssistantMessage>,
    );
    textBuffer = "";
  };

  for (const part of parts) {
    if (part.type === "text") {
      textBuffer += part.content;
    } else if (part.type === "tool-call") {
      flushText();
      blocks.push(
        <ToolCallView key={part.id} part={part} result={findToolResult(parts, part.id)} />,
      );
    }
  }
  flushText();

  return <>{blocks}</>;
}
