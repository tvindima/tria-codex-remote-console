import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";

let db: Database | null = null;

export async function getDb() {
  if (db) {
    return db;
  }

  db = await open({
    filename: process.env.TRIA_DB_PATH ?? ".tria-codex-remote.sqlite",
    driver: sqlite3.Database,
  });

  return db;
}
