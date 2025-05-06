import { drizzle } from 'drizzle-orm/vercel-postgres';
import { createClient } from "@vercel/postgres";
import { env } from "~/env";

import * as schema from "./schema";

// Create a pooled connection with the DATABASE_URL
const connection = createClient({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(connection, { schema });
