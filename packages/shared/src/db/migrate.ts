import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const client = postgres(databaseUrl);
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle/migrations" });

console.log("Migration completed successfully");
await client.end();
process.exit(0);
