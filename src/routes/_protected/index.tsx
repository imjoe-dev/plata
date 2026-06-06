import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-fg-strong font-serif text-6xl leading-none tracking-tight">plata</h1>
    </div>
  );
}
