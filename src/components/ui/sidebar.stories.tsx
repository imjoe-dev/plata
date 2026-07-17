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

// Matches what `_protected/route.tsx` renders today — History has no real Chat Session list yet.
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

// Preview of HistoryItem composed into History, ahead of the list-sessions backend that will
// eventually supply this data — see issue #26.
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
