import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ObsBracketView } from '../components/ObsBracketView';
import { BracketVisualizer } from '../../bracket/components/BracketVisualizer';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import type { Tournament } from '../../tournament/types';
import { blendOver, clashesWithChroma, toOpaqueHex } from '../../bracket/colorUtils';
import { getChromaClashes, recommendChroma, resolveChromaColor } from '../chroma';
import { CHROMA_KEY_COLORS } from '../../../theme/palette';

/** Draft (unlocked) 16-player bracket: every match past round 1 is TBD, as during quals. */
function draftTournament(): Tournament {
  const tier = createDefaultTier(1, { id: 'tier-gold', slug: 'gold' });
  return createEmptyTournament({ id: 't-obs', slug: 'obs-cup', name: 'OBS Cup', tiers: [tier], isLocked: false });
}

/** Locked bracket with the first round-1 match complete, so it has a loser. */
function lockedWithLoser(): { tournament: Tournament; loserName: string } {
  const tournament = draftTournament();
  tournament.isLocked = true;
  const tier = tournament.tiers[0];
  const match = tier.bracket!.rounds[0].matches[0];
  const p1 = match.player1.player!;
  const p2 = match.player2.player!;
  tournament.matchScores[match.id] = {
    matchId: match.id,
    tierId: tier.id,
    bestOf: 5,
    player1Wins: 3,
    player2Wins: 0,
    games: [],
    winnerPlayerId: p1.id,
    loserPlayerId: p2.id,
    isComplete: true,
  };
  return { tournament, loserName: p2.name };
}

function renderObs(tournament: Tournament, chroma: string | null) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ObsBracketView tournament={tournament} tier={tournament.tiers[0]} viewMode="standard" chroma={chroma} />
    </MemoryRouter>
  );
}

/** Every inline `style` attribute plus every class list, for scanning what could be translucent. */
const styles = (html: string) => [...html.matchAll(/style="([^"]*)"/g)].map(m => m[1]).join('\n');
const classes = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].map(m => m[1]).join('\n');

