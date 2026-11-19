import {
  Global,
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { DatabaseStatus } from '@cloudlane/contracts/api';
import { databaseConfig } from './config';
import {
  loadMigrations,
  validateHistory,
  type AppliedMigration,
} from './migrations';

export class PlatformDatabase implements OnApplicationShutdown {
  private readonly pool: Pool | null;
  constructor(url?: string) {
    const config = databaseConfig(url);
    this.pool = config ? new Pool(config) : null;
    // Idle client errors must not crash the process or print connection secrets.
    this.pool?.on('error', () => {});
  }
  async status(): Promise<DatabaseStatus> {
    if (!this.pool) return 'unconfigured';
    try {
      const table = await this.pool.query<{ present: boolean }>(
        "SELECT to_regclass('cloudlane.schema_migrations') IS NOT NULL AS present",
      );
      if (!table.rows[0]?.present) return 'migration_required';
      const { rows } = await this.pool.query<AppliedMigration>(
        'SELECT id, checksum FROM cloudlane.schema_migrations ORDER BY id',
      );
      const expected = loadMigrations();
      validateHistory(expected, rows);
      return rows.length === expected.length ? 'ready' : 'migration_required';
    } catch {
      return 'unavailable';
    }
  }
  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end();
  }
}

@Global()
@Module({})
export class DatabaseModule {
  static configure(database: PlatformDatabase): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [{ provide: PlatformDatabase, useValue: database }],
      exports: [PlatformDatabase],
    };
  }
}
