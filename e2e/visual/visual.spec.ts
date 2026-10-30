import { test, expect, type Page } from '@playwright/test';
import { installApiMocks, ADMIN_SESSION, FIXTURE_SLUG, FIXTURE_TIER_SLUG } from './mockApi';

const FIXED_TIME = new Date('2026-06-01T12:00:00Z');

const PAGES = [
  { name: 'landing', path: '/', admin: false },
  { name: 'bracket', path: `/${FIXTURE_SLUG}/${FIXTURE_TIER_SLUG}`, admin: false },
  { name: 'leaderboard', path: `/${FIXTURE_SLUG}/leaderboard`, admin: false },
  { name: 'standings', path: `/${FIXTURE_SLUG}/standings`, admin: false },
  { name: 'judge', path: `/${FIXTURE_SLUG}/manage/judge`, admin: true },
  { name: 'manage-qualifiers', path: `/${FIXTURE_SLUG}/manage/qualifiers`, admin: true },
  { name: 'review', path: `/${FIXTURE_SLUG}/manage/review`, admin: true },
  { name: 'settings', path: `/${FIXTURE_SLUG}/manage/settings`, admin: true },
];

async function prepare(page: Page, admin: boolean): Promise<string[]> {
  const unmocked = await installApiMocks(page);
  await page.clock.setFixedTime(FIXED_TIME);
  if (admin) {
    await page.addInitScript(session => {
      window.localStorage.setItem('tm_admin_auth', JSON.stringify(session));
    }, ADMIN_SESSION);
  }
  return unmocked;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

for (const target of PAGES) {
  test(`page: ${target.name}`, async ({ page }) => {
    const unmocked = await prepare(page, target.admin);
    await page.goto(target.path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${target.name}.png`);
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
