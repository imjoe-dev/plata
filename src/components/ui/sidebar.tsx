import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";
import { createContext, useContext } from "react";

import { useChatContext } from "@/contexts/chat-context";
import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function Root({ className, children, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      className={cn("bg-base border-hairline flex w-60 flex-col border-r py-3.5", className)}
      {...props}
    >
      {children}
    </aside>
  );
}

function Brand({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-baseline gap-2 px-4 pb-4", className)} {...props}>
      <span className="text-fg-strong font-serif text-[22px] leading-none tracking-tight italic">
        plata
      </span>
    </div>
  );
}

function NewChat({ className, ...props }: React.ComponentProps<"button">) {
  const { resetChat } = useChatContext();
  const navigate = useNavigate();

  function handleClick() {
    resetChat();
    void navigate({ to: "/" });
  }

  return (
    <button
      type="button"
      className={cn(
        "text-fg-muted hover:text-fg hover:bg-raised focus-visible:text-fg focus-visible:bg-raised duration-fast flex cursor-pointer items-center gap-2 px-4 py-1.5 text-sm transition-colors select-none focus-visible:outline-none",
        className,
      )}
      {...props}
      onClick={handleClick}
    >
      <Plus className="text-fg-faint size-4 shrink-0" />
      New Chat
    </button>
  );
}

function History({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex-1 overflow-y-auto", className)} {...props}>
      {children}
    </div>
  );
}

type Session = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;

interface AccountContextValue {
  user: Session["user"];
  signOut: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function useAccountContext(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("Sidebar.Account.* must be used within Sidebar.Account.Root");
  return ctx;
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

function AccountRoot({ className, children, ...props }: React.ComponentProps<"div">) {
  const { data } = authClient.useSession();
  const navigate = useNavigate();

  function signOut() {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void navigate({ to: "/login" });
        },
      },
    });
  }

  if (!data) return null;

  return (
    <AccountContext.Provider value={{ user: data.user, signOut }}>
      <div
        className={cn(
          "border-hairline mt-auto flex items-center gap-2.5 border-t px-4 py-2.5",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AccountContext.Provider>
  );
}

function AccountAvatar({ className, ...props }: React.ComponentProps<typeof Avatar>) {
  const { user } = useAccountContext();

  return (
    <Avatar size="sm" shape="round" className={className} {...props}>
      {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

function AccountName({ className, ...props }: React.ComponentProps<"span">) {
  const { user } = useAccountContext();

  return (
    <span className={cn("text-fg block truncate text-xs leading-tight", className)} {...props}>
      {user.name}
    </span>
  );
}

function AccountEmail({ className, ...props }: React.ComponentProps<"span">) {
  const { user } = useAccountContext();

  return (
    <span
      className={cn("text-fg-faint block truncate font-mono text-[10px]", className)}
      {...props}
    >
      {user.email}
    </span>
  );
}

function AccountSignOut({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { signOut } = useAccountContext();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      className={cn("ml-auto shrink-0", className)}
      {...props}
      onClick={signOut}
    >
      <LogOut className="size-4" />
    </Button>
  );
}

export const Sidebar = {
  Root,
  Brand,
  NewChat,
  History,
  Account: {
    Root: AccountRoot,
    Avatar: AccountAvatar,
    Name: AccountName,
    Email: AccountEmail,
    SignOut: AccountSignOut,
  },
};
