import { Button } from "@/components/ui/button";
import { Google } from "@/components/icons/google";
import { authClient } from "@/lib/auth-client";
import { toastManager } from "./ui/toast-manager";

export function LoginPage() {
  async function handleSignIn() {
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });

    if (!error) {
      return;
    }

    toastManager.add({
      title: `Login failed with error: ${error.message ?? "unknown error"}`,
      data: { variant: "error" },
    });
  }

  return (
    <div className="bg-base flex min-h-screen items-center justify-center">
      <Button className="min-w-md" variant="primary" size="lg" onClick={handleSignIn}>
        <Google className="h-4 w-4" strokeWidth={1.5} />
        Login with Google
      </Button>
    </div>
  );
}
