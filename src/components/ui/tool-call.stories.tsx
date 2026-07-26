import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolCall } from "./tool-call";

const meta = {
  component: ToolCall.Root,
} satisfies Meta<typeof ToolCall.Root>;
export default meta;

export const Collapsed: StoryObj<typeof ToolCall.Root> = {
  render() {
    return (
      <ToolCall.Root displayState="complete">
        <ToolCall.Name>fetch_transactions</ToolCall.Name>
        <ToolCall.Content>
          <ToolCall.Args>
            {JSON.stringify({ category: "housing", period: "last_month" }, null, 2)}
          </ToolCall.Args>
          <ToolCall.Response>
            {JSON.stringify({
              count: 3,
              transactions: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
            })}
          </ToolCall.Response>
        </ToolCall.Content>
      </ToolCall.Root>
    );
  },
};

export const Expanded: StoryObj<typeof ToolCall.Root> = {
  render() {
    return (
      <ToolCall.Root displayState="complete">
        <ToolCall.Name>create_recurring_transaction</ToolCall.Name>
        <ToolCall.Content>
          <ToolCall.Args>
            {JSON.stringify({ amount: 1500, category: "housing", frequency: "monthly" }, null, 2)}
          </ToolCall.Args>
          <ToolCall.Response>
            {JSON.stringify({ id: "t_abc123", status: "created" })}
          </ToolCall.Response>
        </ToolCall.Content>
      </ToolCall.Root>
    );
  },
};

export const Running: StoryObj<typeof ToolCall.Root> = {
  render() {
    return (
      <ToolCall.Root displayState="running" statusLabel="running">
        <ToolCall.Name>fetch_transactions</ToolCall.Name>
        <ToolCall.Content>
          <ToolCall.Args>
            {JSON.stringify({ category: "housing", period: "last_month" }, null, 2)}
          </ToolCall.Args>
        </ToolCall.Content>
      </ToolCall.Root>
    );
  },
};

export const PendingApproval: StoryObj<typeof ToolCall.Root> = {
  render() {
    return (
      <ToolCall.Root
        displayState="pending-approval"
        statusLabel="awaiting approval"
        onApprove={() => {}}
        onDeny={() => {}}
      >
        <ToolCall.Name>delete_transaction</ToolCall.Name>
        <ToolCall.Content>
          <ToolCall.Args>{JSON.stringify({ id: "t_abc123" }, null, 2)}</ToolCall.Args>
          <ToolCall.ApprovalActions />
        </ToolCall.Content>
      </ToolCall.Root>
    );
  },
};

/**
 * Session Approval (docs/adr/0006): a deliberate, scoped exception to this design system's
 * usual two-action-row convention — never shown on delete tools, see PendingApproval above.
 */
export const PendingApprovalWithSessionOption: StoryObj<typeof ToolCall.Root> = {
  render() {
    return (
      <ToolCall.Root
        displayState="pending-approval"
        statusLabel="awaiting approval"
        onApprove={() => {}}
        onDeny={() => {}}
        onApproveForSession={() => {}}
      >
        <ToolCall.Name>create_transaction</ToolCall.Name>
        <ToolCall.Content>
          <ToolCall.Args>
            {JSON.stringify({ amount: 12.34, description: "Coffee" }, null, 2)}
          </ToolCall.Args>
          <ToolCall.ApprovalActions />
        </ToolCall.Content>
      </ToolCall.Root>
    );
  },
};

export const Error: StoryObj<typeof ToolCall.Root> = {
  render() {
    return (
      <ToolCall.Root displayState="error" statusLabel="error">
        <ToolCall.Name>update_category</ToolCall.Name>
        <ToolCall.Content>
          <ToolCall.Args>
            {JSON.stringify({ id: "cat_missing", name: "Restaurants" }, null, 2)}
          </ToolCall.Args>
          <ToolCall.Error>Category "cat_missing" not found for this user.</ToolCall.Error>
        </ToolCall.Content>
      </ToolCall.Root>
    );
  },
};
