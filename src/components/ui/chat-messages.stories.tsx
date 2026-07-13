import type { Meta, StoryObj } from "@storybook/react-vite";
import { Paperclip } from "lucide-react";
import { ChatMessages } from "./chat-messages";

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

export const Conversation: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.UserMessage>
          Create a recurring transaction for my rent
        </ChatMessages.UserMessage>
        <ChatMessages.AssistantMessage>{markdownExample}</ChatMessages.AssistantMessage>
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
