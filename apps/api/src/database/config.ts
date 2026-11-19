import type { PoolConfig } from 'pg';

// The driver supports the PostgreSQL startup replication parameter; its
// DefinitelyTyped PoolConfig currently omits it. Pin it to ordinary DB mode.
type LocalPoolConfig = PoolConfig & { replication: 'false' };

export function databaseConfig(
  value: string | undefined,
): LocalPoolConfig | null {
  if (value === undefined) return null;
  try {
    const url = new URL(value);
    const port = Number(url.port || '5432');
    // The locked single-VPS architecture uses a private local control-plane DB.
    // No ambient identity/port/TLS defaults or URL option overrides.
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !url.username ||
      !url.password ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      url.pathname.length < 2 ||
      url.search ||
      url.hash
    )
      throw new Error();
    return {
      host: url.hostname.replace(/^\[(.+)\]$/, '$1'),
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURI(url.pathname.slice(1)),
      ssl: false,
      sslnegotiation: 'postgres',
      replication: 'false',
      client_encoding: 'UTF8',
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
