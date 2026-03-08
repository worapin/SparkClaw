import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = postgres(databaseUrl);

async function runMigrations() {
  // Read migration files
  const migrationsDir = join(import.meta.dir, "../../../../drizzle/migrations");
  
  // Run migration 0000
  const migration1 = readFileSync(join(migrationsDir, "0000_concerned_thanos.sql"), "utf-8");
  const statements1 = migration1
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  
  for (const stmt of statements1) {
    try {
      await sql.unsafe(stmt);
    } catch (e: any) {
      if (!e.message.includes("already exists")) {
        console.log(`Warning: ${e.message}`);
      }
    }
  }
  
  // Run migration 0001
  try {
    const migration2 = readFileSync(join(migrationsDir, "0001_minor_joystick.sql"), "utf-8");
    const statements2 = migration2
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    
    for (const stmt of statements2) {
      try {
        await sql.unsafe(stmt);
      } catch (e: any) {
        if (!e.message.includes("already exists") && !e.message.includes("does not exist")) {
          console.log(`Warning: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log("Migration 0001 not found or already applied");
  }
  
  console.log("Migrations completed!");
  await sql.end();
}

runMigrations().catch(console.error);
