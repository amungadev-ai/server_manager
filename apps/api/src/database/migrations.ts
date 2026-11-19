import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pool } from 'pg';

export interface Migration {
  readonly id: string;
  readonly sql: string;
}
export interface AppliedMigration {
  id: string;
  checksum: string;
}
export const migrationChecksum = (sql: string) =>
  createHash('sha256').update(sql).digest('hex');
export function loadMigrations(): readonly Migration[] {
  return ['0001_control_plane', '0002_owner_auth'].map((id) => ({
    id,
    sql: readFileSync(resolve(__dirname, `../../migrations/${id}.sql`), 'utf8'),
  }));
}
export function validateHistory(
  migrations: readonly Migration[],
  applied: readonly AppliedMigration[],
): void {
  if (
    migrations.some(
      (migration, index) =>
        !/^\d{4}_[a-z0-9_]+$/.test(migration.id) ||
        !migration.sql.trim() ||
        (index > 0 && migration.id <= (migrations[index - 1]?.id ?? '')),
    ) ||
    applied.length > migrations.length ||
    applied.some(
      (entry, index) =>
        entry.id !== migrations[index]?.id ||
        entry.checksum !== migrationChecksum(migrations[index].sql),
    )
  )
    throw new Error('Database migration history diverges from this release.');
}

export async function migrate(
  pool: Pool,
  migrations: readonly Migration[] = loadMigrations(),
): Promise<string[]> {
  validateHistory(migrations, []);
  const client = await pool.connect().catch(() => {
    throw new Error(
      'Migration database unavailable; connection details redacted.',
    );
  });
  let inTransaction = false;
  let discard = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    await client.query('SET LOCAL search_path = pg_catalog');
    // One transaction-scoped lock serializes even the first schema creation.
    await client.query('SELECT pg_advisory_xact_lock(1129074254, 1)');
    await client.query('CREATE SCHEMA IF NOT EXISTS cloudlane');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cloudlane.schema_migrations (
        id text PRIMARY KEY,
        checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
        applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
      )
    `);
    const { rows } = await client.query<AppliedMigration>(
      'SELECT id, checksum FROM cloudlane.schema_migrations ORDER BY id',
    );
    validateHistory(migrations, rows);
    const pending = migrations.slice(rows.length);
    for (const migration of pending) {
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO cloudlane.schema_migrations (id, checksum) VALUES ($1, $2)',
        [migration.id, migrationChecksum(migration.sql)],
      );
    }
    await client.query('COMMIT');
    inTransaction = false;
    return pending.map((migration) => migration.id);
  } catch {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
    }
    // A lost COMMIT acknowledgement is ambiguous. Read the ledger on retry;
    // never promise rollback when the server may already have committed.
    throw new Error(
      'Database migration failed; verify the ledger before retrying.',
    );
  } finally {
    client.release(discard);
  }
}
