import { runScheduledMaterialization } from "@/lib/services/recurring-templates";

export async function materializeRecurring(
  controller: ScheduledController,
  _env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const now = new Date(controller.scheduledTime);

  const promise = runScheduledMaterialization(now).then((result) => {
    console.log("Materialization sweep completed", {
      processedTemplates: result.processedTemplates,
      occurrencesCreated: result.occurrencesCreated,
      failedTemplates: result.failedTemplates,
      timestamp: now.toISOString(),
    });
  });

  ctx.waitUntil(promise);
}
