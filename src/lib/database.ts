import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const globalForDatabase = globalThis as typeof globalThis & {
  dashboardDatabase?: Database.Database;
};

function openDatabase() {
  const file = process.env.DATABASE_PATH ?? `${process.cwd()}/.data/dashboard.sqlite`;
  mkdirSync(dirname(file), { recursive: true });

  const database = new Database(file);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      layout_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const currentVersion = Number(database.pragma("user_version", { simple: true }));
  if (currentVersion < 1) database.pragma("user_version = 1");
  if (currentVersion < 2) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    database.pragma("user_version = 2");
  }

  return database;
}

export function getDatabase() {
  globalForDatabase.dashboardDatabase ??= openDatabase();
  return globalForDatabase.dashboardDatabase;
}
