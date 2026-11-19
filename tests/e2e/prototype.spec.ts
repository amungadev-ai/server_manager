import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, noHorizontalOverflow } from './fixtures';

const referenceHash =
  'f94204ed5e52ae58a80deea46d4fe6edba6626d8b0e36005f6fb9d9765a68f6d';
const fixedTime = new Date('2026-11-19T06:00:00Z');
type Scene = {
  name: string;
  path: string;
  state: Record<string, unknown>;
  tab?: string;
  modal?: string;
  assistant?: boolean;
};
const scenes: Scene[] = [
  { name: 'overview', path: '/', state: { page: 'overview' } },
  { name: 'projects', path: '/projects', state: { page: 'projects' } },
  {
    name: 'project-services',
    path: '/projects/proj_maid',
    state: { page: 'project', projectId: 'proj_maid', projectTab: 'services' },
  },
  {
    name: 'project-architecture',
    path: '/projects/proj_maid',
    tab: 'Architecture',
    state: {
      page: 'project',
      projectId: 'proj_maid',
      projectTab: 'architecture',
    },
  },
  {
    name: 'project-storage',
    path: '/projects/proj_maid',
    tab: 'Storage',
    state: { page: 'project', projectId: 'proj_maid', projectTab: 'storage' },
  },
  { name: 'domains', path: '/domains', state: { page: 'domains' } },
  {
    name: 'domain-overview',
    path: '/domains/zone_example',
    state: { page: 'domainDetail', domainZoneId: 'zone_example' },
  },
  {
    name: 'domain-records',
    path: '/domains/zone_example',
    tab: 'DNS Records',
    state: {
      page: 'domainDetail',
      domainZoneId: 'zone_example',
      tab: 'dns-records',
    },
  },
  {
    name: 'domain-settings',
    path: '/domains/zone_example',
    tab: 'Settings',
    state: {
      page: 'domainDetail',
      domainZoneId: 'zone_example',
      tab: 'settings',
    },
  },
  {
    name: 'domain-managed',
    path: '/domains/zone_secondary',
    tab: 'DNS Records',
    state: {
      page: 'domainDetail',
      domainZoneId: 'zone_secondary',
      tab: 'dns-records',
    },
  },
  {
    name: 'app-overview',
    path: '/services/svc_maid_api',
    state: { page: 'service', serviceId: 'svc_maid_api' },
  },
  {
    name: 'app-terminal',
    path: '/services/svc_maid_api',
    tab: 'Terminal',
    state: { page: 'service', serviceId: 'svc_maid_api', tab: 'terminal' },
  },
  {
    name: 'app-artifacts',
    path: '/services/svc_maid_api',
    tab: 'Artifacts',
    state: { page: 'service', serviceId: 'svc_maid_api', tab: 'artifacts' },
  },
  {
    name: 'database-overview',
    path: '/services/svc_db',
    state: { page: 'service', serviceId: 'svc_db' },
  },
  {
    name: 'database-console',
    path: '/services/svc_db',
    tab: 'Console',
    state: { page: 'service', serviceId: 'svc_db', tab: 'console' },
  },
  {
    name: 'cron-overview',
    path: '/services/svc_cron',
    state: { page: 'service', serviceId: 'svc_cron' },
  },
  {
    name: 'storage-overview',
    path: '/services/svc_maid_media',
    state: { page: 'service', serviceId: 'svc_maid_media' },
  },
  {
    name: 'storage-files',
    path: '/services/svc_maid_media',
    tab: 'Files',
    state: {
      page: 'service',
      serviceId: 'svc_maid_media',
      tab: 'files',
      storageBucketId: 'bucket_kyc',
      storagePrefix: '',
    },
  },
  { name: 'databases', path: '/databases', state: { page: 'databases' } },
  { name: 'email', path: '/email', state: { page: 'email' } },
  { name: 'cron-jobs', path: '/cron-jobs', state: { page: 'cron' } },
  { name: 'server', path: '/server', state: { page: 'servers' } },
  { name: 'activity', path: '/activity', state: { page: 'activity' } },
  {
    name: 'settings-workspace',
    path: '/settings',
    state: { page: 'settings', settingsTab: 'workspace' },
  },
  {
    name: 'settings-preferences',
    path: '/settings?tab=preferences',
    state: { page: 'settings', settingsTab: 'preferences' },
  },
  {
    name: 'create',
    path: '/',
    modal: 'create',
    state: {
      page: 'overview',
      modal: 'new',
      modalData: { projectId: 'proj_maid' },
    },
  },
  {
    name: 'deploy-zip',
    path: '/',
    modal: 'application',
    state: {
      page: 'overview',
      modal: 'deploy',
      modalData: { projectId: 'proj_maid' },
    },
  },
  {
    name: 'add-domain',
    path: '/domains',
    modal: 'domain',
    state: { page: 'domains', modal: 'domainRegister', modalData: {} },
  },
  {
    name: 'assistant',
    path: '/',
    assistant: true,
    state: { page: 'overview', assistantOpen: true },
  },
];
async function fonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}
async function layout(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      '.sidebar',
      '.topbar',
      '.content',
      '.heading',
      '.grid.four',
      '.quicklink',
      '.project-card',
      '.domain-zone-card',
    ];
    return Object.fromEntries(
      selectors.map((selector) => [
        selector,
        [...document.querySelectorAll(selector)].map((element) => {
          const r = element.getBoundingClientRect(),
            s = getComputedStyle(element);
          return {
            x: Math.round(r.x),
            y: Math.round(r.y),
            width: Math.round(r.width),
            height: Math.round(r.height),
            font: s.fontFamily,
            fontSize: s.fontSize,
            color: s.color,
            background: s.backgroundColor,
            border: s.borderColor,
          };
        }),
      ]),
    );
  });
}

