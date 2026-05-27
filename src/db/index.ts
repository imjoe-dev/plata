import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema.ts";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
