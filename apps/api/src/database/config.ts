import type { PoolConfig } from 'pg';

export function databaseConfig(value: string | undefined): PoolConfig | null {
  if (value === undefined) return null;
  try {
    const url = new URL(value);
    // The locked single-VPS architecture uses a private local control-plane DB.
    // No ambient PG* defaults, URL options or insecure remote TLS downgrade.
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2 ||
      url.search ||
      url.hash
    )
      throw new Error();
    return {
      connectionString: value,
      max: 4,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
      query_timeout: 12000,
      application_name: 'cloudlane-api',
      options: '-c search_path=pg_catalog',
    };
  } catch {
    throw new Error(
      'CLOUDLANE_DATABASE_URL must identify an authenticated loopback PostgreSQL database without URL options.',
    );
  }
}
