import { test as base, expect } from '@playwright/test';
import { excludeSensitive } from './live';

/** The test function for specs that read the synthetic archive: Sensitive records are hidden. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await excludeSensitive(page);
    await use(page);
  },
});
export { expect };
