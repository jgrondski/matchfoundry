import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SpectatorLayout, SpectatorNavView } from '../SpectatorLayout';
import { OrganizationProvider } from '../../features/organizations/store';
import { createEmptyTournament, createDefaultTier } from '../../features/tournament/defaults';

const tournament = createEmptyTournament({ id: 't-1', slug: 'cup', name: 'Cup' });
tournament.tiers = [
  createDefaultTier(1, { id: 'tier-a', slug: 'gold', playerCount: 8 }),
  createDefaultTier(2, { id: 'tier-b', slug: 'silver', playerCount: 8 }),
];

function render(activeView: SpectatorNavView, activeTierSlug?: string) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <OrganizationProvider>
        <SpectatorLayout
          tournament={tournament}
          activeView={activeView}
          activeTier={tournament.tiers.find(t => t.slug === activeTierSlug)}
        >
          <div />
        </SpectatorLayout>
      </OrganizationProvider>
    </MemoryRouter>
  );
}

const loginHref = (redirect: string) =>
  `href="/admin?slug=cup&amp;redirect=${encodeURIComponent(redirect)}"`;

describe('SpectatorLayout login sends staff to the manage equivalent of the public view', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it.each([
    ['leaderboard', undefined, '/cup/manage/qualifiers'],
    ['standings', undefined, '/cup/manage/standings'],
    ['qualify', undefined, '/cup/manage/review'],
    ['bracket', undefined, '/cup/manage/bracket/gold'],
    ['bracket', 'silver', '/cup/manage/bracket/silver'],
  ] as const)('%s (tier %s) -> %s', (view, tierSlug, managePath) => {
    expect(render(view, tierSlug)).toContain(loginHref(managePath));
  });

  it('the Manage button for signed-in staff uses the same manage equivalent', () => {
    // Tests run in Node; stub just enough of window for the stored admin session.
    const stored = JSON.stringify({ token: 't', role: 'SYSTEM_ADMIN', expiresAt: Date.now() + 60_000 });
    (globalThis as any).window = {
      localStorage: { getItem: (key: string) => (key === 'tm_admin_auth' ? stored : null), removeItem: () => {} },
    };
    const html = render('standings');
    expect(html).toContain('href="/cup/manage/standings"');
    expect(html).not.toContain('href="/admin?');
  });
});
