import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Google } from "@/components/icons/google";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/ui/toast";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

export function LoginPage() {
  const toast = useToast();

  const handleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error) {
      console.error("Google sign-in failed:", error);
      toast.add({
        title: "Login failed",
        data: { variant: "error" },
      });
    }
  };

  return (
    <div className="bg-base flex min-h-screen items-center justify-center">
      <Button className="min-w-md" variant="primary" size="lg" onClick={handleSignIn}>
        <Google className="h-4 w-4" strokeWidth={1.5} />
        Login with Google
      </Button>
    </div>
  );
}
