import { getSession } from "@/lib/auth/functions";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { ChatProvider, useChatContext } from "@/contexts/chat-context";
import { authClient } from "@/lib/auth/client";
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

    return { session };
  },
});

function ProtectedLayout() {
  return (
    <ChatProvider>
      <ProtectedLayoutContent />
    </ChatProvider>
  );
}

// The one place that knows where the sidebar's data/actions actually come from
// (ChatContext, Better Auth) — Sidebar itself stays pure and only consumes props.
function useProtectedLayoutActions() {
  const { resetChat } = useChatContext();
  const navigate = useNavigate();
  const { session } = Route.useRouteContext();

  function handleNewChat() {
    resetChat();
    void navigate({ to: "/" });
  }

  function handleSignOut() {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void navigate({ to: "/login" });
        },
      },
    });
  }

  return { session, handleNewChat, handleSignOut };
}

function ProtectedLayoutContent() {
  const { session, handleNewChat, handleSignOut } = useProtectedLayoutActions();

  return (
    <div className="flex h-screen">
      <Sidebar.Root>
        <Sidebar.Brand />
        <Sidebar.NewChat onNewChat={handleNewChat} />
        <Sidebar.History />
        <Sidebar.Account.Root user={session.user} onSignOut={handleSignOut}>
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
  );
}
