import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export function openDatabase(path = process.env.AFTERGLOW_DB_PATH ?? "./data/afterglow.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export type AfterglowDb = ReturnType<typeof openDatabase>["db"];
