import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Google } from "@/components/icons/google";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="bg-base flex min-h-screen items-center justify-center">
      <Button className="min-w-md" variant="primary" size="lg">
        <Google className="h-4 w-4" strokeWidth={1.5} />
        Login with Google
      </Button>
    </div>
  );
}
