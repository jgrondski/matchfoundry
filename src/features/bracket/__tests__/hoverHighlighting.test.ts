import { describe, it, expect } from 'vitest';
import {
  getHighlightedPlayerNameColor,
  findPlayerJourney,
  getMatchBranchColor,
  getCardHoverHighlight,
} from '../components/BracketVisualizer';
import { generateTraditionalDoubleElim } from '../math/double-elimination';
import { SeededPlayer } from '../types';

describe('Bracket Hover Highlighting & Visual Distinction', () => {
  const primaryColor = '#eab308';
  const secondaryColor = '#705b33';
  const textColor = '#ffffff';

  describe('getHighlightedPlayerNameColor', () => {
    it('always assigns primaryColor to the target player in question during hover highlight, regardless of match state', () => {
      // 1. Target player won
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: true,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: true,
          isWinner: true,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(primaryColor);

      // 2. Target player lost (opponent won) -> still primaryColor for target player!
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: true,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: true,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(primaryColor);

      // 3. Uncompleted match (not played yet) -> primaryColor for target player!
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: true,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: false,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(primaryColor);

      // 4. In-progress match where target player is trailing -> primaryColor for target player!
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: true,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: false,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(primaryColor);

      // 5. Target player text hovered directly -> stays primaryColor (not overwritten by hover)
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: true,
          isOpponentSlot: false,
          isHoveredText: true,
          isComplete: false,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(primaryColor);
    });

    it('always assigns secondaryColor to the opponent in question during hover highlight, regardless of match state', () => {
      // 1. Opponent won the match -> secondaryColor (visually distinct from target player)
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: false,
          isOpponentSlot: true,
          isHoveredText: false,
          isComplete: true,
          isWinner: true,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(secondaryColor);

      // 2. Opponent lost the match -> secondaryColor
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: false,
          isOpponentSlot: true,
          isHoveredText: false,
          isComplete: true,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(secondaryColor);

      // 3. Match uncompleted -> secondaryColor
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: false,
          isOpponentSlot: true,
          isHoveredText: false,
          isComplete: false,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(secondaryColor);

      // 4. Opponent text hovered -> secondaryColor
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: true,
          isTargetSlot: false,
          isOpponentSlot: true,
          isHoveredText: true,
          isComplete: false,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(secondaryColor);
    });

    it('falls back to standard coloring when highlight is inactive (no hover)', () => {
      // Winner is primaryColor
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: false,
          isTargetSlot: false,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: true,
          isWinner: true,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(primaryColor);

      // Loser is textColor
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: false,
          isTargetSlot: false,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: true,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(textColor);

      // In-progress leading is primaryColor
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: false,
          isTargetSlot: false,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: false,
          isWinner: false,
          isLeading: true,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(primaryColor);

      // Uncompleted is textColor
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: false,
          isTargetSlot: false,
          isOpponentSlot: false,
          isHoveredText: false,
          isComplete: false,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(textColor);

      // Hovered player text does NOT blip to secondaryColor when highlight is inactive
      expect(
        getHighlightedPlayerNameColor({
          isHighlightActive: false,
          isTargetSlot: false,
          isOpponentSlot: false,
          isHoveredText: true,
          isComplete: false,
          isWinner: false,
          isLeading: false,
          primaryColor,
          secondaryColor,
          textColor,
        })
      ).toBe(textColor);
    });
  });

  describe('findPlayerJourney', () => {
    const players: SeededPlayer[] = [
      { id: 'p1', name: 'Alice', seed: 1 },
      { id: 'p2', name: 'Bob', seed: 2 },
      { id: 'p3', name: 'Charlie', seed: 3 },
      { id: 'p4', name: 'Diana', seed: 4 },
    ];

    it('returns targetPlayerId and matches in journey', () => {
      const bracket = generateTraditionalDoubleElim(players, { tierId: 'gold' });
      const journey = findPlayerJourney('p1', null, null, bracket, {}, null);

      expect(journey.targetPlayerId).toBe('p1');
      expect(journey.matchIds.size).toBeGreaterThan(0);
      expect(journey.slotKeys.size).toBeGreaterThan(0);
      // Alice is in slot 1 of match 1
      const initialMatch = Object.values(bracket.matchesById).find(
        (m) => m.player1?.player?.id === 'p1' || m.player2?.player?.id === 'p1'
      );
      expect(initialMatch).toBeDefined();
      expect(journey.matchIds.has(initialMatch!.id)).toBe(true);
      expect(journey.slotKeys.has(`${initialMatch!.id}-1`)).toBe(true);
      expect(journey.slotKeys.has(`${initialMatch!.id}-2`)).toBe(false);
    });
  });

  describe('getMatchBranchColor & Lower Bracket Color Configuration', () => {
    it('uses custom lowerBracketColor for lower bracket / Pod 3 matches', () => {
      const customLBColor = '#ff6600';
      const mockLBMatch: any = {
        id: 'pod3-m1',
        subTrack: 'PRE_MERGE_LOWER',
        roundIdentifier: 'PRE_L1',
      };
      expect(getMatchBranchColor(mockLBMatch, customLBColor)).toBe(customLBColor);
    });

    it('falls back to default palette border when lowerBracketColor is not provided', () => {
      const mockLBMatch: any = {
        id: 'pod3-m1',
        subTrack: 'PRE_MERGE_LOWER',
        roundIdentifier: 'PRE_L1',
      };
      expect(getMatchBranchColor(mockLBMatch)).toBe('#c2410c'); // LB.border default
    });

    it('returns null for championship / grand finals matches so they use neutral/tier theme', () => {
      const mockGfMatch: any = {
        id: 'gf-1',
        phase: 'CHAMPIONSHIP',
        stage: 'GRAND_FINALS',
      };
      expect(getMatchBranchColor(mockGfMatch, '#ff6600')).toBeNull();
    });
  });

  describe('Bracket Player Search Resolution & Journey Highlight', () => {
    const players = [
      { id: 'p1', name: 'Fractal' },
      { id: 'p2', name: 'Alex T' },
      { id: 'p3', name: 'Alex' },
      { id: 'p4', name: 'Blue Scuti' },
    ];

    function resolvePlayerSearch(query: string, candidateList: typeof players) {
      const q = query.trim().toLowerCase();
      if (!q) return null;
      const matches = candidateList.filter(p => p.name.toLowerCase().includes(q));
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        const exact = matches.find(p => p.name.toLowerCase() === q);
        if (exact) return exact;
      }
      return null;
    }

    it('returns null when query is empty or whitespace only', () => {
      expect(resolvePlayerSearch('', players)).toBeNull();
      expect(resolvePlayerSearch('   ', players)).toBeNull();
    });

    it('returns null when query matches multiple players without an exact match', () => {
      // "al" matches Fractal, Alex T, Alex
      expect(resolvePlayerSearch('al', players)).toBeNull();
    });

    it('resolves to the single matching player when unique substring matches', () => {
      // "frac" uniquely matches Fractal
      expect(resolvePlayerSearch('frac', players)?.id).toBe('p1');
      // "scuti" uniquely matches Blue Scuti
      expect(resolvePlayerSearch('scuti', players)?.id).toBe('p4');
    });

    it('resolves to exact match when multiple players share a prefix', () => {
      // "alex" matches both "Alex T" and "Alex", but "Alex" is an exact match
      expect(resolvePlayerSearch('alex', players)?.id).toBe('p3');
    });

    it('clears to null (normal view) when search is cleared', () => {
      let currentQuery = 'fractal';
      expect(resolvePlayerSearch(currentQuery, players)?.id).toBe('p1');

      currentQuery = '';
      expect(resolvePlayerSearch(currentQuery, players)).toBeNull();
    });

    it('produces active journey matchIds and slotKeys when player resolves', () => {
      const seeded: SeededPlayer[] = [
        { id: 'p1', name: 'Fractal', seed: 1 },
        { id: 'p2', name: 'Alex', seed: 2 },
        { id: 'p3', name: 'Blue Scuti', seed: 3 },
        { id: 'p4', name: 'Tristop', seed: 4 },
      ];
      const doubleElimBracket = generateTraditionalDoubleElim(seeded, { tierId: 'gold' });

      const resolved = resolvePlayerSearch('fractal', [{ id: 'p1', name: 'Fractal' }]);
      expect(resolved).not.toBeNull();

      const journey = findPlayerJourney(resolved?.id, null, null, doubleElimBracket, {});
      expect(journey.matchIds.size).toBeGreaterThan(0);
      expect(journey.slotKeys.size).toBeGreaterThan(0);
      expect(journey.targetPlayerId).toBe('p1');
    });
  });

  describe('getCardHoverHighlight (routing chip target vs slot ancestry)', () => {
    it('keeps the chip target lit and undimmed after the slot ancestry highlight kicks in', () => {
      // Regression: the drop chip lives inside a player slot, so 200ms after hovering it the slot's
      // ancestry highlight activated, dimmed the target card to opacity-35 and removed its outline.
      expect(
        getCardHoverHighlight({ hasAncestry: true, isCardInAncestry: false, isOriginHovered: true })
      ).toEqual({ isDimmed: false, showOriginHighlight: true });
    });

    it('lights the chip target before any ancestry exists', () => {
      expect(
        getCardHoverHighlight({ hasAncestry: false, isCardInAncestry: false, isOriginHovered: true })
      ).toEqual({ isDimmed: false, showOriginHighlight: true });
    });

    it('still dims unrelated cards outside the ancestry', () => {
      expect(
        getCardHoverHighlight({ hasAncestry: true, isCardInAncestry: false, isOriginHovered: false })
      ).toEqual({ isDimmed: true, showOriginHighlight: false });
    });

    it('never dims cards inside the ancestry', () => {
      expect(
        getCardHoverHighlight({ hasAncestry: true, isCardInAncestry: true, isOriginHovered: false })
      ).toEqual({ isDimmed: false, showOriginHighlight: false });
    });
  });
});
