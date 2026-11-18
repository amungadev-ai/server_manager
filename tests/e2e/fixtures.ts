import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const test = base.extend<{ browserRuntime: void }>({
  browserRuntime: [
    async ({ browser, page }, use, info) => {
      info.annotations.push({
        type: 'browser-runtime',
        description: browser.version(),
      });
      info.annotations.push({
        type: 'viewport',
        description: JSON.stringify(page.viewportSize()),
      });
      await use(undefined);
      if (!page.isClosed()) {
        const path = info.outputPath('rendered-page.png');
        await page.screenshot({ path, fullPage: true });
        await info.attach('rendered-page', { path, contentType: 'image/png' });
      }
    },
    { auto: true },
  ],
});
export { expect };
export async function navigate(page: Page, label: string) {
  const menu = page.getByRole('button', {
    name: 'Open navigation',
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: label, exact: true }).click();
}
export async function noHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
}
