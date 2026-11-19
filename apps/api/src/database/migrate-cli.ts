import { Pool } from 'pg';
import { databaseConfig } from './config';
import { migrate } from './migrations';

async function main() {
  if (process.argv.length !== 2)
    throw new Error('Migration arguments are not supported.');
  const config = databaseConfig(process.env.CLOUDLANE_DATABASE_URL);
  if (!config) throw new Error('CLOUDLANE_DATABASE_URL is required.');
  const pool = new Pool(config);
  pool.on('error', () => {});
  try {
    const applied = await migrate(pool);
    process.stdout.write(
      `Cloudlane schema current; ${applied.length} migration(s) applied.\n`,
    );
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  process.stderr.write(
    'Cloudlane migration failed. Check configuration and migration history; database details are redacted.\n',
  );
  process.exitCode = 1;
});
