import { test, expect, noHorizontalOverflow } from './fixtures';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

// Browser contract fixture only: route fulfillment does not establish real TLS/PostgreSQL acceptance.
const origin = 'https://auth-ui.example.test';
const csrf = 'A'.repeat(43),
  nextCsrf = 'B'.repeat(43);
const codes = Array.from(
  { length: 10 },
  (_, i) =>
    (i.toString(16).repeat(4) + '-').repeat(7) + i.toString(16).repeat(4),
);
const expiresAt = () => new Date(Date.now() + 300000).toISOString();
const session = () => ({
  authenticated: true,
  mfaVerified: true,
  authenticationMethod: 'totp',
  csrfToken: nextCsrf,
  user: {
    id: randomUUID(),
    email: 'owner@example.test',
    displayName: 'Owner',
    role: 'owner',
  },
  workspace: { id: randomUUID(), name: 'Workspace' },
});
type Call = {
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};
async function fixture(
  page: Page,
  options: {
    setup?: boolean;
    rejectFirst?: boolean;
    unavailable?: boolean;
  } = {},
) {
  const calls: Call[] = [];
  let failures = options.rejectFirst ? 1 : 0;
  await page.route(origin + '/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.replace('/api/v1', '');
      let body: unknown,
        status = 200;
      const data = request.method() === 'POST' ? request.postDataJSON() : {};
      calls.push({ path, body: data, headers: request.headers() });
      if (path === '/installation/status')
        body = {
          state: options.unavailable
            ? 'unconfigured'
            : options.setup
              ? 'unclaimed'
              : 'active',
          ownerConfigured: !options.unavailable && !options.setup,
          setupAvailable: !!options.setup,
        };
      else if (path === '/bootstrap/claim')
        body = { state: 'owner_setup_required', csrfToken: csrf };
      else if (path === '/bootstrap/owner')
        body = { state: 'mfa_setup_required' };
      else if (path === '/auth/login')
        body = {
          state: options.setup ? 'mfa_setup_required' : 'mfa_required',
          csrfToken: csrf,
          expiresAt: expiresAt(),
        };
      else if (path === '/auth/mfa/enroll')
        body = {
          secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
          uri: 'otpauth://totp/Cloudlane:owner?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Cloudlane',
          expiresAt: expiresAt(),
        };
      else if (
        path === '/auth/mfa/confirm' ||
        path === '/auth/recovery/regenerate'
      )
        body = {
          state: 'recovery_codes_required',
          csrfToken: nextCsrf,
          codes,
          expiresAt: expiresAt(),
        };
      else if (path === '/auth/mfa/verify' && failures-- > 0) {
        status = 401;
        body = {
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Do not display arbitrary server text',
            requestId: randomUUID(),
          },
        };
      } else if (path === '/auth/logout') body = { signedOut: true };
      else body = session();
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
        headers: {
          'cache-control': 'no-store',
          'x-cloudlane-test-fixture': 'ui-contract-only',
        },
      });
      return;
    }
    const relative = url.pathname.startsWith('/_app/')
      ? url.pathname.slice(1)
      : 'index.html';
    if (relative.includes('..')) throw new Error('Invalid fixture path');
    const contentType = relative.endsWith('.js')
      ? 'application/javascript'
      : relative.endsWith('.css')
        ? 'text/css'
        : relative.endsWith('.woff2')
          ? 'font/woff2'
          : 'text/html';
    await route.fulfill({
      contentType,
      body: await readFile(resolve('test-results/e2e-site/http', relative)),
    });
  });
  return calls;
}
async function password(page: Page) {
  await page.getByLabel('Email address').fill('owner@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('a synthetic owner password');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
async function noStoredSecrets(page: Page, values: string[]) {
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  for (const value of values) expect(stored).not.toContain(value);
}

test('auth demo walkthrough stays read-only, needs recovery acknowledgement and makes no API calls', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });
  await page.goto('/setup');
  await expect(
    page.getByRole('heading', { name: 'Claim your installation' }),
  ).toBeVisible();
  await expect(page.getByText(/Read-only preview/)).toBeVisible();
  await expect(page.getByLabel('Installation claim code')).toBeDisabled();
  await page.getByRole('button', { name: 'Continue preview' }).click();
  await expect(page.getByLabel('Email address')).toBeDisabled();
  await page.getByRole('button', { name: 'Continue preview' }).click();
  await expect(
    page.getByAltText('Authenticator enrollment QR code'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue preview' }).click();
  await expect(
    page.getByRole('list', { name: 'Recovery codes' }).locator('li'),
  ).toHaveCount(10);
  await expect(
    page.getByRole('button', { name: 'Continue preview' }),
  ).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue preview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Owner access ready' }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  await noHorizontalOverflow(page);
  await noStoredSecrets(page, ['JBSWY3DPEHPK3PXP', codes[0]!]);
});
test('HTTP production auth refuses secret entry and unconfigured HTTPS presents a clear unavailable state', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4175/login');
  await expect(
    page.getByRole('heading', { name: 'Owner access unavailable' }),
  ).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await fixture(page, { unavailable: true });
  await page.goto(origin + '/login');
  await expect(
    page.getByRole('heading', { name: 'Owner access unavailable' }),
  ).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await noHorizontalOverflow(page);
});
test('HTTPS UI contract setup validates passwords, generates QR locally and acknowledges codes with rotated CSRF', async ({
  page,
}, info) => {
  info.annotations.push({
    type: 'transport',
    description: 'synthetic route fulfillment; not real TLS or SQL proof',
  });
  const calls = await fixture(page, { setup: true });
  await page.goto(origin + '/setup');
  await page.getByLabel('Installation claim code').fill('synthetic-claim');
  await page.getByRole('button', { name: 'Verify claim code' }).click();
  await page.getByLabel('Your name').fill('Owner');
  await page.getByLabel('Email address').fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password').fill('short');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at least 15');
  await expect(page.getByRole('alert')).toBeFocused();
  await page
    .getByLabel('Password', { exact: true })
    .fill('a synthetic owner password');
  await page.getByLabel('Confirm password').fill('a synthetic owner password');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByAltText('Authenticator enrollment QR code'),
  ).toHaveAttribute('src', /^data:image\/png/);
  expect(
    calls.find((c) => c.path === '/bootstrap/owner')?.headers['x-csrf-token'],
  ).toBe(csrf);
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Authenticator setup key')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Finish secure setup' }),
  ).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download codes' }).click();
  expect((await download).suggestedFilename()).toBe(
    'cloudlane-recovery-codes.txt',
  );
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Finish secure setup' }).click();
  await expect(
    page.getByRole('heading', { name: 'Owner access ready' }),
  ).toBeFocused();
  expect(
    calls.find((c) => c.path === '/auth/recovery/acknowledge')?.headers[
      'x-csrf-token'
    ],
  ).toBe(nextCsrf);
  expect(
    calls.find((c) => c.path === '/auth/recovery/acknowledge')?.body,
  ).toEqual({ acknowledged: true });
  await noStoredSecrets(page, [
    'synthetic-claim',
    'a synthetic owner password',
    csrf,
    ...codes,
  ]);
  await noHorizontalOverflow(page);
});
test('HTTPS UI contract login requires MFA and exposes safe retry errors with focus', async ({
  page,
}) => {
  const calls = await fixture(page, { rejectFirst: true });
  await page.goto(origin + '/login');
  await password(page);
  await expect(
    page.getByRole('heading', { name: 'Verify your authenticator' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open workspace' })).toHaveCount(
    0,
  );
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Verification failed');
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(
    page.getByText('Do not display arbitrary server text'),
  ).toHaveCount(0);
  await page.getByLabel('Authenticator code').fill('654321');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Owner access ready' }),
  ).toBeVisible();
  expect(calls.filter((c) => c.path === '/auth/mfa/verify')).toHaveLength(2);
  expect(
    calls
      .filter((c) => c.path === '/auth/mfa/verify')
      .every((c) => c.headers['x-csrf-token'] === csrf),
  ).toBe(true);
  await noStoredSecrets(page, [
    'a synthetic owner password',
    '123456',
    '654321',
    csrf,
  ]);
  await noHorizontalOverflow(page);
});
test('HTTPS UI contract recovery still verifies password and sends one code through the challenge', async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto(origin + '/recover');
  await expect(
    page.getByRole('heading', { name: 'Recover owner access' }),
  ).toBeVisible();
  await password(page);
  await page.getByLabel('Recovery code', { exact: true }).fill(codes[0]!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Owner access ready' }),
  ).toBeVisible();
  expect(calls.filter((c) => c.path === '/auth/login')).toHaveLength(1);
  expect(calls.find((c) => c.path === '/auth/recovery/use')?.body).toEqual({
    code: codes[0]!,
  });
  expect(
    calls.find((c) => c.path === '/auth/recovery/use')?.headers['x-csrf-token'],
  ).toBe(csrf);
  await noStoredSecrets(page, [codes[0]!]);
  await noHorizontalOverflow(page);
});
test('HTTPS UI contract security requires step-up and auth form has no serious accessibility failures', async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto(origin + '/auth/security');
  await expect(
    page.getByRole('heading', { name: 'Recovery code settings' }),
  ).toBeVisible();
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    ),
  ).toEqual([]);
  await page.getByLabel('Current password').fill('a synthetic owner password');
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Replace recovery codes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Save your recovery codes' }),
  ).toBeVisible();
  expect(
    calls.find((c) => c.path === '/auth/recovery/regenerate')?.headers[
      'x-csrf-token'
    ],
  ).toBe(nextCsrf);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Finish secure setup' }).click();
  await expect(
    page.getByRole('heading', { name: 'Owner access ready' }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});