describe('OBS bracket is fully opaque over a chroma key', () => {
  it('transparent OBS (real alpha, no keyer) still renders TBD matches at full opacity', () => {
    expect(classes(renderObs(draftTournament(), null))).not.toMatch(/\bopacity-\d+/);
  });

  it.each(['green', 'magenta', 'blue'])('draft bracket with TBD matches, chroma=%s', chroma => {
    const html = renderObs(draftTournament(), chroma);
    const cls = classes(html);
    // Unplayed/TBD matches used to render at 70% opacity and got keyed out.
    expect(cls).not.toMatch(/\bopacity-\d+/);
    // No drop shadows or glows (they are translucent by nature).
    expect(cls).not.toMatch(/\bshadow-\[/);
    const st = styles(html);
    expect(st).not.toMatch(/box-shadow:[^;]*\d/);
    expect(st).not.toMatch(/drop-shadow/);
    expect(st).not.toMatch(/opacity:\s*0\./);
  });

  it('connectors are drawn thick enough to survive scaling and keying', () => {
    const html = renderObs(draftTournament(), 'green');
    const widths = [...html.matchAll(/<path[^>]*stroke-width="([\d.]+)"/g)].map(m => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(3);
  });

  it('the broadcast header pills are solid colors on chroma, not rgba', () => {
    const html = renderObs(draftTournament(), 'green');
    const header = html.slice(html.indexOf('id="bracket-broadcast-header"'), html.indexOf('</div></div>', html.indexOf('id="bracket-broadcast-header"')));
    expect(header).toContain('Draft Preview');
    expect(header).not.toMatch(/rgba\(/);
    expect(header).not.toMatch(/bg-gold\/\d+/);
  });

  it('the header trophy, title, Draft Preview pill and countdown sit on one solid panel, not on the key', () => {
    const tournament = draftTournament();
    tournament.qualsClosed = false;
    const html = renderObs(tournament, 'green');
    const start = html.indexOf('data-testid="broadcast-header-solid-panel"');
    expect(start).toBeGreaterThan(-1);
    const panel = html.slice(start, html.indexOf('Draft Preview', start) + 20);
    expect(panel).toMatch(/style="background:#[0-9a-f]{6}"/i);
    expect(panel).toContain('lucide-trophy');
    // The countdown lives in the header row, not floating over the bracket.
    const headerAt = html.indexOf('id="bracket-broadcast-header"');
    const timerAt = html.indexOf('data-testid="obs-qual-timer-hud"');
    expect(timerAt).toBeGreaterThan(headerAt);
    expect(timerAt).toBeLessThan(html.indexOf('data-testid="champion-subtitle"'));
    expect(html).not.toContain('absolute top-4 right-4');
  });

  it('the champion subtitle (trophy + "Champion") has a solid plate in OBS', () => {
    const html = renderObs(draftTournament(), 'green');
    expect(html).toMatch(/data-testid="champion-subtitle"[^>]*style="[^"]*background:#[0-9a-f]{6}/i);
  });

  it('the 1080p fit view centers the bracket vertically as well as horizontally', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ObsBracketView tournament={draftTournament()} tier={draftTournament().tiers[0]} viewMode="fit" chroma="green" />
      </MemoryRouter>
    );
    expect(html).toMatch(/class="[^"]*items-center[^"]*justify-center[^"]*"/);
  });

  it('a completed match keeps its loser at full opacity in OBS', () => {
    const { tournament, loserName } = lockedWithLoser();
    const html = renderObs(tournament, 'green');
    expect(html).toContain(loserName);
    expect(classes(html)).not.toMatch(/\bopacity-\d+/);
  });
});

describe('Losers are not dimmed in the regular bracket view', () => {
  it('renders the loser without an opacity class and at normal weight', () => {
    const { tournament, loserName } = lockedWithLoser();
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BracketVisualizer tournament={tournament} tier={tournament.tiers[0]} canManage={false} />
      </MemoryRouter>
    );
    const nameSpan = html.match(new RegExp(`<span class="([^"]*)"[^>]*>${loserName}</span>`));
    expect(nameSpan).not.toBeNull();
    expect(nameSpan![1]).not.toMatch(/opacity-/);
    expect(nameSpan![1]).toContain('font-bold');
    expect(html).not.toContain('opacity-45');
  });
});

describe('chroma color helpers', () => {
  it('resolves presets, bare hex and blanks', () => {
    expect(resolveChromaColor('Green')).toBe(CHROMA_KEY_COLORS.green);
    expect(resolveChromaColor('00b140')).toBe('#00b140');
    expect(resolveChromaColor('')).toBeNull();
    expect(resolveChromaColor(null)).toBeNull();
  });

  it('blendOver returns the solid color of a translucent fill', () => {
    expect(blendOver('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(blendOver('#ff0000', '#0000ff', 0)).toBe('#0000ff');
    expect(toOpaqueHex('#11223380')).toBe('#112233');
  });

  it('flags only saturated colors near the key hue', () => {
    expect(clashesWithChroma('#22c55e', CHROMA_KEY_COLORS.green)).toBe(true);
    expect(clashesWithChroma('#ffc905', CHROMA_KEY_COLORS.green)).toBe(false);
    expect(clashesWithChroma('#1b1c1d', CHROMA_KEY_COLORS.green)).toBe(false); // dark card
    expect(clashesWithChroma('#d946ef', CHROMA_KEY_COLORS.magenta)).toBe(true);
  });

  it('recommends a preset no tier clashes with', () => {
    const clashes = getChromaClashes([
      { name: 'Emerald', primaryColor: '#10b981', cardColor: '#0b1410' },
      { name: 'Gold', primaryColor: '#ffc905' },
    ]);
    expect(clashes.green).toEqual(['Emerald']);
    expect(clashes.magenta).toEqual([]);
    expect(recommendChroma(clashes)).toBe('magenta');
  });

  it('the default tier themes are safe on at least one preset', () => {
    const tiers = [1, 2, 3, 4].map(p => createDefaultTier(p));
    expect(recommendChroma(getChromaClashes(tiers))).not.toBeNull();
  });
});
