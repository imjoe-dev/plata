import { getDB } from "@/db";
import { InternalError } from "@/lib/errors";

export async function runBatch<T = unknown>(statements: unknown[]): Promise<T[]> {
  try {
    return (await getDB().batch(
      statements as unknown as Parameters<ReturnType<typeof getDB>["batch"]>[0],
    )) as unknown as T[];
  } catch (cause) {
    throw new InternalError("Database batch failed", cause);
  }
}
