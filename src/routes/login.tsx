import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/components/pages/login-page";
import { getSession } from "@/lib/auth/functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: async () => {
    const session = await getSession();
    if (session) {
      throw redirect({
        to: "/",
      });
    }
  },
});
