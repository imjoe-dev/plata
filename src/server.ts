import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { materializeRecurring } from "@/lib/jobs/materialize-recurring";

const serverEntry = createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});

export default {
  ...serverEntry,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return materializeRecurring(controller, env, ctx);
  },
};
