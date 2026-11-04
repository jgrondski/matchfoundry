import { test, expect } from '@playwright/test';
import { prepare, settle, FIXTURE_SLUG, FIXTURE_TIER_SLUG } from './mockApi';

const PAGES: Array<{ name: string; path: string; admin: boolean; fullPage?: boolean }> = [
  { name: 'landing', path: '/', admin: false },
  { name: 'bracket', path: `/${FIXTURE_SLUG}/${FIXTURE_TIER_SLUG}`, admin: false },
  { name: 'leaderboard', path: `/${FIXTURE_SLUG}/leaderboard`, admin: false },
  { name: 'standings', path: `/${FIXTURE_SLUG}/standings`, admin: false },
  { name: 'judge', path: `/${FIXTURE_SLUG}/manage/judge`, admin: true },
  { name: 'manage-qualifiers', path: `/${FIXTURE_SLUG}/manage/qualifiers`, admin: true },
  { name: 'review', path: `/${FIXTURE_SLUG}/manage/review`, admin: true },
  // Full page: settings is a long form whose lower sections would otherwise go unchecked.
  { name: 'settings', path: `/${FIXTURE_SLUG}/manage/settings`, admin: true, fullPage: true },
];

for (const target of PAGES) {
  test(`page: ${target.name}`, async ({ page }) => {
    const unmocked = await prepare(page, target.admin);
    await page.goto(target.path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${target.name}.png`, { fullPage: target.fullPage ?? false });
    expect(unmocked).toEqual([]);
  });
}

test('overlay: match score drawer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'visual-desktop', 'Desktop only');
  const unmocked = await prepare(page, true);
  await page.goto(`/${FIXTURE_SLUG}/manage/judge`);
  await settle(page);
  await page.getByTestId('feed-match-card').first().click();
  await expect(page.getByTestId('match-score-drawer')).toBeVisible();
  await expect(page).toHaveScreenshot('overlay-match-score-drawer.png');
  expect(unmocked).toEqual([]);
});

test('overlay: qualifier entry modal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'visual-desktop', 'Desktop only');
  const unmocked = await prepare(page, true);
  await page.goto(`/${FIXTURE_SLUG}/manage/qualifiers`);
  await settle(page);
  await page.getByTestId('open-qualifier-entry').click();
  await expect(page.getByTestId('qualifier-entry-modal')).toBeVisible();
  await expect(page).toHaveScreenshot('overlay-qualifier-entry.png');
  expect(unmocked).toEqual([]);
});
