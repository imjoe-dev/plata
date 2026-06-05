import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginPage } from "./login";

const mockSignInSocial = vi.fn();
const mockToastAdd = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) => mockSignInSocial(...args),
    },
  },
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ add: mockToastAdd }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signIn.social with google provider and callbackURL on button click", async () => {
    mockSignInSocial.mockResolvedValueOnce({});
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /login with google/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSignInSocial).toHaveBeenCalledTimes(1);
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/",
      });
    });
  });

  it("shows an error toast when signIn.social rejects", async () => {
    mockSignInSocial.mockRejectedValueOnce(new Error("Network error"));
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /login with google/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledTimes(1);
      expect(mockToastAdd).toHaveBeenCalledWith({
        title: "Login failed",
        data: { variant: "error" },
      });
    });
  });
});
