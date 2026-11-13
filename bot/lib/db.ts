import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { migrationPath } from "./paths.js";

export type SqlClient = {
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
};

const migrationSql = readFileSync(migrationPath, "utf8");

function wrapPg(pool: Pool): SqlClient {
  return {
    async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await pool.query<T>(sql, params);
      return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

function wrapPglite(db: PGlite): SqlClient {
  return {
    async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await db.query<T>(sql, params);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
    async exec(sql: string) {
      await db.exec(sql);
    },
    async close() {
      await db.close();
    },
  };
}

async function migrate(client: SqlClient): Promise<SqlClient> {
  await client.exec(migrationSql);
  return client;
}

export async function openIsolatedDb(): Promise<SqlClient> {
  return migrate(wrapPglite(new PGlite()));
}

let singleton: Promise<SqlClient> | null = null;

export function getDb(): Promise<SqlClient> {
  if (!singleton) {
    singleton = (async () => {
      const url = process.env.DATABASE_URL;
      if (url) return migrate(wrapPg(new Pool({ connectionString: url })));
      return openIsolatedDb();
    })();
  }
  return singleton;
}

export function isUniqueViolation(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "23505") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key|unique constraint/i.test(message);
}
