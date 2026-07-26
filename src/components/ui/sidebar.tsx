import { cn } from "@/lib/utils";
import { useRender } from "@base-ui/react/use-render";
import { LogOut, MessageSquare, Plus } from "lucide-react";
import { createContext, use } from "react";

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

type NewChatProps = React.ComponentProps<"button"> & {
  onNewChat: () => void;
};

function NewChat({ onNewChat, className, ...props }: NewChatProps) {
  return (
    <button
      type="button"
      className={cn(
        "text-fg-muted hover:text-fg hover:bg-raised focus-visible:text-fg focus-visible:bg-raised duration-fast flex cursor-pointer items-center gap-2 px-4 py-1.5 text-sm font-medium transition-colors select-none focus-visible:outline-none",
        className,
      )}
      {...props}
      onClick={onNewChat}
    >
      <Plus className="text-fg-faint size-4 shrink-0" />
      New Chat
    </button>
  );
}

function History({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("border-hairline mt-1 flex-1 overflow-y-auto border-t pt-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Quiet inline line for History's empty and error states ("No chats yet",
// "Couldn't load history") — deliberately not a toast and not a skeleton.
function HistoryStatus({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-fg-faint px-4 py-1.5 text-[13px] select-none", className)} {...props} />
  );
}

type HistoryShowMoreProps = React.ComponentProps<"button"> & {
  onShowMore: () => void;
};

// Quiet trailing row that loads the next page of History. Purely presentational:
// the layout renders it only while another page exists, so it disappears on its
// own once History is exhausted.
function HistoryShowMore({ onShowMore, className, ...props }: HistoryShowMoreProps) {
  return (
    <button
      type="button"
      className={cn(
        "text-fg-faint hover:text-fg hover:bg-raised focus-visible:text-fg focus-visible:bg-raised duration-fast flex w-full cursor-pointer items-center px-4 py-1.5 text-[13px] transition-colors ease-out select-none focus-visible:outline-none",
        className,
      )}
      {...props}
      onClick={onShowMore}
    >
      Show more
    </button>
  );
}

type HistoryItemRootProps = useRender.ComponentProps<"a"> & {
  isActive: boolean;
};

// useRender, not Button — Button forces role="button" even when rendered as a link via `render`,
// breaking the native role="link"/Enter-key semantics a real anchor should keep.
function HistoryItemRoot({
  isActive,
  className,
  children,
  render,
  ...props
}: HistoryItemRootProps) {
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      ...props,
      // A `render` element setting its own aria-current would win over this (useRender merges
      // non-className/handler props left-to-right) — not a live issue with any consumer yet.
      "aria-current": isActive ? "page" : undefined,
      className: cn(
        "text-fg-muted hover:text-fg hover:bg-raised focus-visible:text-fg focus-visible:bg-raised duration-fast flex cursor-pointer items-center gap-2 border-l-2 border-transparent py-1.5 pr-4 pl-[14px] text-[13px] transition-colors select-none focus-visible:outline-none",
        isActive && "text-fg-strong bg-raised border-accent font-medium",
        className,
      ),
      children: (
        <>
          <MessageSquare
            className={cn("size-4 shrink-0", isActive ? "text-accent" : "text-fg-faint")}
          />
          {children}
        </>
      ),
    },
  });
}

function HistoryItemTitle({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("min-w-0 flex-1 truncate", className)} {...props} />;
}

interface SidebarAccountUser {
  name: string;
  email: string;
  image?: string | null;
}

interface AccountContextValue {
  user: SidebarAccountUser;
  signOut: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function useAccountContext(): AccountContextValue {
  const ctx = use(AccountContext);
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

type AccountRootProps = React.ComponentProps<"div"> & {
  user: SidebarAccountUser;
  onSignOut: () => void;
};

function AccountRoot({ user, onSignOut, className, children, ...props }: AccountRootProps) {
  return (
    <AccountContext.Provider value={{ user, signOut: onSignOut }}>
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
  HistoryStatus,
  HistoryShowMore,
  HistoryItem: {
    Root: HistoryItemRoot,
    Title: HistoryItemTitle,
  },
  Account: {
    Root: AccountRoot,
    Avatar: AccountAvatar,
    Name: AccountName,
    Email: AccountEmail,
    SignOut: AccountSignOut,
  },
};
