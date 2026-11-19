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
export async function navigate(page: Page, label: string, isMobile = false) {
  const menu = page.getByRole('button', {
    name: 'Open navigation',
    exact: true,
  });
  // Await the configured mobile UI instead of probing visibility before it is ready.
  if (isMobile) {
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
  }
  // Navigation counts contribute to the accessible name, e.g. "Projects 2".
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: new RegExp(`^${escaped}(?:\\s+\\d+)?$`) })
    .click();
}
export async function noHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
}