test('render the immutable v1.13 reference beside all primary Svelte screens', async ({
  page,
  context,
}, info) => {
  test.setTimeout(180000);
  expect(
    createHash('sha256')
      .update(readFileSync('reference-cloudlane-v1.13.html'))
      .digest('hex'),
  ).toBe(referenceHash);
  const reference = await context.newPage();
  await reference.clock.setFixedTime(fixedTime);
  await page.clock.setFixedTime(fixedTime);
  // Serve the original pinned font files locally, without editing the reference HTML.
  await reference.route(
    'https://cdn.jsdelivr.net/npm/@fontsource/**',
    async (route) => {
      const match = new URL(route.request().url()).pathname.match(
        /^\/npm\/@fontsource\/(inter|jetbrains-mono)@5\.2\.8\/(latin-\d+\.css|files\/[a-z0-9.-]+\.(?:woff2?|css))$/,
      );
      const path = match
        ? resolve('node_modules/@fontsource', match[1]!, match[2]!)
        : '';
      if (!path || !existsSync(path)) return route.abort();
      await route.fulfill({
        path,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': path.endsWith('.css') ? 'text/css' : 'font/woff2',
        },
      });
    },
  );
  await reference.goto('/__reference');
  await fonts(reference);
  const comparisons: unknown[] = [];
  for (const scene of scenes) {
    await reference.evaluate(
      `Object.assign(ui, {modal:null,modalData:{},assistantOpen:false,projectId:null,serviceId:null,domainZoneId:null,tab:'overview',projectTab:'services',settingsTab:'workspace',search:'',showPassword:false,mobileMenu:false}, ${JSON.stringify(scene.state)});render();`,
    );
    await page.goto(scene.path);
    await expect(page.locator('.heading h1')).toBeVisible();
    if (scene.tab)
      await page
        .locator('.tabs')
        .getByRole('button', { name: scene.tab, exact: true })
        .click();
    if (scene.modal) {
      const labels: Record<string, string> = {
        create: 'Create new',
        application: 'Deploy an application',
        domain: 'Add domain',
      };
      await page
        .getByRole('button', { name: labels[scene.modal], exact: true })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    if (scene.assistant) {
      await page
        .getByRole('button', {
          name: 'Open Cloudlane Assistant (drag to reposition)',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('dialog', { name: 'Cloudlane assistant', exact: true }),
      ).toBeVisible();
    }
    await fonts(page);
    await fonts(reference);
    await page.mouse.move(0, 0);
    await reference.mouse.move(0, 0);
    if (scene.modal) {
      for (const target of [reference, page]) {
        const field = target
          .getByRole('dialog')
          .locator('input:not([type=hidden]),select,textarea')
          .first();
        if (await field.count()) await field.focus();
      }
    }
    const actual = await layout(page),
      expected = await layout(reference);
    comparisons.push({ scene: scene.name, actual, reference: expected });
    for (const [name, target] of [
      ['reference', reference],
      ['app', page],
    ] as const) {
      const path = info.outputPath(`${scene.name}-${name}.png`);
      await target.screenshot({
        path,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      });
      await info.attach(`${scene.name}-${name}`, {
        path,
        contentType: 'image/png',
      });
    }
    const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    expect.soft(dimensions.scroll,scene.name).toBeLessThanOrEqual(dimensions.width);
    if (['overview', 'projects', 'domains'].includes(scene.name)) {
      expect.soft(Object.keys(actual)).toEqual(Object.keys(expected));
      // Primary page structure and approved palette are checked against the source, not a self-generated app baseline.
      for (const selector of ['.sidebar', '.topbar', '.content', '.heading']) {
        const a = actual[selector]?.[0],
          b = expected[selector]?.[0];
        if (!a || !b)
          throw new Error(`Missing required layout region ${selector}`);
        expect.soft(a.font).toBe(b.font);
        expect.soft(a.fontSize).toBe(b.fontSize);
        expect.soft(a.color).toBe(b.color);
        expect.soft(a.background).toBe(b.background);
        expect.soft(a.width).toBeCloseTo(b.width, 0);
        expect.soft(a.x).toBeCloseTo(b.x, 0);
        expect.soft(a.y).toBeCloseTo(b.y, 0);
      }
    }
  }
  await info.attach('prototype-layout-comparison', {
    body: JSON.stringify(
      { referenceHash, fixedTime, viewport: page.viewportSize(), comparisons },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  await reference.close();
});

test('domain connections and DNS transitions preserve the central registry', async ({
  page,
}) => {
  await page.goto('/domains/zone_example');
  await page.getByRole('button', { name: 'Connect app', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await dialog
    .getByRole('button', { name: 'Connect hostname', exact: true })
    .click();
  await expect(page.locator('.detail-meta')).toContainText(
    '1 connected services',
  );
  await page
    .locator('.tabs')
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Switch to Cloudlane Managed DNS',
      exact: true,
    })
    .click();
  await page.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Prepare managed DNS', exact: true })
    .click();
  await expect(
    page.getByText('Pending transition:', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.detail-meta')).toContainText(
    '1 connected services',
  );
  await page
    .getByRole('button', { name: 'Cancel transition', exact: true })
    .click();
  await expect(
    page.getByText('Pending transition:', { exact: false }),
  ).toHaveCount(0);
});

test('service previews enforce terminal and SQL boundaries and discard resource state on reload', async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET') outgoing.push(r.url());
  });
  await page.goto('/services/svc_maid_api');
  await page.getByRole('button', { name: 'Terminal', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Select demo terminal permission role' })
    .selectOption('viewer');
  await expect(
    page.getByText('Terminal access denied for Viewer.', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Select demo terminal permission role' })
    .selectOption('developer');
  await page
    .getByRole('button', { name: 'Start demo session', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Demo shell command' })
    .fill('sudo docker ps');
  await page.getByRole('button', { name: 'Run demo', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('not permitted');
  await page
    .getByRole('button', { name: 'Simulate expiry', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Demo shell command' }),
  ).toHaveCount(0);
  await page.goto('/services/svc_db');
  await page.getByRole('button', { name: 'Console', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Query editor' })
    .fill('DROP TABLE users');
  await page.getByRole('button', { name: 'Run preview', exact: true }).click();
  await expect(page.getByText('Not permitted', { exact: true })).toBeVisible();
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Project name' })
    .fill('Temporary prototype check');
  await page
    .getByRole('button', { name: 'Create project', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Temporary prototype check',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Project not found', exact: true }),
  ).toBeVisible();
  expect(outgoing).toEqual([]);
  const storage = await page.evaluate(() => Object.keys(localStorage));
  expect(
    storage.every((key) =>
      ['cloudlane:appearance', 'cloudlane:assistant-position'].includes(key),
    ),
  ).toBe(true);
});
