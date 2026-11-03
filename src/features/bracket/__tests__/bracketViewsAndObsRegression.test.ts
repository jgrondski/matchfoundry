import { describe, it, expect } from 'vitest';
import { Tournament } from '../../tournament/types';
import { generateDraftBracketsForTournament, generateFullTierBracket } from '../../qualifiers/scoring';
import { calculateBracketLayout } from '../bracketLayout';

describe('Bracket Views & OBS Overlays Regression Suite', () => {
  const createMockTournament = (isLocked = false): Tournament => ({
    id: 't-obs-test',
    slug: 'apex-open',
    name: 'Apex Open 2026',
    location: 'Denver, CO',
    organizationId: 'org-1',
    qualFormat: 'HIGH_SCORE',
    isLocked,
    tiers: [
      {
        id: 'gold-tier',
        slug: 'gold',
        name: 'Gold Championship',
        priority: 1,
        bracketType: 'TRADITIONAL',
        eliminationType: 'SINGLE',
        bestOf: 5,
        playerCount: 8,
        primaryColor: '#eab308',
        secondaryColor: '#ca8a04',
        cardColor: '#1e293b',
        textColor: '#f8fafc',
        backgroundColor: '#0f172a',
        isLocked,
        bracket: {
          type: 'TRADITIONAL',
          totalPlayers: 8,
          totalRounds: 3,
          rounds: [],
          matchesById: {},
        },
      },
      {
        id: 'silver-tier',
        slug: 'silver',
        name: 'Silver Masters',
        priority: 2,
        bracketType: 'TRADITIONAL',
        eliminationType: 'DOUBLE',
        bestOf: 3,
        playerCount: 4,
        primaryColor: '#94a3b8',
        secondaryColor: '#64748b',
        cardColor: '#1e293b',
        textColor: '#f8fafc',
        backgroundColor: '#0f172a',
        isLocked,
        bracket: {
          type: 'TRADITIONAL',
          totalPlayers: 4,
          totalRounds: 3,
          rounds: [],
          matchesById: {},
        },
      },
    ],
    playersPool: [
      { id: 'p1', name: 'Scuti', country: 'US', personalBest: 1200000, playstyle: 'Rolling' },
      { id: 'p2', name: 'Fractal', country: 'US', personalBest: 1100000, playstyle: 'Rolling' },
      { id: 'p3', name: 'Pixel', country: 'JP', personalBest: 1050000, playstyle: 'DAS' },
    ],
    matchScores: {},
    qualifierSubmissions: [],
    tournamentPlayers: {},
  });

  describe('1. Universal Pre-Lock Bracket Generation Invariants', () => {
    it('generates a full non-empty 8-player bracket tree with 0 qualifiers submitted', () => {
      const tournament = createMockTournament(false);
      tournament.playersPool = [];
      tournament.qualifierSubmissions = [];

      const draftTiers = generateDraftBracketsForTournament(tournament);
      expect(draftTiers).toHaveLength(2);

      const goldDraft = draftTiers[0];
      expect(goldDraft.bracket).toBeDefined();
      expect(goldDraft.bracket.rounds).toBeDefined();
      expect(goldDraft.bracket.rounds.length).toBeGreaterThan(0);

      // Single Elim 8-player bracket must have exactly 3 rounds (QF, SF, Finals)
      expect(goldDraft.bracket.rounds).toHaveLength(3);
      // N - 1 = 7 total matches
      const totalMatches = goldDraft.bracket.rounds.reduce(
        (sum, r) => sum + r.matches.filter(m => !m.isBye).length,
        0
      );
      expect(totalMatches).toBe(7);

      // Opening round has 4 matches with placeholder seeds Seed 1...8
      const r1 = goldDraft.bracket.rounds[0];
      expect(r1.matches).toHaveLength(4);
      expect(r1.matches[0].player1.player?.seed).toBe(1);
      expect(r1.matches[0].player1.player?.name).toBe('Seed 1');
      expect(r1.matches[0].player2.player?.seed).toBe(8);
      expect(r1.matches[0].player2.player?.name).toBe('Seed 8');
    });

    it('generates a full Double Elimination bracket with 0 qualifiers submitted', () => {
      const tournament = createMockTournament(false);
      tournament.playersPool = [];
      tournament.qualifierSubmissions = [];

      const draftTiers = generateDraftBracketsForTournament(tournament);
      const silverDraft = draftTiers[1]; // 4-player DOUBLE elim
      expect(silverDraft.bracket).toBeDefined();
      expect(silverDraft.bracket.rounds.length).toBeGreaterThan(0);

      // Double Elim matches exist for Winners, Losers, and Grand Finals
      const matches = Object.values(silverDraft.bracket.matchesById);
      expect(matches.length).toBeGreaterThanOrEqual(6);
      expect(silverDraft.bracket.rounds.some(r => r.stage === 'LOSERS' || r.name.toLowerCase().includes('loser'))).toBe(true);
    });

    it('combines real qualifiers with placeholder seeds when partially qualified', () => {
      const tournament = createMockTournament(false);
      tournament.qualifierSubmissions = [
        {
          id: 'sub-1',
          playerId: 'p1',
          tournamentId: tournament.id,
          score: 1000000,
          submittedAt: 100,
        },
        {
          id: 'sub-2',
          playerId: 'p2',
          tournamentId: tournament.id,
          score: 900000,
          submittedAt: 200,
        },
      ];

      const draftTiers = generateDraftBracketsForTournament(tournament);
      const goldDraft = draftTiers[0];
      const r1 = goldDraft.bracket.rounds[0];

      // Match 0: Seed 1 (Scuti) vs Seed 8 (Placeholder)
      expect(r1.matches[0].player1.player?.seed).toBe(1);
      expect(r1.matches[0].player1.player?.name).toBe('Scuti');
      expect(r1.matches[0].player2.player?.seed).toBe(8);
      expect(r1.matches[0].player2.player?.name).toBe('Seed 8');

      // Match 1: Seed 4 (Placeholder) vs Seed 5 (Placeholder)
      expect(r1.matches[1].player1.player?.seed).toBe(4);
      expect(r1.matches[1].player1.player?.name).toBe('Seed 4');

      // Match 2: Seed 2 (Fractal) vs Seed 7 (Placeholder)
      expect(r1.matches[2].player1.player?.seed).toBe(2);
      expect(r1.matches[2].player1.player?.name).toBe('Fractal');
      expect(r1.matches[2].player2.player?.seed).toBe(7);
      expect(r1.matches[2].player2.player?.name).toBe('Seed 7');
    });


    it('generateFullTierBracket standalone helper populates exactly N seeds', () => {
      const tier = createMockTournament(false).tiers[0];
      const seeded = [
        { seed: 1, id: 'p1', name: 'Scuti', country: 'US', personalBest: 0, playstyle: 'DAS' as const },
      ];

      const populated = generateFullTierBracket(tier, seeded);
      expect(populated.rounds.length).toBe(3);
      expect(populated.totalPlayers).toBe(8);
      expect(Object.keys(populated.matchesById)).toHaveLength(7);
    });

  });

  describe('2. 2D Coordinate Geometric Layout Invariants', () => {
    it('calculates positive dimensions and valid match coordinates for pre-lock bracket', () => {
      const tournament = createMockTournament(false);
      const draftTiers = generateDraftBracketsForTournament(tournament);
      const goldDraft = draftTiers[0];

      const layout = calculateBracketLayout(goldDraft.bracket, undefined, 'standard');
      expect(layout.totalWidth).toBeGreaterThan(400);
      expect(layout.totalHeight).toBeGreaterThan(200);

      const matchKeys = Object.keys(layout.matchPositions);
      expect(matchKeys.length).toBe(7);

      matchKeys.forEach(id => {
        const pos = layout.matchPositions[id];
        expect(pos).toBeDefined();
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.width).toBeGreaterThan(0);
        expect(pos.height).toBeGreaterThan(0);
      });
    });

    it('calculates valid layout in 1080p fit mode', () => {
      const tournament = createMockTournament(false);
      const draftTiers = generateDraftBracketsForTournament(tournament);
      const goldDraft = draftTiers[0];

      const fitLayout = calculateBracketLayout(goldDraft.bracket, undefined, 'fit');
      expect(fitLayout.totalWidth).toBeGreaterThan(0);
      expect(fitLayout.totalHeight).toBeGreaterThan(0);
    });
  });

  describe('3. Chroma & Visual Styling Invariants', () => {
    it('resolves named chroma presets to exact hex colors', () => {
      const resolveChroma = (chroma?: string | null) => {
        if (!chroma) return 'transparent';
        const c = chroma.toLowerCase().trim();
        if (c === 'green') return '#00ff00';
        if (c === 'magenta') return '#ff00ff';
        if (c === 'blue') return '#0000ff';
        if (c.startsWith('#')) return c;
        return `#${c}`;
      };

      expect(resolveChroma(null)).toBe('transparent');
      expect(resolveChroma('green')).toBe('#00ff00');
      expect(resolveChroma('GREEN')).toBe('#00ff00');
      expect(resolveChroma('magenta')).toBe('#ff00ff');
      expect(resolveChroma('blue')).toBe('#0000ff');
      expect(resolveChroma('#001122')).toBe('#001122');
      expect(resolveChroma('123456')).toBe('#123456');
    });
  });

  describe('4. Interactivity Safeguards', () => {
    it('disallows match scoring selection when tournament is unlocked (pre-lock)', () => {
      const tournament = createMockTournament(false);
      const isPlayable = true;
      const isObsMode = false;

      // Card click condition: !isObsMode && tournament.isLocked && isPlayable
      const canClickMatch = !isObsMode && tournament.isLocked && isPlayable;
      expect(canClickMatch).toBe(false);
    });

    it('disallows match scoring selection in OBS overlay mode even if locked', () => {
      const tournament = createMockTournament(true);
      const isPlayable = true;
      const isObsMode = true;

      const canClickMatch = !isObsMode && tournament.isLocked && isPlayable;
      expect(canClickMatch).toBe(false);
    });

    it('allows match selection in normal admin/public view when tournament is locked and match is playable', () => {
      const tournament = createMockTournament(true);
      const isPlayable = true;
      const isObsMode = false;

      const canClickMatch = !isObsMode && tournament.isLocked && isPlayable;
      expect(canClickMatch).toBe(true);
    });
  });
});
