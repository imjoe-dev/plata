import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sidebar } from "./sidebar";

const user = { name: "Jose Ariza", email: "jose@example.com", image: null };

function AccountFooter() {
  return (
    <Sidebar.Account.Root user={user} onSignOut={() => {}}>
      <Sidebar.Account.Avatar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Sidebar.Account.Name />
        <Sidebar.Account.Email />
      </div>
      <Sidebar.Account.SignOut />
    </Sidebar.Account.Root>
  );
}

const meta = {
  component: Sidebar.Root,
} satisfies Meta<typeof Sidebar.Root>;
export default meta;

// History while loading: deliberately empty — no skeleton, no layout shift.
export const Default: StoryObj<typeof Sidebar.Root> = {
  render() {
    return (
      <div className="flex h-[600px]">
        <Sidebar.Root>
          <Sidebar.Brand />
          <Sidebar.NewChat onNewChat={() => {}} />
          <Sidebar.History />
          <AccountFooter />
        </Sidebar.Root>
        <div className="bg-sunken flex-1" />
      </div>
    );
  },
};

// Populated History — the first item is the open Chat Session (active treatment). In the app,
// `_protected/route.tsx` supplies this data from the chat-sessions hook and renders each item
// as a router link.
export const WithHistory: StoryObj<typeof Sidebar.Root> = {
  render() {
    return (
      <div className="flex h-[600px]">
        <Sidebar.Root>
          <Sidebar.Brand />
          <Sidebar.NewChat onNewChat={() => {}} />
          <Sidebar.History>
            <Sidebar.HistoryItem.Root isActive render={<a href="#categorize-uber" />}>
              <Sidebar.HistoryItem.Title>Categorize my Uber rides</Sidebar.HistoryItem.Title>
            </Sidebar.HistoryItem.Root>
            <Sidebar.HistoryItem.Root isActive={false} render={<a href="#rent-reminder" />}>
              <Sidebar.HistoryItem.Title>Set up a monthly rent reminder</Sidebar.HistoryItem.Title>
            </Sidebar.HistoryItem.Root>
            <Sidebar.HistoryItem.Root isActive={false} render={<a href="#overspend-review" />}>
              <Sidebar.HistoryItem.Title>
                Review last month&apos;s spending by category and find where I overspent
              </Sidebar.HistoryItem.Title>
            </Sidebar.HistoryItem.Root>
          </Sidebar.History>
          <AccountFooter />
        </Sidebar.Root>
        <div className="bg-sunken flex-1" />
      </div>
    );
  },
};

// A fresh account: quiet "No chats yet" line instead of a blank pane.
export const EmptyHistory: StoryObj<typeof Sidebar.Root> = {
  render() {
    return (
      <div className="flex h-[600px]">
        <Sidebar.Root>
          <Sidebar.Brand />
          <Sidebar.NewChat onNewChat={() => {}} />
          <Sidebar.History>
            <Sidebar.HistoryStatus>No chats yet</Sidebar.HistoryStatus>
          </Sidebar.History>
          <AccountFooter />
        </Sidebar.Root>
        <div className="bg-sunken flex-1" />
      </div>
    );
  },
};

// History fetch failed: muted inline notice, never a toast — chatting stays unaffected.
export const HistoryError: StoryObj<typeof Sidebar.Root> = {
  render() {
    return (
      <div className="flex h-[600px]">
        <Sidebar.Root>
          <Sidebar.Brand />
          <Sidebar.NewChat onNewChat={() => {}} />
          <Sidebar.History>
            <Sidebar.HistoryStatus>{"Couldn't load history"}</Sidebar.HistoryStatus>
          </Sidebar.History>
          <AccountFooter />
        </Sidebar.Root>
        <div className="bg-sunken flex-1" />
      </div>
    );
  },
};
