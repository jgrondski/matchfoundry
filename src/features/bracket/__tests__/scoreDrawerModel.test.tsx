import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  draftsFromRecord,
  draftsToPayload,
  finishSummary,
  normalizeDrafts,
  reopenSummary,
  waitingOn,
  type GameDraft,
} from '../components/drawer/drawerModel';
import { GameScoreCard } from '../components/drawer/GameScoreCard';
import { MatchupBanner } from '../components/drawer/MatchupBanner';
import { generateTraditionalBracket } from '../math/traditional';
import { generateTraditionalDoubleElim } from '../math/double-elimination';
import { advanceMatchWinner } from '../math/advance';
import type { MatchScoreRecord } from '../../tournament/types';

const A = 'a';
const B = 'b';
const d = (p1: string, p2: string, winner: string | null = null): GameDraft => ({ p1, p2, winner });
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, seed: i + 1 }));

describe('normalizeDrafts', () => {
  it('shows a single empty row for a fresh match', () => {
    expect(normalizeDrafts([], 3, A, B)).toEqual([d('', '')]);
  });

  it('adds the next row once a game is finished and none after the series is decided', () => {
    expect(normalizeDrafts([d('900', '100')], 3, A, B)).toHaveLength(2);
    expect(normalizeDrafts([d('900', '100'), d('900', '100'), d('', '')], 3, A, B)).toHaveLength(2);
  });

  it('removes a trailing empty row when the game before it is cleared', () => {
    expect(normalizeDrafts([d('900', ''), d('', '')], 3, A, B)).toEqual([d('900', '')]);
  });
});

describe('draftsFromRecord', () => {
  const record = (games: MatchScoreRecord['games']): MatchScoreRecord => ({
    matchId: 'm',
    tierId: 't',
    bestOf: 3,
    player1Wins: 0,
    player2Wins: 0,
    games,
    winnerPlayerId: null,
    loserPlayerId: null,
    isComplete: false,
  });

  it('keeps a hand-picked winner only for a game without both scores', () => {
    const drafts = draftsFromRecord(
      record([
        { gameNumber: 1, player1Points: 900, player2Points: 100, winnerPlayerId: A },
        { gameNumber: 2, player1Points: null, player2Points: null, winnerPlayerId: B },
      ]),
      3,
      A,
      B
    );
    expect(drafts.slice(0, 2)).toEqual([d('900', '100'), d('', '', B)]);
    expect(drafts).toHaveLength(3);
  });
});

describe('draftsToPayload', () => {
  it('derives each winner from the scores and drops trailing empty rows', () => {
    expect(draftsToPayload([d('900', '100'), d('665', '665'), d('', '')], A, B)).toEqual([
      { gameNumber: 1, player1Points: 900, player2Points: 100, winnerPlayerId: A },
      { gameNumber: 2, player1Points: 665, player2Points: 665, winnerPlayerId: 'TIE' },
    ]);
  });
});

describe('prompt wording', () => {
  it('says who wins, the score and where they go', () => {
    const bracket = generateTraditionalBracket(players(8), { tierId: 't' });
    const m = Object.values(bracket.matchesById).find(x => x.roundNumber === 1)!;
    const next = bracket.matchesById[m.nextMatchId!];
    const lines = finishSummary(bracket, m, [d('900', '100'), d('100', '900'), d('900', '100')], 3);
    expect(lines).toEqual([`${m.player1.player!.name} wins 2–1 and advances to Match ${next.matchNumber}.`]);
  });

  it('mentions the losers-bracket drop in double elimination', () => {
    const bracket = generateTraditionalDoubleElim(players(8), { tierId: 't' });
    const m = Object.values(bracket.matchesById).find(x => x.roundIdentifier === 'W1')!;
    const lines = finishSummary(bracket, m, [d('900', '100'), d('900', '100')], 3);
    expect(lines[1]).toBe(`${m.player2.player!.name} drops to Match ${bracket.matchesById[m.loserNextMatchId!].matchNumber}.`);
  });

  it('lists who a reopen pulls back out', () => {
    let bracket = generateTraditionalBracket(players(8), { tierId: 't' });
    const m = Object.values(bracket.matchesById).find(x => x.roundNumber === 1)!;
    bracket = advanceMatchWinner(bracket, m.id, m.player1.player!.id);
    const lines = reopenSummary(bracket, bracket.matchesById[m.id]);
    expect(lines[0]).toBe(`Removes ${m.player1.player!.name} from Match ${bracket.matchesById[m.nextMatchId!].matchNumber}.`);
  });

  it('names the matches a waiting match depends on', () => {
    const bracket = generateTraditionalBracket(players(8), { tierId: 't' });
    const r2 = Object.values(bracket.matchesById).find(x => x.roundNumber === 2)!;
    const feeders = [r2.player1.sourceMatchId!, r2.player2.sourceMatchId!].map(id => bracket.matchesById[id].matchNumber);
    expect(waitingOn(bracket, r2)).toBe(`Waiting on Match ${feeders[0]} and Match ${feeders[1]}.`);
  });
});

describe('GameScoreCard rendering', () => {
  const p1 = { id: A, name: 'Alpha', seed: 1 };
  const p2 = { id: B, name: 'Bravo', seed: 2 };
  const render = (game: GameDraft, readOnly = false) =>
    renderToStaticMarkup(
      <GameScoreCard
        game={game}
        idx={0}
        bestOf={3}
        p1={p1}
        p2={p2}
        p1Name="Alpha"
        p2Name="Bravo"
        primaryColor="#ffcc00"
        gameCardBg="#111111"
        readOnly={readOnly}
        onScoreChange={vi.fn()}
        onManualWinnerToggle={vi.fn()}
      />
    );

  it('shows scores with commas', () => {
    expect(render(d('1234567', ''))).toContain('value="1,234,567"');
  });

  it('offers a hand-picked winner only while a score is missing', () => {
    expect(render(d('', ''))).toContain('Alpha won Game 1');
    expect(render(d('900', '100'))).not.toContain('Alpha won Game 1');
  });

  it('has no manual tie or delete buttons', () => {
    const html = render(d('665', '665'));
    expect(html).toContain('TIE (NO WIN)');
    expect(html).not.toContain('Declare Tie');
    expect(html).not.toContain('Delete');
  });

  it('renders no inputs when read-only', () => {
    expect(render(d('900', '100'), true)).not.toContain('<input');
  });
});

describe('MatchupBanner best-of', () => {
  const render = (bestOfOptions: number[] | null) =>
    renderToStaticMarkup(
      <MatchupBanner
        p1Name="Alpha"
        p2Name="Bravo"
        p1Wins={0}
        p2Wins={0}
        winThreshold={2}
        bestOf={3}
        primaryColor="#ffcc00"
        bestOfOptions={bestOfOptions}
        onBestOfChange={vi.fn()}
      />
    );

  it('offers only the allowed formats before any game is scored', () => {
    const html = render([1, 3, 5, 7]);
    expect(html).toContain('data-testid="best-of-select"');
    expect(html).toContain('Bo7');
    expect(html).not.toContain('Bo99');
  });

  it('shows a locked label once a game is scored', () => {
    const html = render(null);
    expect(html).toContain('data-testid="best-of-locked"');
    expect(html).not.toContain('<select');
  });
});
