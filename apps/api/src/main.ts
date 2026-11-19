import { createApp } from './app';
import { PlatformDatabase } from './database/database';

async function main() {
  const port = Number(process.env.CLOUDLANE_API_PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('CLOUDLANE_API_PORT must be a valid TCP port.');
  }
  const app = await createApp({
    documentation: process.env.CLOUDLANE_API_DOCUMENTATION === '1',
    database: new PlatformDatabase(process.env.CLOUDLANE_DATABASE_URL),
  });
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  process.stdout.write(
    `Cloudlane API foundation listening on http://127.0.0.1:${port}/api/v1\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    'Cloudlane API startup failed. Check local configuration; error details are redacted.\n',
  );
  process.exitCode = 1;
});
