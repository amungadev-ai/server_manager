import { test, expect, noHorizontalOverflow, navigate } from './fixtures';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
const origin = 'https://projects-ui.example.test',
  csrf = 'A'.repeat(43);
type Record = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};
type Write = {
  key: string | undefined;
  csrf: string | undefined;
  body: { name: string };
};
// Rendered Svelte contract fixture: not a substitute for the real PostgreSQL/HTTPS suite.
async function fixture(
  page: Page,
  options: {
    count?: number;
    dropFirst?: boolean;
    failList?: boolean;
    holdCreate?: Promise<void>;
  } = {},
) {
  const workspace = randomUUID(),
    user = randomUUID(),
    rows: Record[] = Array.from({ length: options.count ?? 0 }, (_, i) => ({
      id: randomUUID(),
      workspaceId: workspace,
      name: 'Saved project ' + String(i + 1).padStart(2, '0'),
      slug: 'saved-' + i,
      description: 'Saved metadata',
      createdAt: '2025-06-20T10:00:00.000Z',
      updatedAt: '2025-06-20T10:00:00.000Z',
    }));
  const writes: Write[] = [],
    cache = new Map<string, unknown>();
  let drop = !!options.dropFirst;
  await page.route(origin + '/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.replace('/api/v1', '');
      let body: unknown,
        status = 200;
      if (path === '/auth/session')
        body = {
          authenticated: true,
          mfaVerified: true,
          authenticationMethod: 'totp',
          csrfToken: csrf,
          user: {
            id: user,
            email: 'owner@example.test',
            displayName: 'Owner',
            role: 'owner',
          },
          workspace: { id: workspace, name: 'Workspace' },
        };
      else if (path === '/overview')
        body = {
          scope: 'project_metadata',
          projects: rows.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            createdAt: p.createdAt,
            updatedLabel: '20 Jun 2025',
          })),
          services: [],
          domains: [],
          activity: [],
          server: null,
        };
      else if (path === '/projects' && request.method() === 'GET') {
        if (options.failList) {
          status = 503;
          body = {
            error: {
              code: 'API_UNAVAILABLE',
              message: 'private-untrusted-query',
              requestId: randomUUID(),
            },
          };
        } else {
          const offset = url.searchParams.has('cursor') ? 20 : 0;
          body = {
            items: rows.slice(offset, offset + 20),
            nextCursor: rows.length > offset + 20 ? 'nextpage' : null,
          };
        }
      } else if (path === '/projects' && request.method() === 'POST') {
        const input = request.postDataJSON() as { name: string },
          key = request.headers()['idempotency-key'];
        writes.push({
          key,
          csrf: request.headers()['x-csrf-token'],
          body: input,
        });
        if (options.holdCreate) await options.holdCreate;
        if (key && cache.has(key)) body = cache.get(key);
        else {
          const p = {
            id: randomUUID(),
            workspaceId: workspace,
            name: input.name,
            slug: 'saved-project-' + rows.length,
            description: '',
            createdAt: '2025-06-20T10:00:00.000Z',
            updatedAt: '2025-06-20T10:00:00.000Z',
          };
          rows.push(p);
          body = {
            project: p,
            environment: {
              id: randomUUID(),
              projectId: p.id,
              name: 'production',
            },
          };
          if (key) cache.set(key, body);
        }
        if (drop) {
          drop = false;
          await route.abort('failed');
          return;
        }
        status = 201;
      } else if (path.startsWith('/projects/')) {
        const p = rows.find((p) => p.id === path.split('/').at(-1));
        if (p) body = p;
        else {
          status = 404;
          body = {
            error: {
              code: 'NOT_FOUND',
              message: 'Not found.',
              requestId: randomUUID(),
            },
          };
        }
      } else {
        status = 501;
        body = {
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Unavailable.',
            requestId: randomUUID(),
          },
        };
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
        headers: {
          'cache-control': 'no-store',
          'x-cloudlane-test-fixture': 'project-ui-contract',
        },
      });
      return;
    }
    const relative = url.pathname.startsWith('/_app/')
      ? url.pathname.slice(1)
      : 'index.html';
    if (relative.includes('..')) throw new Error('Invalid fixture path');
    await route.fulfill({
      contentType: relative.endsWith('.js')
        ? 'application/javascript'
        : relative.endsWith('.css')
          ? 'text/css'
          : relative.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html',
      body: await readFile(resolve('test-results/e2e-site/http', relative)),
    });
  });
  return { rows, writes };
}
async function openForm(page: Page) {
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Create project' }),
  ).toBeVisible();
}
async function noStorage(page: Page, name: string) {
  const state = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(state).not.toContain(name);
  expect(state).not.toContain(csrf);
}

