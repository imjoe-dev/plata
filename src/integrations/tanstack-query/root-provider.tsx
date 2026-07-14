import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { toastManager } from "@/components/ui/toast-manager";

function onError(error: Error) {
  toastManager.add({
    title: error.message,
    data: { variant: "error" },
  });
}

export function getContext() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  });

  return {
    queryClient,
  };
}
export default function TanstackQueryProvider() {}
