import { getDB } from "@/db";
import { InternalError } from "@/lib/errors";

export async function runBatch(statements: unknown[]): Promise<{ success: true }> {
  try {
    await getDB().batch(statements as unknown as Parameters<ReturnType<typeof getDB>["batch"]>[0]);
    return { success: true };
  } catch (cause) {
    throw new InternalError("Database batch failed", cause);
  }
}
