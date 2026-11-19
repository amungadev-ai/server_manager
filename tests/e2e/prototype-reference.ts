import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const referenceHash =
  'f94204ed5e52ae58a80deea46d4fe6edba6626d8b0e36005f6fb9d9765a68f6d';
export const fixedTime = new Date('2026-11-19T06:00:00Z');
const requireDashboard = createRequire(resolve('apps/dashboard/package.json'));
export async function prototypeFonts(page: Page) {
  const faces = await page.evaluate(async () => {
    await Promise.all(
      [
        '400 14px Inter',
        '500 14px Inter',
        '600 14px Inter',
        '700 14px Inter',
        '400 14px "JetBrains Mono"',
        '500 14px "JetBrains Mono"',
      ].map((font) => document.fonts.load(font)),
    );
    await document.fonts.ready;
    const result: { family: string; weight: string; status: string }[] = [];
    document.fonts.forEach((face) =>
      result.push({
        family: face.family.replace(/["']/g, ''),
        weight: face.weight,
        status: face.status,
      }),
    );
    return result;
  });
  for (const [family, weights] of [
    ['Inter', ['400', '500', '600', '700']],
    ['JetBrains Mono', ['400', '500']],
  ] as const)
    for (const weight of weights)
      expect(
        faces,
        `${family} ${weight} must load; a fallback font is not a reference baseline`,
      ).toContainEqual({ family, weight, status: 'loaded' });
}
export async function openPrototype(page: Page) {
  expect(
    createHash('sha256')
      .update(readFileSync('reference-cloudlane-v1.13.html'))
      .digest('hex'),
  ).toBe(referenceHash);
  await page.clock.setFixedTime(fixedTime);
  await page.route(
    'https://cdn.jsdelivr.net/npm/@fontsource/**',
    async (route) => {
      const match = new URL(route.request().url()).pathname.match(
        /^\/npm\/@fontsource\/(inter|jetbrains-mono)@5\.2\.8\/(latin-\d+\.css|files\/[a-z0-9.-]+\.(?:woff2?|css))$/,
      );
      if (!match) throw new Error('Unexpected reference font URL.');
      const root = dirname(
        requireDashboard.resolve(`@fontsource/${match[1]}/package.json`),
      );
      const path = resolve(root, match[2]!);
      if (!existsSync(path))
        throw new Error(
          `Reference font file is missing: ${match[1]}/${match[2]}`,
        );
      await route.fulfill({
        path,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': path.endsWith('.css')
            ? 'text/css'
            : path.endsWith('.woff2')
              ? 'font/woff2'
              : 'font/woff',
        },
      });
    },
  );
  await page.goto('/__reference');
  await prototypeFonts(page);
}
