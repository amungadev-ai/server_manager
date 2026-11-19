import { createServer } from 'node:http';
import { readFileSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  OverviewResponseSchema,
  SessionResponseSchema,
} from '@cloudlane/contracts/api';

const require = createRequire(import.meta.url);
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/dashboard.json', import.meta.url), 'utf8'),
);
SessionResponseSchema.parse(fixture.session);
OverviewResponseSchema.parse(fixture.overview);
const requestId = '50000000-0000-4000-8000-000000000001';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const error = (code, message) => ({ error: { code, message, requestId } });
function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Cloudlane-Test-Fixture': '1',
  });
  response.end(JSON.stringify(body));
}
async function listen(server, port) {
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', done);
  });
  return `http://127.0.0.1:${server.address().port}`;
}
export async function createHarnessServers({
  httpRoot,
  demoRoot,
  ports = { demo: 0, fixture: 0, unconfigured: 0 },
}) {
  for (const root of [httpRoot, demoRoot])
    if (!existsSync(resolve(root, 'index.html')))
      throw new Error(
        'Run npm run test:e2e:prepare before starting the fixture harness.',
      );
  const { createApp } = require('../../apps/api/dist/app.js');
  const api = await createApp({ documentation: false });
  await api.listen(0, '127.0.0.1');
  const apiOrigin = await api.getUrl();
  const servers = [];
  const urls = {};
  async function stop() {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(done);
          }),
      ),
    );
    await api.close();
  }
  try {
    for (const mode of ['demo', 'fixture', 'unconfigured']) {
      const root = resolve(mode === 'demo' ? demoRoot : httpRoot);
      const server = createServer(async (request, response) => {
        try {
          if (
            !/^(127\.0\.0\.1|localhost):\d+$/.test(request.headers.host ?? '')
          )
            return json(
              response,
              403,
              error('FORBIDDEN', 'Loopback fixture host required.'),
            );
          const url = new URL(request.url, 'http://127.0.0.1');
          if (
            mode === 'demo' &&
            url.pathname === '/__reference' &&
            request.method === 'GET'
          ) {
            const body = readFileSync(
              new URL('../../reference-cloudlane-v1.13.html', import.meta.url),
            );
            response.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
              'X-Cloudlane-Test-Fixture': '1',
            });
            return response.end(body);
          }
          if (
            request.headers.origin &&
            request.headers.origin !== `http://${request.headers.host}`
          )
            return json(
              response,
              403,
              error('FORBIDDEN', 'Cross-origin fixture access denied.'),
            );
          if (url.pathname === '/__harness/health')
            return json(response, 200, { fixtureOnly: true, mode });
          if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
            if (mode === 'unconfigured') {
              if (!['GET', 'HEAD', 'POST'].includes(request.method))
                return json(
                  response,
                  405,
                  error(
                    'METHOD_NOT_ALLOWED',
                    'Unsupported test request method.',
                  ),
                );
              const chunks = [];
              let bytes = 0;
              for await (const chunk of request) {
                bytes += chunk.length;
                if (bytes > 16384)
                  return json(
                    response,
                    413,
                    error(
                      'PAYLOAD_TOO_LARGE',
                      'Fixture proxy body limit exceeded.',
                    ),
                  );
                chunks.push(chunk);
              }
              const upstream = await fetch(
                `${apiOrigin}${url.pathname}${url.search}`,
                {
                  method: request.method,
                  headers: {
                    Accept: 'application/json',
                    ...(request.headers['content-type']
                      ? { 'Content-Type': request.headers['content-type'] }
                      : {}),
                    ...(request.headers['idempotency-key']
                      ? {
                          'Idempotency-Key': request.headers['idempotency-key'],
                        }
                      : {}),
                  },
                  ...(request.method === 'POST'
                    ? { body: Buffer.concat(chunks) }
                    : {}),
                },
              );
              response.writeHead(upstream.status, {
                'Content-Type':
                  upstream.headers.get('content-type') ?? 'application/json',
                'Cache-Control': 'no-store',
                'X-Cloudlane-Test-Fixture': '1',
                'X-Request-Id':
                  upstream.headers.get('x-request-id') ?? requestId,
              });
              return response.end(await upstream.text());
            }
            if (mode !== 'fixture')
              return json(
                response,
                404,
                error('NOT_FOUND', 'No fixture API on the demo host.'),
              );
            if (request.method !== 'GET')
              return json(
                response,
                501,
                error('NOT_IMPLEMENTED', 'Fixture mutations are unavailable.'),
              );
            const scenario =
              request.headers['x-cloudlane-test-scenario'] ?? 'valid';
            if (
              !['valid', 'unauthorized', 'invalid-overview'].includes(scenario)
            )
              return json(
                response,
                400,
                error('VALIDATION_ERROR', 'Unknown test scenario.'),
              );
            if (url.pathname === '/api/v1/auth/session')
              return scenario === 'unauthorized'
                ? json(
                    response,
                    401,
                    error('SESSION_REQUIRED', 'Test owner session required.'),
                  )
                : json(response, 200, fixture.session);
            if (url.pathname === '/api/v1/overview')
              return json(
                response,
                200,
                scenario === 'invalid-overview'
                  ? { ...fixture.overview, server: { cpuPercent: 999 } }
                  : fixture.overview,
              );
            return json(
              response,
              404,
              error('NOT_FOUND', 'Unknown test API route.'),
            );
          }
          if (!['GET', 'HEAD'].includes(request.method))
            return json(
              response,
              405,
              error(
                'METHOD_NOT_ALLOWED',
                'Static fixtures accept GET/HEAD only.',
              ),
            );
          let decoded;
          try {
            decoded = decodeURIComponent(url.pathname);
          } catch {
            return json(
              response,
              400,
              error('VALIDATION_ERROR', 'Invalid fixture path.'),
            );
          }
          if (decoded.includes('\0') || decoded.includes('\\'))
            return json(
              response,
              400,
              error('VALIDATION_ERROR', 'Invalid fixture path.'),
            );
          let path = resolve(root, `.${decoded}`);
          const inside = relative(root, path);
          if (inside.startsWith('..') || isAbsolute(inside))
            return json(
              response,
              403,
              error('FORBIDDEN', 'Fixture path is outside the static output.'),
            );
          if (!existsSync(path) || lstatSync(path).isDirectory())
            path = resolve(root, 'index.html');
          if (lstatSync(path).isSymbolicLink())
            return json(
              response,
              403,
              error('FORBIDDEN', 'Symlinks are not served.'),
            );
          const actual = relative(realpathSync(root), realpathSync(path));
          if (actual.startsWith('..') || isAbsolute(actual))
            return json(
              response,
              403,
              error('FORBIDDEN', 'Fixture path is outside the static output.'),
            );
          const body = readFileSync(path);
          response.writeHead(200, {
            'Content-Type': types[extname(path)] ?? 'application/octet-stream',
            'Content-Length': body.length,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Cloudlane-Test-Fixture': '1',
          });
          response.end(request.method === 'HEAD' ? undefined : body);
        } catch {
          if (!response.headersSent)
            json(
              response,
              500,
              error('INTERNAL_ERROR', 'Fixture server failed.'),
            );
          else response.end();
        }
      });
      servers.push(server);
      urls[mode] = await listen(server, ports[mode] ?? 0);
    }
    return { urls, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const harness = await createHarnessServers({
    httpRoot: 'test-results/e2e-site/http',
    demoRoot: 'test-results/e2e-site/demo',
    ports: { demo: 4173, fixture: 4174, unconfigured: 4175 },
  });
  console.log(
    JSON.stringify({
      fixtureOnly: true,
      loopbackOnly: true,
      urls: harness.urls,
    }),
  );
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, async () => {
      await harness.stop();
      process.exitCode = 0;
    });
}
