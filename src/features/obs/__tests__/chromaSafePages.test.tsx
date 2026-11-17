import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TournamentProvider } from '../../tournament/store';
import { OrganizationProvider } from '../../organizations/store';
import { PublicLeaderboardPage } from '../../../routes/PublicLeaderboardPage';
import { FinalStandingsPage } from '../../../routes/FinalStandingsPage';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import { runFullSimulation } from '../../tournament/simulation';
import type { Tournament } from '../../tournament/types';
import { CHROMA_KEY_COLORS } from '../../../theme/palette';

function playedTournament(overrides: Partial<Tournament> = {}): Tournament {
  const base = createEmptyTournament({
    id: 't-pages',
    slug: 'pages',
    name: 'Pages Cup',
    tiers: [createDefaultTier(1, { playerCount: 8 })],
  });
  return { ...runFullSimulation(base), ...overrides };
}

function render(url: string, tournament: Tournament) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <TournamentProvider initialTournaments={[tournament]} initialHydrated={true}>
        <OrganizationProvider initialHydrated={true}>
          <Routes>
            <Route path="/:slug/leaderboard" element={<PublicLeaderboardPage />} />
            <Route path="/:slug/standings" element={<FinalStandingsPage />} />
          </Routes>
        </OrganizationProvider>
      </TournamentProvider>
    </MemoryRouter>
  );
}

/** Everything between the frame's opening tag and its solid panel: what sits directly on the key. */
function outsidePanel(html: string): string {
  const frame = html.indexOf('data-testid="obs-page-frame"');
  const panel = html.indexOf('data-testid="obs-solid-panel"');
  return html.slice(frame, panel);
}

describe.each<[string, string, Partial<Tournament>]>([
  ['qualifying leaderboard', '/pages/leaderboard', {}],
  ['manual seeding', '/pages/leaderboard', { seedingMethod: 'MANUAL' }],
  ['final standings', '/pages/standings', {}],
])('%s OBS overlay', (_label, path, overrides) => {
  const tournament = () => {
    const t = playedTournament(overrides);
    if (overrides.seedingMethod === 'MANUAL') t.manualSeeds = t.playersPool.map(p => p.id);
    return t;
  };

  it.each(['green', 'magenta', 'blue'] as const)('chroma=%s fills the screen with the key and puts content on a solid panel', chroma => {
    const html = render(`${path}?obs=true&chroma=${chroma}`, tournament());
    expect(html).toContain(`background:${CHROMA_KEY_COLORS[chroma]}`);
    expect(html).toContain('data-testid="obs-solid-panel"');
    const panelTag = html.slice(html.indexOf('data-testid="obs-solid-panel"'), html.indexOf('>', html.indexOf('data-testid="obs-solid-panel"')));
    expect(panelTag).toContain('bg-canvas');
    // Nothing translucent between the key and the panel.
    expect(outsidePanel(html)).not.toMatch(/rgba\(|opacity-|shadow-|\/\d{1,2}\b/);
    expect(html).toContain('Pages Cup');
  });

  it('without chroma the background stays transparent (OBS uses real alpha)', () => {
    const html = render(`${path}?obs=true`, tournament());
    expect(html).toContain('data-testid="obs-page-frame"');
    expect(html).toContain('background:transparent');
    expect(html).not.toContain('data-testid="obs-solid-panel"');
  });
});
