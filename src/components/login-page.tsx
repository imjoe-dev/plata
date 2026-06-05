import { Button } from "@/components/ui/button";
import { Google } from "@/components/icons/google";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/ui/toast";

export function LoginPage() {
  const toast = useToast();

  const handleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error) {
      console.error(error);
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
