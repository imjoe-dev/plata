import { createFileRoute } from "@tanstack/react-router";
import { Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="bg-base flex min-h-screen items-center justify-center">
      <Button variant="primary" size="lg">
        <Chrome className="h-4 w-4" strokeWidth={1.5} />
        Login with Google
      </Button>
    </div>
  );
}
