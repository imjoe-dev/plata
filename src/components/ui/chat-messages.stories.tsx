import type { Meta, StoryObj } from "@storybook/react-vite";
import { Paperclip } from "lucide-react";
import { ChatMessages } from "./chat-messages";
import type { ToolCallPart } from "@tanstack/ai-client";

const meta = {
  component: ChatMessages.List,
} satisfies Meta<typeof ChatMessages.List>;
export default meta;

const markdownExample = `Got it! Here's the breakdown of **your rent payment**:

### Summary

- **Amount:** $1,500
- **Category:** Housing
- **Frequency:** Monthly

> Rent is due on the 1st of every month. Late fees apply after the 5th.

| Month | Amount | Status |
|-------|--------|--------|
| Jan   | $1,500 | Paid   |
| Feb   | $1,500 | Paid   |
| Mar   | $1,500 | Pending |

Here's the SQL query I ran to fetch this:

\`\`\`sql
SELECT month, amount, status
FROM rent_payments
WHERE user_id = ?
ORDER BY month DESC;
\`\`\`

And the inline command: run \`plata export --month=jan\` to download.

[View details](https://example.com) for more information.`;

const conversationToolCallPart: ToolCallPart = {
  type: "tool-call",
  id: "1",
  name: "create_recurring_transaction",
  arguments: JSON.stringify({ amount: 1500, category: "housing", frequency: "monthly" }, null, 2),
  state: "complete",
  output: { id: "t_abc123", status: "created", nextDate: "2026-07-01" },
};

const collapsedToolCallPart: ToolCallPart = {
  type: "tool-call",
  id: "2",
  name: "fetch_transactions",
  arguments: JSON.stringify({ category: "housing", period: "last_month" }, null, 2),
  state: "complete",
  output: { count: 3, transactions: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] },
};

const expandedToolCallPart: ToolCallPart = {
  type: "tool-call",
  id: "3",
  name: "create_recurring_transaction",
  arguments: JSON.stringify({ amount: 1500, category: "housing", frequency: "monthly" }, null, 2),
  state: "complete",
  output: { id: "t_abc123", status: "created" },
};

const pendingToolCallPart: ToolCallPart = {
  type: "tool-call",
  id: "4",
  name: "fetch_transactions",
  arguments: JSON.stringify({ category: "housing", period: "last_month" }, null, 2),
  state: "input-complete",
};

const errorToolCallPart = {
  type: "tool-call",
  id: "5",
  name: "update_category",
  arguments: JSON.stringify({ id: "cat_missing", name: "Restaurants" }, null, 2),
  state: "error" as const,
  output: { error: 'Category "cat_missing" not found for this user.' },
} as unknown as ToolCallPart;

export const Conversation: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.UserMessage>
          Create a recurring transaction for my rent
        </ChatMessages.UserMessage>
        <ChatMessages.AssistantMessage>{markdownExample}</ChatMessages.AssistantMessage>
        <ChatMessages.ToolCall part={conversationToolCallPart}>
          <ChatMessages.ToolCallName part={conversationToolCallPart} />
          <ChatMessages.ToolCallContent>
            <ChatMessages.ToolCallArgs part={conversationToolCallPart} />
            <ChatMessages.ToolCallResponse part={conversationToolCallPart} />
          </ChatMessages.ToolCallContent>
        </ChatMessages.ToolCall>
        <ChatMessages.Attachment name="receipt.pdf">
          <Paperclip className="text-fg-muted size-3" />
        </ChatMessages.Attachment>
      </ChatMessages.List>
    );
  },
};

export const UserMessageOnly: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.UserMessage>
          {`Show me all **housing expenses** from last month

\`\`\`json
{"category": "housing", "period": "2026-06"}
\`\`\`

Run the query with \`plata query --housing\`.`}
        </ChatMessages.UserMessage>
      </ChatMessages.List>
    );
  },
};

export const AssistantMessageMarkdown: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.AssistantMessage>{markdownExample}</ChatMessages.AssistantMessage>
      </ChatMessages.List>
    );
  },
};

export const ToolCallCollapsed: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.ToolCall part={collapsedToolCallPart}>
          <ChatMessages.ToolCallName part={collapsedToolCallPart} />
          <ChatMessages.ToolCallContent>
            <ChatMessages.ToolCallArgs part={collapsedToolCallPart} />
            <ChatMessages.ToolCallResponse part={collapsedToolCallPart} />
          </ChatMessages.ToolCallContent>
        </ChatMessages.ToolCall>
      </ChatMessages.List>
    );
  },
};

export const ToolCallExpanded: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.ToolCall part={expandedToolCallPart}>
          <ChatMessages.ToolCallName part={expandedToolCallPart} />
          <ChatMessages.ToolCallContent>
            <ChatMessages.ToolCallArgs part={expandedToolCallPart} />
            <ChatMessages.ToolCallResponse part={expandedToolCallPart} />
          </ChatMessages.ToolCallContent>
        </ChatMessages.ToolCall>
      </ChatMessages.List>
    );
  },
};

export const ToolCallPending: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.ToolCall part={pendingToolCallPart}>
          <ChatMessages.ToolCallName part={pendingToolCallPart} />
          <ChatMessages.ToolCallContent>
            <ChatMessages.ToolCallArgs part={pendingToolCallPart} />
          </ChatMessages.ToolCallContent>
        </ChatMessages.ToolCall>
      </ChatMessages.List>
    );
  },
};

export const ToolCallError: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.ToolCall part={errorToolCallPart}>
          <ChatMessages.ToolCallName part={errorToolCallPart} />
          <ChatMessages.ToolCallContent>
            <ChatMessages.ToolCallArgs part={errorToolCallPart} />
            <ChatMessages.ToolCallError part={errorToolCallPart} />
          </ChatMessages.ToolCallContent>
        </ChatMessages.ToolCall>
      </ChatMessages.List>
    );
  },
};

export const AttachmentChip: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <div className="flex flex-wrap gap-2 p-4">
        <ChatMessages.Attachment name="receipt.pdf">
          <Paperclip className="text-fg-muted size-3" />
        </ChatMessages.Attachment>
        <ChatMessages.Attachment name="statement_march.csv" />
        <ChatMessages.Attachment name="screenshot.png">
          <Paperclip className="text-fg-muted size-3" />
        </ChatMessages.Attachment>
      </div>
    );
  },
};
