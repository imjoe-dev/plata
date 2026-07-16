// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Sidebar } from "@/components/ui/sidebar";

afterEach(() => {
  cleanup();
});

describe("Sidebar.NewChat", () => {
  it("calls onNewChat when clicked", () => {
    const onNewChat = vi.fn();
    const { getByText } = render(<Sidebar.NewChat onNewChat={onNewChat} />);

    fireEvent.click(getByText("New Chat"));

    expect(onNewChat).toHaveBeenCalledTimes(1);
  });
});

describe("Sidebar.Account", () => {
  const user = { name: "Jose Ariza", email: "jose@example.com", image: null };

  it("renders the given user's name and email", () => {
    const { getByText } = render(
      <Sidebar.Account.Root user={user} onSignOut={vi.fn()}>
        <Sidebar.Account.Avatar />
        <Sidebar.Account.Name />
        <Sidebar.Account.Email />
        <Sidebar.Account.SignOut />
      </Sidebar.Account.Root>,
    );

    expect(getByText("Jose Ariza")).toBeDefined();
    expect(getByText("jose@example.com")).toBeDefined();
  });

  it("calls onSignOut when the sign-out control is clicked", () => {
    const onSignOut = vi.fn();
    const { getByRole } = render(
      <Sidebar.Account.Root user={user} onSignOut={onSignOut}>
        <Sidebar.Account.SignOut />
      </Sidebar.Account.Root>,
    );

    fireEvent.click(getByRole("button", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
