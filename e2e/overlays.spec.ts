import { test, expect, type Page } from '@playwright/test';
import { installApiMocks, ADMIN_SESSION, FIXTURE_SLUG, FIXTURE_TIER_SLUG, UNPLAYED_BRACKET } from './visual/mockApi';

// Overlay dismissal rules (spec 11.1): read-only and clean overlays close on backdrop/Escape;
// dirty forms ask "Discard unsaved changes?" first. Runs against the mocked visual fixtures.

const FIXED_TIME = new Date('2026-06-01T12:00:00Z');
const MODAL_BACKDROP = { x: 10, y: 10 };
const DRAWER_BACKDROP = { x: 10, y: 360 };
// Score inputs display with thousands separators.
const TYPED_SCORE = /^123,?456$/;

async function prepare(page: Page, admin: boolean): Promise<string[]> {
  // Unplayed, so the first match opens its score drawer for editing.
  const unmocked = await installApiMocks(page, UNPLAYED_BRACKET);
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
}

async function openDirtyScoreDrawer(page: Page) {
  await page.goto(`/${FIXTURE_SLUG}/manage/judge`);
  await settle(page);
  await page.getByTestId('feed-match-card').first().click();
  const drawer = page.getByTestId('match-score-drawer');
  await expect(drawer).toBeVisible();
  const input = drawer.locator('input').first();
  await input.fill('123456');
  await expect(input).toHaveValue(TYPED_SCORE);
  return { drawer, input };
}

test('read-only overlay closes on backdrop click and Escape', async ({ page }) => {
  const unmocked = await prepare(page, false);
  await page.goto(`/${FIXTURE_SLUG}/${FIXTURE_TIER_SLUG}`);
  await settle(page);

  const share = page.getByRole('button', { name: 'Share', exact: true });
  await share.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.mouse.click(MODAL_BACKDROP.x, MODAL_BACKDROP.y);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await share.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(unmocked).toEqual([]);
});

test('clean form closes on Escape', async ({ page }) => {
  const unmocked = await prepare(page, true);
  await page.goto(`/${FIXTURE_SLUG}/manage/qualifiers`);
  await settle(page);

  await page.getByTestId('open-qualifier-entry').click();
  await expect(page.getByTestId('qualifier-entry-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('qualifier-entry-modal')).toBeHidden();
  expect(unmocked).toEqual([]);
});

test('dirty drawer asks before discarding', async ({ page }) => {
  const unmocked = await prepare(page, true);
  const { drawer, input } = await openDirtyScoreDrawer(page);
  const prompt = page.getByRole('dialog', { name: 'Discard unsaved changes?' });

  await page.mouse.click(DRAWER_BACKDROP.x, DRAWER_BACKDROP.y);
  await expect(prompt).toBeVisible();

  await prompt.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(input).toHaveValue(TYPED_SCORE);

  await page.keyboard.press('Escape');
  await expect(prompt).toBeVisible();

  await prompt.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(drawer).toHaveCount(0);
  expect(unmocked).toEqual([]);
});

test('Escape on the discard prompt keeps editing', async ({ page }) => {
  const unmocked = await prepare(page, true);
  const { drawer, input } = await openDirtyScoreDrawer(page);
  const prompt = page.getByRole('dialog', { name: 'Discard unsaved changes?' });

  await page.mouse.click(DRAWER_BACKDROP.x, DRAWER_BACKDROP.y);
  await expect(prompt).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(prompt).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(input).toHaveValue(TYPED_SCORE);
  expect(unmocked).toEqual([]);
});

// Back button / back swipe (spec 12.0a): Back is a close attempt, never leaves the page while
// an overlay is open, and closing an overlay another way leaves no stale history entry.

test('Back closes a clean drawer without leaving the page', async ({ page }) => {
  const unmocked = await prepare(page, true);
  await page.goto(`/${FIXTURE_SLUG}/manage/judge`);
  await settle(page);
  const url = page.url();

  await page.getByTestId('feed-match-card').first().click();
  const drawer = page.getByTestId('match-score-drawer');
  await expect(drawer).toBeVisible();

  await page.goBack();
  await expect(drawer).toHaveCount(0);
  expect(page.url()).toBe(url);
  expect(unmocked).toEqual([]);
});

test('Back on a dirty drawer asks before discarding, every time', async ({ page }) => {
  const unmocked = await prepare(page, true);
  const { drawer, input } = await openDirtyScoreDrawer(page);
  const url = page.url();
  const prompt = page.getByRole('dialog', { name: 'Discard unsaved changes?' });

  await page.goBack();
  await expect(prompt).toBeVisible();
  await expect(drawer).toBeVisible();
  expect(page.url()).toBe(url);

  await prompt.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(input).toHaveValue(TYPED_SCORE);

  await page.goBack();
  await expect(prompt).toBeVisible();
  await expect(drawer).toBeVisible();
  expect(page.url()).toBe(url);
  expect(unmocked).toEqual([]);
});

test('closing a drawer with its X leaves no stale history entry', async ({ page }) => {
  const unmocked = await prepare(page, true);
  await page.goto(`/${FIXTURE_SLUG}/manage/qualifiers`);
  await settle(page);
  const previousUrl = page.url();
  await page.goto(`/${FIXTURE_SLUG}/manage/judge`);
  await settle(page);

  await page.getByTestId('feed-match-card').first().click();
  const drawer = page.getByTestId('match-score-drawer');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Close drawer' }).click();
  await expect(drawer).toHaveCount(0);
  // The overlay's own history entry is removed asynchronously after it closes.
  await page.waitForFunction(() => !window.history.state?.overlay);

  await page.goBack();
  await expect(page).toHaveURL(previousUrl);
  expect(unmocked).toEqual([]);
});