test('HTTPS project UI lists paginated metadata and searches loaded projects without demo data', async ({
  page,
}, info) => {
  info.annotations.push({
    type: 'transport',
    description:
      'synthetic UI route fixture; real SQL/TLS evidence is separate',
  });
  await fixture(page, { count: 21 });
  await page.goto(origin + '/projects');
  await expect(page.locator('.project-card')).toHaveCount(20);
  await expect(
    page.getByText('Projects are connected.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Load more projects' }).click();
  await expect(page.locator('.project-card')).toHaveCount(21);
  await page.getByRole('textbox', { name: 'Search projects' }).fill('21');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Maid Finder/ })).toHaveCount(0);
  await expect(page.getByText('SIMULATION', { exact: true })).toHaveCount(0);
  await noHorizontalOverflow(page);
});
test('HTTPS project form saves only after API confirmation, reloads durable metadata and keeps service mutations unavailable', async ({
  page,
  isMobile,
}) => {
  const { rows, writes } = await fixture(page);
  await page.goto(origin + '/projects');
  await expect(page.getByText('No projects found')).toBeVisible();
  await openForm(page);
  const name = '<b>Literal project</b>';
  await page.getByLabel('Project name', { exact: true }).fill(name);
  const appearance = await page.evaluate(() => ({
    classes: document.documentElement.className,
    palette: document.documentElement.dataset.palette ?? 'original',
  }));
  for (const palette of ['original', 'slate', 'sand', 'sage', 'mauve'])
    for (const dark of [false, true]) {
      await page.evaluate(
        ({ palette, dark }) => {
          document.documentElement.dataset.palette = palette;
          document.documentElement.classList.toggle('dark', dark);
        },
        { palette, dark },
      );
      const a11y = await new AxeBuilder({ page })
        .include('dialog[open]')
        .analyze();
      expect(
        a11y.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        ),
        palette + (dark ? ' dark' : ' light'),
      ).toEqual([]);
    }
  await page.evaluate((appearance) => {
    document.documentElement.className = appearance.classes;
    document.documentElement.dataset.palette = appearance.palette;
  }, appearance);
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(
    page.getByText(/Created Jun 20, 2025|Created 20 Jun 2025/),
  ).toBeVisible();
  expect(rows).toHaveLength(1);
  expect(writes).toHaveLength(1);
  expect(writes[0]?.csrf).toBe(csrf);
  expect(writes[0]?.body).toEqual({ name });
  expect(writes[0]?.key).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.locator('h1 b')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add service', exact: true }).click();
  await page.getByRole('button', { name: /^Application/ }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Deploy application', exact: true })
      .getByRole('button', { name: 'Start deployment', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await navigate(page, 'Projects', isMobile);
  await expect(
    page.getByRole('link', { name: 'Open ' + name + ' project', exact: true }),
  ).toBeVisible();
  await noStorage(page, name);
  await noHorizontalOverflow(page);
});
test('HTTPS project retry reuses the original key and body after a lost acknowledgement', async ({
  page,
}) => {
  const { rows, writes } = await fixture(page, { dropFirst: true });
  await page.goto(origin + '/projects');
  await openForm(page);
  const name = 'Recoverable project';
  await page.getByLabel('Project name', { exact: true }).fill(name);
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('may have been created');
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByLabel('Project name', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry creation' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(rows).toHaveLength(1);
  expect(writes[0]?.key).toBe(writes[1]?.key);
  expect(writes[0]?.body).toEqual(writes[1]?.body);
  await noStorage(page, name);
  await noHorizontalOverflow(page);
});
test('HTTPS project list errors stay explicit without a fake empty state or untrusted server text', async ({
  page,
}) => {
  await fixture(page, { failList: true });
  await page.goto(origin + '/projects');
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  await expect(
    page.getByText('No projects found', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('private-untrusted-query', { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.project-card')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Retry loading projects' }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});
test('HTTPS project form prevents duplicate submissions and dismissal while a create is pending', async ({
  page,
}) => {
  let release!: () => void;
  const wait = new Promise<void>((done) => {
    release = done;
  });
  const { writes } = await fixture(page, { holdCreate: wait });
  await page.goto(origin + '/projects');
  await openForm(page);
  await page
    .getByLabel('Project name', { exact: true })
    .fill('Pending project');
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Creating…', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Close dialog', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Create project' }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('heading', { name: 'Pending project', exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
});
