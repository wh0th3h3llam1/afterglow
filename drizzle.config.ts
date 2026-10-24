import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.AFTERGLOW_DB_PATH ?? "./data/afterglow.sqlite",
  },
});
