import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchCardFeed } from '../components/MatchCardFeed';
import { generateTraditionalBracket } from '../math/traditional';
import { isMatchPlayable } from '../types';
import type { Tournament, TournamentTier } from '../../tournament/types';

const players = Array.from({ length: 4 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Player ${i + 1}`,
  seed: i + 1,
}));

function buildFixture(isLocked: boolean) {
  const bracket = generateTraditionalBracket(players, { tierId: 'gold', bestOf: 3 });
  const tier: TournamentTier = {
    id: 'gold',
    slug: 'gold',
    name: 'Gold',
    priority: 1,
    bracketType: 'TRADITIONAL',
    eliminationType: 'SINGLE',
    bestOf: 3,
    playerCount: players.length,
    bracket,
    isLocked,
  };
  const tournament: Tournament = {
    id: 't-keyboard',
    slug: 'keyboard-test',
    name: 'Keyboard Test',
    location: '',
    qualFormat: 'HIGH_SCORE',
    isLocked,
    tiers: [tier],
    matchScores: {},
    playersPool: [],
    qualifierSubmissions: [],
    tournamentPlayers: {},
  };
  return { tournament, tier };
}

function cardTags(html: string): string[] {
  return html.match(/<div[^>]*data-testid="feed-match-card"[^>]*>/g) ?? [];
}

describe('MatchCardFeed player name tap', () => {
  const profileLinks = (html: string) => html.match(/title="View Competitor"/g)?.length ?? 0;

  it('opens the score sheet, not the profile, on a judge card for a playable match', () => {
    const { tournament, tier } = buildFixture(true);
    expect(profileLinks(renderToStaticMarkup(<MatchCardFeed tournament={tournament} tier={tier} canManage />))).toBe(0);
  });

  it('still opens the profile on the public feed', () => {
    const { tournament, tier } = buildFixture(true);
    expect(profileLinks(renderToStaticMarkup(<MatchCardFeed tournament={tournament} tier={tier} canManage={false} />))).toBe(players.length);
  });

  it('still opens the profile for a judge when the card opens no score sheet', () => {
    const { tournament, tier } = buildFixture(false);
    expect(profileLinks(renderToStaticMarkup(<MatchCardFeed tournament={tournament} tier={tier} canManage />))).toBe(players.length);
  });
});

describe('MatchCardFeed keyboard access', () => {
  it('gives playable cards role="button" and tabindex="0", and TBD cards neither', () => {
    const { tournament, tier } = buildFixture(true);
    const allMatches = tier.bracket.rounds.flatMap(r => r.matches).filter(m => !m.isBye);
    const playableCount = allMatches.filter(isMatchPlayable).length;
    const unplayableCount = allMatches.length - playableCount;
    expect(playableCount).toBeGreaterThan(0);
    expect(unplayableCount).toBeGreaterThan(0);

    const tags = cardTags(renderToStaticMarkup(<MatchCardFeed tournament={tournament} tier={tier} />));
    expect(tags.length).toBe(allMatches.length);

    const interactive = tags.filter(t => t.includes('role="button"'));
    expect(interactive.length).toBe(playableCount);
    for (const t of interactive) expect(t).toContain('tabindex="0"');

    const inert = tags.filter(t => !t.includes('role="button"'));
    expect(inert.length).toBe(unplayableCount);
    for (const t of inert) expect(t).not.toContain('tabindex');
  });

  it('adds neither attribute when the tournament is not locked', () => {
    const { tournament, tier } = buildFixture(false);
    const tags = cardTags(renderToStaticMarkup(<MatchCardFeed tournament={tournament} tier={tier} />));
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) {
      expect(t).not.toContain('role="button"');
      expect(t).not.toContain('tabindex');
    }
  });
});
