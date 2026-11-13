import { test, expect, type Page } from '@playwright/test';
import { installApiMocks, ADMIN_SESSION, FIXTURE_SLUG, UNPLAYED_BRACKET, type MockOptions } from './visual/mockApi';

// The score drawer only offers what the match's state allows, and asks before anything
// consequential: finishing a match, changing best-of, recording a forfeit, reopening.
// Runs against the mocked visual fixtures.

const FIXED_TIME = new Date('2026-06-01T12:00:00Z');
const SCORE_ROUTE = '**/api/tournaments/*/matches/*/score';

async function openFirstMatch(page: Page, options: MockOptions = UNPLAYED_BRACKET) {
  const unmocked = await installApiMocks(page, options);
  await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(session => {
    window.localStorage.setItem('tm_admin_auth', JSON.stringify(session));
  }, ADMIN_SESSION);
  await page.goto(`/${FIXTURE_SLUG}/manage/judge`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
  await page.getByTestId('feed-match-card').first().click();
  const drawer = page.getByTestId('match-score-drawer');
  await expect(drawer).toBeVisible();
  return { drawer, unmocked };
}

test('score boxes reject decimals, letters and anything over 99,999,999', async ({ page }) => {
  const { drawer, unmocked } = await openFirstMatch(page);
  const box = drawer.getByTestId('game-1-p1-score');

  await box.fill('1234567');
  await expect(box).toHaveValue('1,234,567');

  await box.fill('12.5');
  await expect(drawer.getByTestId('score-input-hint')).toHaveText('Whole numbers only');
  await expect(box).toHaveValue('1,234,567');

  await box.fill('100,000,000');
  await expect(drawer.getByTestId('score-input-hint')).toHaveText('Max 99,999,999');
  await expect(box).toHaveValue('1,234,567');
  expect(unmocked).toEqual([]);
});

test('rows appear as games finish, and finishing asks first', async ({ page }) => {
  const { drawer, unmocked } = await openFirstMatch(page);
  let saved = false;
  await page.route(SCORE_ROUTE, route => {
    saved = true;
    return route.fulfill({ status: 500, json: { error: 'stop here' } });
  });

  await expect(drawer.getByTestId('game-card-2')).toHaveCount(0);
  // Bo5: three wins for player 1.
  for (let game = 1; game <= 3; game++) {
    await drawer.getByTestId(`game-${game}-p1-score`).fill('900000');
    await drawer.getByTestId(`game-${game}-p2-score`).fill('100000');
  }
  await expect(drawer.getByTestId('game-card-4')).toHaveCount(0);

  await drawer.getByRole('button', { name: 'Finish Match' }).click();
  const prompt = page.getByRole('dialog', { name: /Finish Match #1\?/ });
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('wins 3–0 and advances to Match');
  expect(saved).toBe(false);

  await prompt.getByRole('button', { name: 'Cancel' }).click();
  await expect(prompt).toHaveCount(0);
  expect(saved).toBe(false);
  expect(unmocked).toEqual([]);
});

test('a forfeit needs a winner and a reason', async ({ page }) => {
  const { drawer, unmocked } = await openFirstMatch(page);
  await drawer.getByRole('button', { name: 'More Options' }).click();
  await drawer.getByRole('button', { name: 'Record Forfeit' }).click();

  const dialog = page.getByRole('dialog', { name: 'Record Forfeit' });
  const confirm = dialog.getByRole('button', { name: 'Record Forfeit' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('radio').first().click();
  await expect(confirm).toBeDisabled();
  await dialog.getByTestId('forfeit-reason').fill('No-show');
  await expect(confirm).toBeEnabled();
  expect(unmocked).toEqual([]);
});

test('best-of offers 1, 3, 5 and 7, asks before changing, and locks once a game is scored', async ({ page }) => {
  const { drawer, unmocked } = await openFirstMatch(page);
  const select = drawer.getByTestId('best-of-select');
  await expect(select.locator('option')).toHaveText(['Bo1', 'Bo3', 'Bo5', 'Bo7']);

  await select.selectOption('7');
  const prompt = page.getByRole('dialog', { name: 'Change to Bo7?' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Cancel' }).click();

  await drawer.getByTestId('game-1-p1-score').fill('5');
  await expect(drawer.getByTestId('best-of-select')).toHaveCount(0);
  await expect(drawer.getByTestId('best-of-locked')).toHaveText('Bo5');
  expect(unmocked).toEqual([]);
});

test('a completed match is read-only with an explicit Reopen', async ({ page }) => {
  const { drawer, unmocked } = await openFirstMatch(page, {});
  await expect(drawer.getByTestId('match-result')).toBeVisible();
  await expect(drawer.locator('input')).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Reopen Match' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Save|Finish/ })).toHaveCount(0);
  expect(unmocked).toEqual([]);
});
