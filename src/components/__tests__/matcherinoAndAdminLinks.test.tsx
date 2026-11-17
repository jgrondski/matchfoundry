import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SpectatorLayout } from '../SpectatorLayout';
import { getAdminNavItems } from '../adminNavItems';
import { OrganizationProvider } from '../../features/organizations/store';
import { TournamentCard } from '../../features/tournament/components/TournamentCard';
import { createEmptyTournament, createDefaultTier } from '../../features/tournament/defaults';
import { toTournamentSummary } from '../../features/tournament/summary';
import type { Tournament } from '../../features/tournament/types';

function cup(overrides: Partial<Tournament> = {}): Tournament {
  const t = createEmptyTournament({ id: 't-1', slug: 'cup', name: 'Cup', ...overrides });
  t.tiers = [createDefaultTier(1, { id: 'tier-a', slug: 'gold', playerCount: 8 })];
  return t;
}

const renderCard = (t: Tournament, variant: 'public' | 'admin') =>
  renderToStaticMarkup(
    <MemoryRouter>
      <OrganizationProvider>
        <TournamentCard tournament={toTournamentSummary(t)} variant={variant} />
      </OrganizationProvider>
    </MemoryRouter>
  );

const renderHeader = (t: Tournament) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <OrganizationProvider>
        <SpectatorLayout tournament={t} activeView="bracket">
          <div />
        </SpectatorLayout>
      </OrganizationProvider>
    </MemoryRouter>
  );

describe('front-page card for tournament managers', () => {
  it('offers every admin sidebar destination, in sidebar order', () => {
    const html = renderCard(cup(), 'admin');
    const expected = getAdminNavItems({ slug: 'cup', tierSlug: 'gold' });
    expect(expected.map(i => i.label)).toEqual([
      'Qualifiers',
      'Standings',
      'Master Sheet',
      'Brackets',
      'Floor Judge',
      'Qual Review',
      'OBS Hub',
      'Players',
      'Settings',
    ]);
    let last = -1;
    for (const item of expected) {
      const at = html.indexOf(`data-testid="card-admin-link-${item.key}"`);
      expect(at, item.label).toBeGreaterThan(last);
      expect(html).toContain(`href="${item.to.replace(/&/g, '&amp;')}"`);
      last = at;
    }
    expect(html).toContain('Public View');
  });
});

describe('Matcherino link', () => {
  const withLink = () => cup({ matcherinoUrl: 'https://matcherino.com/t/cup' });

  it('shows on both front-page card variants when set, opening in a new tab', () => {
    for (const variant of ['public', 'admin'] as const) {
      const html = renderCard(withLink(), variant);
      expect(html).toMatch(/<a[^>]*href="https:\/\/matcherino\.com\/t\/cup"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
      expect(html).toContain('Matcherino');
    }
  });

  it('shows in the public header when set', () => {
    const html = renderHeader(withLink());
    expect(html).toContain('href="https://matcherino.com/t/cup"');
    expect(html).toContain('aria-label="Matcherino"');
  });

  it('is absent everywhere when not set or not a web link', () => {
    for (const t of [cup(), cup({ matcherinoUrl: 'javascript:alert(1)' })]) {
      expect(renderCard(t, 'public')).not.toContain('Matcherino');
      expect(renderCard(t, 'admin')).not.toContain('Matcherino');
      expect(renderHeader(t)).not.toContain('Matcherino');
    }
  });
});

describe('share button is gone', () => {
  it('the public header has no Share button', () => {
    const html = renderHeader(cup());
    expect(html).not.toMatch(/>Share</);
    expect(html).not.toContain('Share Bracket');
  });
});
