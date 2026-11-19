import AxeBuilder from '@axe-core/playwright';
import { test, expect, navigate, noHorizontalOverflow } from './fixtures';

test('demo overview is explicitly labelled and fits the viewport', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Good morning, builder.' }),
  ).toBeVisible();
  await expect(page.getByText('SIMULATION', { exact: true })).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(3);
  await expect(page.getByText('4 healthy', { exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
});
test('project search, detail navigation and reload use the static SPA fallback', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await navigate(page, 'Projects', isMobile);
  await page.getByRole('textbox', { name: 'Search projects' }).fill('Maid');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await page.getByRole('link', { name: /Maid Finder/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Maid Finder', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Maid Finder', exact: true }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});
test('Add Domain has one field and returns focus on Escape', async ({
  page,
}) => {
  await page.goto('/domains');
  const trigger = page.getByRole('button', { name: 'Add domain', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Add domain' });
  await expect(dialog.getByRole('textbox')).toHaveCount(1);
  await dialog
    .getByRole('textbox', { name: 'Domain name' })
    .fill('fixture.example');
  await expect(
    dialog.getByRole('button', { name: 'Add domain', exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('domain detail has exactly seven sections and DNS mode is in Settings', async ({
  page,
}) => {
  await page.goto('/domains');
  await page
    .getByRole('link', { name: 'Manage example.com', exact: true })
    .click();
  await expect(page.locator('.tabs .tab')).toHaveText([
    'Overview',
    'DNS Records',
    'Subdomains',
    'Connections',
    'SSL',
    'Email',
    'Settings',
  ]);
  await page.getByRole('button', { name: 'DNS Records', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Unavailable', exact: true }),
  ).toHaveCount(0);
  await page
    .locator('.tabs')
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'DNS Management', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Switch to Cloudlane Managed DNS',
      exact: true,
    }),
  ).toBeEnabled();
  await noHorizontalOverflow(page);
});
test('appearance persists across reload for every palette and theme', async ({
  page,
}) => {
  await page.goto('/settings?tab=preferences');
  for (const theme of ['Light', 'Dark']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    for (const palette of ['Original', 'Slate', 'Sand', 'Sage', 'Mauve']) {
      await page.getByRole('button', { name: palette, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute(
        'data-palette',
        palette.toLowerCase(),
      );
      await noHorizontalOverflow(page);
    }
    await page.reload();
    await expect(
      page.getByRole('button', { name: theme, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'mauve');
  }
});
test('default overview has no serious or critical automated accessibility violations', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Good morning, builder.' }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await info.attach('axe-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect(
    results.violations.filter((item) =>
      ['critical', 'serious'].includes(item.impact ?? ''),
    ),
  ).toEqual([]);
});
test('HTTP fixture data is rendered without demo fallback or invented server health', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4174/');
  await expect(
    page.getByRole('link', { name: /Test Fixture Project/ }),
  ).toBeVisible();
  await expect(
    page.getByText('No server metrics have been reported.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('0 healthy', { exact: true })).toBeVisible();
  await expect(page.getByText('Design preview', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('link', { name: /Maid Finder/ })).toHaveCount(0);
  await noHorizontalOverflow(page);
});
test('a rejected fixture session prevents overview loading', async ({
  page,
}) => {
  const paths: string[] = [];
  page.on('request', (request) => paths.push(new URL(request.url()).pathname));
  await page.setExtraHTTPHeaders({
    'X-Cloudlane-Test-Scenario': 'unauthorized',
  });
  await page.goto('http://127.0.0.1:4174/');
  await expect(
    page.getByRole('heading', { name: 'Connect your Cloudlane API' }),
  ).toBeVisible();
  expect(paths).not.toContain('/api/v1/overview');
  await expect(page.getByRole('link', { name: /Maid Finder/ })).toHaveCount(0);
});
test('malformed HTTP fixture data becomes an explicit connection error', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    'X-Cloudlane-Test-Scenario': 'invalid-overview',
  });
  await page.goto('http://127.0.0.1:4174/');
  await expect(
    page.getByRole('heading', { name: 'Connect your Cloudlane API' }),
  ).toBeVisible();
  await expect(
    page.getByText('The API response does not match the contract.', {
      exact: true,
    }),
  ).toBeVisible();
});
test('actual unconfigured NestJS API never masquerades as an owner session', async ({
  page,
  request,
}) => {
  const status = await request.get(
    'http://127.0.0.1:4175/api/v1/installation/status',
  );
  expect(await status.json()).toEqual({
    state: 'unconfigured',
    ownerConfigured: false,
    setupAvailable: false,
  });
  await page.goto('http://127.0.0.1:4175/');
  await expect(
    page.getByRole('heading', { name: 'Connect your Cloudlane API' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Try again', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Maid Finder/ })).toHaveCount(0);
  const unknown = await request.get('http://127.0.0.1:4175/api/v1/nonexistent');
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()['content-type']).toContain('application/json');
});
