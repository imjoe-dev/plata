import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/protected/")({
  component: HomePage,
});

function HomePage() {
  return <div>Hello "/protected/"!</div>;
}
