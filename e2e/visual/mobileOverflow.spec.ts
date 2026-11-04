import { test, expect } from '@playwright/test';
import { prepare, settle, MANUAL_SEEDING, FIXTURE_SLUG as S, FIXTURE_TIER_SLUG as T, FIXTURE_ORG_SLUG as O, type MockOptions } from './mockApi';

interface OverflowRoute { step: string; name: string; path: string; admin: boolean; options?: MockOptions }

// Every non-OBS route in src/App.tsx, tagged with the Phase 12 step that makes it mobile-ready.
// Alias routes that render the same page (/:slug/brackets, /:slug/view, /:slug/bracket,
// /:slug/quals, /login, /:slug/sheet, /:slug/judge, /:slug/players, /:slug/settings) are covered by their targets.
const ROUTES: OverflowRoute[] = [
  { step: '12.1c', name: 'landing', path: '/', admin: false },
  { step: '12.1a', name: 'public-bracket', path: `/${S}/${T}`, admin: false },
  { step: '12.1b', name: 'manage-bracket', path: `/${S}/manage/bracket/${T}`, admin: true },
  { step: '12.2a', name: 'judge', path: `/${S}/manage/judge`, admin: true },
  { step: '12.2b', name: 'leaderboard', path: `/${S}/leaderboard`, admin: false },
  { step: '12.2b', name: 'manage-qualifiers', path: `/${S}/manage/qualifiers`, admin: true },
  { step: '12.2c', name: 'review', path: `/${S}/manage/review`, admin: true },
  { step: '12.3', name: 'public-bracket-compact', path: `/${S}/${T}?view=compact`, admin: false },
  { step: '12.4a', name: 'standings', path: `/${S}/standings`, admin: false },
  { step: '12.4a', name: 'manage-standings', path: `/${S}/manage/standings`, admin: true },
  { step: '12.4b', name: 'manage-players', path: `/${S}/manage/players`, admin: true },
  { step: '12.4c', name: 'players', path: '/players', admin: true },
  { step: '12.5a', name: 'settings', path: `/${S}/manage/settings`, admin: true },
  { step: '12.5b', name: 'manage-seeding', path: `/${S}/manage/seeding`, admin: true, options: MANUAL_SEEDING },
  { step: '12.5b', name: 'public-seeding', path: `/${S}/seeding`, admin: false, options: MANUAL_SEEDING },
  { step: '12.5c', name: 'manage-sheet', path: `/${S}/manage/sheet`, admin: true },
  { step: '12.5d', name: 'organizations', path: '/organizations', admin: true },
  { step: '12.5d', name: 'org-detail', path: `/org/${O}`, admin: true },
  { step: '12.5e', name: 'obs-hub', path: `/${S}/obs`, admin: false },
  { step: '12.5e', name: 'admin-login', path: '/admin', admin: false },
  { step: '12.5f', name: 'qualify', path: `/${S}/qualify`, admin: false },
];

for (const r of ROUTES) {
  test(`[${r.step}] no horizontal overflow: ${r.name}`, async ({ page }) => {
    const unmocked = await prepare(page, r.admin, r.options);
    await page.goto(r.path);
    await settle(page);
    const offenders = await page.evaluate(() => {
      // clientWidth, not innerWidth: with isMobile, Chromium widens innerWidth to fit wide content.
      const limit = document.documentElement.clientWidth + 0.5;
      const out: string[] = [];
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (el.getBoundingClientRect().right <= limit) continue;
        // Skip content clipped by a scroll or hidden-overflow ancestor (it doesn't widen the page).
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox !== 'visible' && p.getBoundingClientRect().right <= limit) { clipped = true; break; }
        }
        if (clipped) continue;
        const testId = el.getAttribute('data-testid');
        const cls = (el.getAttribute('class') ?? '').slice(0, 80);
        out.push(`${el.tagName.toLowerCase()}${testId ? `[data-testid=${testId}]` : ''} .${cls}`);
        if (out.length >= 10) break;
      }
      return out;
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(unmocked, 'unmocked API GETs').toEqual([]);
    expect(overflow, `page is ${overflow}px too wide. Elements past the right edge:\n${offenders.join('\n')}`).toBeLessThanOrEqual(0);
  });
}
