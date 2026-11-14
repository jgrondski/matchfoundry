import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { installApiMocks, ADMIN_SESSION, FIXTURE_SLUG, UNPLAYED_BRACKET } from './visual/mockApi';
import { MATCH_CONFLICT_MESSAGE } from '../src/features/bracket/matchConflict';
import { ACTION_TIMEOUT_MESSAGE } from '../src/components/ui/actionConfig';

// Loading pattern (ER.8): the clicked save shows progress, other buttons wait, a hung request
// times out after 10 s with a banner, and failures keep the judge's scores on screen.

const FIXED_TIME = new Date('2026-06-01T12:00:00Z');
// Score inputs display with thousands separators.
const TYPED_SCORE = /^123,?456$/;
// saveMatchScores in store.tsx calls PUT /api/tournaments/:id/matches/:matchId/score.
const SCORE_ROUTE = '**/api/tournaments/*/matches/*/score';

const FIXTURE_TOURNAMENT = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'visual', 'fixtures', 'tournament.json'),
    'utf8'
  )
);

async function prepare(page: Page, clock: 'fixed' | 'installed' = 'fixed'): Promise<string[]> {
  // Unplayed, so the first match opens its score drawer for editing.
  const unmocked = await installApiMocks(page, UNPLAYED_BRACKET);
  if (clock === 'installed') {
    await page.clock.install({ time: FIXED_TIME });
  } else {
    await page.clock.setFixedTime(FIXED_TIME);
  }
  await page.addInitScript(session => {
    window.localStorage.setItem('tm_admin_auth', JSON.stringify(session));
  }, ADMIN_SESSION);
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
  // "Save Progress" / "Advance Winner", and "Saving…" while busy.
  const save = drawer.getByRole('button', { name: /^Sav/ });
  const cancel = drawer.getByRole('button', { name: 'Cancel', exact: true });
  return { drawer, input, save, cancel };
}

test('save shows loading, disables other buttons, then closes', async ({ page }) => {
  const unmocked = await prepare(page);
  await page.route(SCORE_ROUTE, async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.fulfill({ json: FIXTURE_TOURNAMENT });
  });
  const { drawer, save, cancel } = await openDirtyScoreDrawer(page);

  await save.click();
  await expect(save).toHaveText(/Saving…/);
  await expect(save.getByTestId('button-spinner')).toBeVisible();
  await expect(cancel).toBeDisabled();

  await expect(drawer).toHaveCount(0);
  expect(unmocked).toEqual([]);
});

test('a hung save times out after 10 s and keeps the typed score', async ({ page }) => {
  const unmocked = await prepare(page, 'installed');
  await page.route(SCORE_ROUTE, () => {
    // Never respond.
  });
  const { drawer, input, save } = await openDirtyScoreDrawer(page);
  const label = (await save.textContent())?.trim() ?? '';

  await save.click();
  await expect(save).toHaveText(/Saving…/);
  await page.clock.runFor(10_500);

  await expect(page.getByTestId('feedback-banner')).toContainText(ACTION_TIMEOUT_MESSAGE);
  await expect(save).toHaveText(label);
  await expect(save).toBeEnabled();
  await expect(drawer).toBeVisible();
  await expect(input).toHaveValue(TYPED_SCORE);
  expect(unmocked).toEqual([]);
});

test('a failed save shows the error banner and keeps the drawer open', async ({ page }) => {
  const unmocked = await prepare(page);
  await page.route(SCORE_ROUTE, route => route.fulfill({ status: 500, json: { error: 'Database unavailable' } }));
  const { drawer, input, save } = await openDirtyScoreDrawer(page);

  await save.click();

  await expect(page.getByTestId('feedback-banner')).toContainText('Database unavailable');
  await expect(drawer).toBeVisible();
  await expect(input).toHaveValue(TYPED_SCORE);
  expect(unmocked).toEqual([]);
});

test('a conflicting save shows the conflict notice, not the banner', async ({ page }) => {
  const unmocked = await prepare(page);
  await page.route(SCORE_ROUTE, route =>
    route.fulfill({ status: 409, json: { error: MATCH_CONFLICT_MESSAGE, code: 'MATCH_CONFLICT' } })
  );
  const { drawer, save } = await openDirtyScoreDrawer(page);

  await save.click();

  await expect(drawer.getByTestId('match-conflict-notice')).toBeVisible();
  await expect(drawer).toBeVisible();
  await expect(page.getByTestId('feedback-banner')).toHaveCount(0);
  expect(unmocked).toEqual([]);
});
