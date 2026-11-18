import { createApp } from './app';

async function main() {
  const port = Number(process.env.CLOUDLANE_API_PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('CLOUDLANE_API_PORT must be a valid TCP port.');
  }
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  process.stdout.write(
    `Cloudlane API foundation listening on http://127.0.0.1:${port}/api/v1\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    error instanceof Error ? error.message + '\n' : 'Startup failed.\n',
  );
  process.exitCode = 1;
});
