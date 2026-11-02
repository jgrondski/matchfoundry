import { BracketStructure } from './types';

export function findPlayerJourney(
  targetPlayerId: string | null | undefined,
  startMatchId: string | null,
  startSlotNum: 1 | 2 | null,
  bracket: BracketStructure,
  scores: Record<string, { winnerPlayerId?: string | null; isComplete?: boolean }>,
  championPlayerId?: string | null
): {
  matchIds: Set<string>;
  slotKeys: Set<string>;
  isChampion: boolean;
  targetPlayerId?: string | null;
} {
  const matchIds = new Set<string>();
  const slotKeys = new Set<string>();

  if (targetPlayerId) {
    // 1. Identify all matches where this player is scheduled or played
    for (const m of Object.values(bracket.matchesById)) {
      if (m.player1?.player?.id === targetPlayerId) {
        matchIds.add(m.id);
        slotKeys.add(`${m.id}-1`);
      }
      if (m.player2?.player?.id === targetPlayerId) {
        matchIds.add(m.id);
        slotKeys.add(`${m.id}-2`);
      }
    }

    // 2. Also trace forward if player won or dropped to a future slot where player object isn't set yet
    let changed = true;
    while (changed) {
      changed = false;
      for (const mId of Array.from(matchIds)) {
        const m = bracket.matchesById[mId];
        if (!m) continue;
        const record = scores[m.id];
        const winnerId = m.winnerId || record?.winnerPlayerId;
        if (winnerId === targetPlayerId) {
          if (m.nextMatchId && bracket.matchesById[m.nextMatchId]) {
            const nextSlot = m.nextMatchSlot || 1;
            if (!matchIds.has(m.nextMatchId) || !slotKeys.has(`${m.nextMatchId}-${nextSlot}`)) {
              matchIds.add(m.nextMatchId);
              slotKeys.add(`${m.nextMatchId}-${nextSlot}`);
              changed = true;
            }
          }
        } else if (winnerId && m.loserNextMatchId && bracket.matchesById[m.loserNextMatchId]) {
          const isLoser =
            (m.player1?.player?.id === targetPlayerId && winnerId !== targetPlayerId) ||
            (m.player2?.player?.id === targetPlayerId && winnerId !== targetPlayerId);
          if (isLoser) {
            const loserSlot = m.loserNextMatchSlot || 2;
            if (!matchIds.has(m.loserNextMatchId) || !slotKeys.has(`${m.loserNextMatchId}-${loserSlot}`)) {
              matchIds.add(m.loserNextMatchId);
              slotKeys.add(`${m.loserNextMatchId}-${loserSlot}`);
              changed = true;
            }
          }
        }
      }
    }

    const isChampion = Boolean(championPlayerId && championPlayerId === targetPlayerId);
    return { matchIds, slotKeys, isChampion, targetPlayerId };
  }

  // Fallback for unassigned placeholder slots: traverse ancestry backwards and descendants forwards
  if (startMatchId && startSlotNum) {
    slotKeys.add(`${startMatchId}-${startSlotNum}`);
    matchIds.add(startMatchId);

    const queue: Array<{ matchId: string; slotNum: 1 | 2 }> = [{ matchId: startMatchId, slotNum: startSlotNum }];
    const visited = new Set<string>([`${startMatchId}-${startSlotNum}`]);

    while (queue.length > 0) {
      const { matchId, slotNum } = queue.shift()!;
      const curMatch = bracket.matchesById[matchId];
      if (!curMatch) continue;

      const curParticipant = slotNum === 1 ? curMatch.player1 : curMatch.player2;
      const curFeeder = slotNum === 1 ? curMatch.slotA : curMatch.slotB;
      const sourceMatchId = curFeeder?.matchId || curParticipant?.sourceMatchId;

      if (sourceMatchId && bracket.matchesById[sourceMatchId]) {
        const parentMatch = bracket.matchesById[sourceMatchId];
        matchIds.add(parentMatch.id);

        for (const sNum of [1, 2] as const) {
          const key = `${parentMatch.id}-${sNum}`;
          if (!visited.has(key)) {
            visited.add(key);
            slotKeys.add(key);
            queue.push({ matchId: parentMatch.id, slotNum: sNum });
          }
        }
      }
    }
  }

  return { matchIds, slotKeys, isChampion: false, targetPlayerId: null };
}

export const findAncestors = (
  startMatchId: string,
  startSlotNum: 1 | 2,
  bracket: BracketStructure,
  scores: Record<string, { winnerPlayerId?: string | null; isComplete?: boolean }>,
  championPlayerId?: string | null
) => {
  const match = bracket.matchesById[startMatchId];
  const participant = startSlotNum === 1 ? match?.player1 : match?.player2;
  return findPlayerJourney(participant?.player?.id, startMatchId, startSlotNum, bracket, scores, championPlayerId);
};

export function getHighlightedPlayerNameColor({
  isHighlightActive,
  isTargetSlot,
  isOpponentSlot,
  isHoveredText: _isHoveredText,
  isComplete,
  isWinner,
  isLeading,
  primaryColor,
  secondaryColor,
  textColor,
}: {
  isHighlightActive: boolean;
  isTargetSlot: boolean;
  isOpponentSlot: boolean;
  isHoveredText?: boolean;
  isComplete: boolean;
  isWinner: boolean;
  isLeading: boolean;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
}): string {
  if (isHighlightActive) {
    if (isTargetSlot && !isOpponentSlot) return primaryColor;
    if (isOpponentSlot && !isTargetSlot) return secondaryColor;
  }
  return (isComplete && isWinner) || isLeading
    ? primaryColor
    : textColor;
}

/**
 * How a match card reacts to the two hover highlights.
 *
 * Hovering a routing chip ("Loser #5") lights up the match it points to (the origin target). The chip
 * sits inside a player slot, so the slot's ancestry highlight also kicks in after its hover delay and
 * dims every card outside that ancestry. The origin target must stay lit and undimmed regardless.
 */
export function getCardHoverHighlight({
  hasAncestry,
  isCardInAncestry,
  isOriginHovered,
}: {
  hasAncestry: boolean;
  isCardInAncestry: boolean;
  isOriginHovered: boolean;
}): { isDimmed: boolean; showOriginHighlight: boolean } {
  return {
    isDimmed: hasAncestry && !isCardInAncestry && !isOriginHovered,
    showOriginHighlight: isOriginHovered,
  };
}
