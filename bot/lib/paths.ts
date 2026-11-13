import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = join(here, "..", "..");
export const dataDir = join(repoRoot, "data");
export const migrationsDir = join(repoRoot, "migrations");
export const migrationPath = join(migrationsDir, "001_opportunities.sql");
