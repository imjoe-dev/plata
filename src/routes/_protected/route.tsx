import { getSession } from "@/lib/auth/functions";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ChatProvider } from "@/contexts/chat-context";
import { Sidebar } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_protected")({
  component: ProtectedLayout,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
  },
});

function ProtectedLayout() {
  return (
    <ChatProvider>
      <div className="flex h-screen">
        <Sidebar.Root>
          <Sidebar.Brand />
          <Sidebar.NewChat />
          <Sidebar.History />
          <Sidebar.Account.Root>
            <Sidebar.Account.Avatar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Sidebar.Account.Name />
              <Sidebar.Account.Email />
            </div>
            <Sidebar.Account.SignOut />
          </Sidebar.Account.Root>
        </Sidebar.Root>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </ChatProvider>
  );
}
