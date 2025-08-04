import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env";

import * as schema from "./schema";

// Create a pooled connection with the DATABASE_URL for local development
const connection = postgres(env.DATABASE_URL, {
  max: 10, // maximum number of connections
  idle_timeout: 20, // close connections after 20 seconds of inactivity
  connect_timeout: 10, // timeout for initial connection in seconds
});

export const db = drizzle(connection, { schema });
