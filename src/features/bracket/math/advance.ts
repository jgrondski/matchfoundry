import { BracketMatch, BracketStructure, SeededPlayer, MatchSlotSwapPayload } from '../types';

/**
 * Pure state reducer to advance a match winner through the bracket graph.
 * Returns a new immutable BracketStructure with updated match state and downstream participant slots.
 */
export function advanceMatchWinner(
  bracket: BracketStructure,
  matchId: string,
  winnerId: string
): BracketStructure {
  const targetMatch = bracket.matchesById[matchId];
  if (!targetMatch) {
    throw new Error(`Match with id "${matchId}" not found in bracket.`);
  }

  // Validate that the declared winner is actually playing in this match
  const p1 = targetMatch.player1.player;
  const p2 = targetMatch.player2.player;

  let winnerPlayer: SeededPlayer | null = null;
  let loserId: string | null = null;

  if (p1 && p1.id === winnerId) {
    winnerPlayer = p1;
    loserId = p2 ? p2.id : null;
  } else if (p2 && p2.id === winnerId) {
    winnerPlayer = p2;
    loserId = p1 ? p1.id : null;
  } else {
    throw new Error(
      `Player with id "${winnerId}" is not a participant in match "${matchId}".`
    );
  }

  // Deep clone matches to preserve pure functional immutability
  const updatedMatchesById: Record<string, BracketMatch> = {};
  for (const [id, m] of Object.entries(bracket.matchesById)) {
    updatedMatchesById[id] = {
      ...m,
      player1: { ...m.player1, player: m.player1.player ? { ...m.player1.player } : null },
      player2: { ...m.player2, player: m.player2.player ? { ...m.player2.player } : null },
    };
  }

  // Update target match
  const updatedMatch = updatedMatchesById[matchId];
  updatedMatch.winnerId = winnerId;
  updatedMatch.loserId = loserId;

  // Propagate winner downstream
  const propagateWinner = (m: BracketMatch, winner: SeededPlayer) => {
    if (!m.nextMatchId || !m.nextMatchSlot) {
      return;
    }

    const nextMatch = updatedMatchesById[m.nextMatchId];
    if (!nextMatch) {
      return;
    }

    if (m.nextMatchSlot === 1) {
      nextMatch.player1 = {
        ...nextMatch.player1,
        player: winner,
        sourceMatchId: m.id,
      };
    } else {
      nextMatch.player2 = {
        ...nextMatch.player2,
        player: winner,
        sourceMatchId: m.id,
      };
    }
  };

  propagateWinner(updatedMatch, winnerPlayer);

  // Propagate loser downstream (Double Elimination)
  const loserPlayer = p1 && p1.id === loserId ? p1 : p2 && p2.id === loserId ? p2 : null;
  const propagateLoser = (m: BracketMatch, loser: SeededPlayer | null) => {
    if (!m.loserNextMatchId || !m.loserNextMatchSlot || !loser) {
      return;
    }

    const loserNextMatch = updatedMatchesById[m.loserNextMatchId];
    if (!loserNextMatch) {
      return;
    }

    if (m.loserNextMatchSlot === 1) {
      loserNextMatch.player1 = {
        ...loserNextMatch.player1,
        player: loser,
        sourceMatchId: m.id,
      };
    } else {
      loserNextMatch.player2 = {
        ...loserNextMatch.player2,
        player: loser,
        sourceMatchId: m.id,
      };
    }
  };

  propagateLoser(updatedMatch, loserPlayer);

  // Dynamic Grand Finals Reset handling
  const resetMatchId = `${updatedMatch.tierId ? updatedMatch.tierId + '-' : ''}gf-reset`;
  let grandFinalsResetMatchId: string | undefined = bracket.grandFinalsResetMatchId;

  if (updatedMatch.stage === 'GRAND_FINALS' && updatedMatch.roundIdentifier === 'GF') {
    const wbChamp = updatedMatch.player1.player;
    const lbChamp = updatedMatch.player2.player;

    if (lbChamp && winnerId === lbChamp.id && wbChamp) {
      // Losers Champion won Grand Finals Match 1 -> Instigate Grand Finals Reset Match 2
      const gfResetMatch: BracketMatch = {
        id: resetMatchId,
        tierId: updatedMatch.tierId,
        stage: 'GRAND_FINALS_RESET',
        roundIdentifier: 'GF_RESET',
        roundNumber: updatedMatch.roundNumber,
        matchNumber: (updatedMatch.matchNumber || 0) + 1,
        player1: { player: { ...wbChamp }, sourceMatchId: updatedMatch.id },
        player2: { player: { ...lbChamp }, sourceMatchId: updatedMatch.id },
        winnerId: null,
        loserId: null,
        bestOf: updatedMatch.bestOf,
        isBye: false,
      };

      updatedMatchesById[resetMatchId] = gfResetMatch;
      grandFinalsResetMatchId = resetMatchId;
    } else if (wbChamp && winnerId === wbChamp.id) {
      // Winners Champion won Grand Finals Match 1 -> Tier complete, remove reset match if previously present
      delete updatedMatchesById[resetMatchId];
      grandFinalsResetMatchId = undefined;
    }
  }

  // Rebuild rounds array with new match references
  const updatedRounds = bracket.rounds.map((round) => {
    let matches = round.matches
      .filter((m) => updatedMatchesById[m.id])
      .map((m) => updatedMatchesById[m.id]);

    // If this is the Grand Finals round and a reset match exists, ensure it is included
    if (round.stage === 'GRAND_FINALS' && grandFinalsResetMatchId && updatedMatchesById[grandFinalsResetMatchId]) {
      const resetMatch = updatedMatchesById[grandFinalsResetMatchId];
      if (!matches.some((m) => m.id === grandFinalsResetMatchId)) {
        matches = [...matches, resetMatch];
      }
    }

    return {
      ...round,
      matches,
    };
  });

  return {
    ...bracket,
    grandFinalsResetMatchId,
    rounds: updatedRounds,
    matchesById: updatedMatchesById,
  };
}

/**
 * Pure state reducer to retract a match winner and clear downstream feeder slots.
 * Returns a new immutable BracketStructure with reset match winner state.
 * Resilient to manual placement overrides (clears player by ID if relocated).
 */
export function retractMatchWinner(
  bracket: BracketStructure,
  matchId: string
): BracketStructure {
  const targetMatch = bracket.matchesById[matchId];
  if (!targetMatch) {
    return bracket;
  }

  const retractedWinnerId = targetMatch.winnerId;
  const retractedLoserId = targetMatch.loserId;

  // Deep clone matches to preserve pure functional immutability
  const updatedMatchesById: Record<string, BracketMatch> = {};
  for (const [id, m] of Object.entries(bracket.matchesById)) {
    updatedMatchesById[id] = {
      ...m,
      player1: { ...m.player1, player: m.player1.player ? { ...m.player1.player } : null },
      player2: { ...m.player2, player: m.player2.player ? { ...m.player2.player } : null },
    };
  }

  // Clear target match winner and loser
  const updatedMatch = updatedMatchesById[matchId];
  updatedMatch.winnerId = null;
  updatedMatch.loserId = null;

  // A swap (swapMatchSlots) only moves a competitor within one round and stage, so a relocated
  // winner or loser can only be in the same round as the match they were fed into. Searching
  // wider would also match the retracted match itself and the competitor's earlier matches,
  // and blank their slots there.
  const isInRoundOf = (candidate: BracketMatch, targetId: string | null | undefined): boolean => {
    const target = targetId ? updatedMatchesById[targetId] : undefined;
    if (!target) return false;
    return (
      candidate.roundNumber === target.roundNumber &&
      (candidate.stage || 'WINNERS') === (target.stage || 'WINNERS')
    );
  };

  // Clear downstream slot and cascade if downstream match had also declared a winner
  const clearDownstream = (m: BracketMatch, winnerIdToClear: string | null, loserIdToClear: string | null) => {
    // 1. Clear winner propagation (both default nextMatchId and any relocated slot)
    const matchesToCheckForWinner = new Set<string>();
    if (m.nextMatchId) matchesToCheckForWinner.add(m.nextMatchId);

    // If winner was swapped/moved, also check the other matches in the target round
    for (const candidate of Object.values(updatedMatchesById)) {
      if (candidate.id === m.id) continue;
      if (
        candidate.player1.sourceMatchId === m.id ||
        candidate.player2.sourceMatchId === m.id ||
        (winnerIdToClear &&
          isInRoundOf(candidate, m.nextMatchId) &&
          (candidate.player1.player?.id === winnerIdToClear || candidate.player2.player?.id === winnerIdToClear))
      ) {
        matchesToCheckForWinner.add(candidate.id);
      }
    }

    for (const nMatchId of matchesToCheckForWinner) {
      const nextMatch = updatedMatchesById[nMatchId];
      if (!nextMatch) continue;

      let clearedPlayer = false;
      if (
        (m.nextMatchSlot === 1 && nextMatch.player1.sourceMatchId === m.id) ||
        (winnerIdToClear && nextMatch.player1.player?.id === winnerIdToClear) ||
        nextMatch.player1.sourceMatchId === m.id
      ) {
        if (nextMatch.player1.player !== null) {
          nextMatch.player1 = { player: null };
          clearedPlayer = true;
        }
      }
      if (
        (m.nextMatchSlot === 2 && nextMatch.player2.sourceMatchId === m.id) ||
        (winnerIdToClear && nextMatch.player2.player?.id === winnerIdToClear) ||
        nextMatch.player2.sourceMatchId === m.id
      ) {
        if (nextMatch.player2.player !== null) {
          nextMatch.player2 = { player: null };
          clearedPlayer = true;
        }
      }

      if (clearedPlayer && (nextMatch.winnerId || nextMatch.loserId)) {
        const nextWinnerId = nextMatch.winnerId;
        const nextLoserId = nextMatch.loserId;
        nextMatch.winnerId = null;
        nextMatch.loserId = null;
        clearDownstream(nextMatch, nextWinnerId, nextLoserId);
      }
    }

    // 2. Clear loser propagation (Double Elimination)
    const matchesToCheckForLoser = new Set<string>();
    if (m.loserNextMatchId) matchesToCheckForLoser.add(m.loserNextMatchId);

    for (const candidate of Object.values(updatedMatchesById)) {
      if (candidate.id === m.id) continue;
      if (
        candidate.player1.sourceMatchId === m.id ||
        candidate.player2.sourceMatchId === m.id ||
        (loserIdToClear &&
          isInRoundOf(candidate, m.loserNextMatchId) &&
          (candidate.player1.player?.id === loserIdToClear || candidate.player2.player?.id === loserIdToClear))
      ) {
        matchesToCheckForLoser.add(candidate.id);
      }
    }

    for (const lMatchId of matchesToCheckForLoser) {
      const loserNextMatch = updatedMatchesById[lMatchId];
      if (!loserNextMatch) continue;

      let clearedPlayer = false;
      if (
        (m.loserNextMatchSlot === 1 && loserNextMatch.player1.sourceMatchId === m.id) ||
        (loserIdToClear && loserNextMatch.player1.player?.id === loserIdToClear) ||
        loserNextMatch.player1.sourceMatchId === m.id
      ) {
        if (loserNextMatch.player1.player !== null) {
          loserNextMatch.player1 = { player: null };
          clearedPlayer = true;
        }
      }
      if (
        (m.loserNextMatchSlot === 2 && loserNextMatch.player2.sourceMatchId === m.id) ||
        (loserIdToClear && loserNextMatch.player2.player?.id === loserIdToClear) ||
        loserNextMatch.player2.sourceMatchId === m.id
      ) {
        if (loserNextMatch.player2.player !== null) {
          loserNextMatch.player2 = { player: null };
          clearedPlayer = true;
        }
      }

      if (clearedPlayer && (loserNextMatch.winnerId || loserNextMatch.loserId)) {
        const downstreamWinnerId = loserNextMatch.winnerId;
        const downstreamLoserId = loserNextMatch.loserId;
        loserNextMatch.winnerId = null;
        loserNextMatch.loserId = null;
        clearDownstream(loserNextMatch, downstreamWinnerId, downstreamLoserId);
      }
    }
  };

  clearDownstream(updatedMatch, retractedWinnerId, retractedLoserId);

  // If retracting Grand Finals Match 1, remove any dynamically generated Reset match
  let grandFinalsResetMatchId = bracket.grandFinalsResetMatchId;
  const resetMatchId = `${updatedMatch.tierId ? updatedMatch.tierId + '-' : ''}gf-reset`;
  if (updatedMatch.stage === 'GRAND_FINALS' && updatedMatch.roundIdentifier === 'GF') {
    delete updatedMatchesById[resetMatchId];
    grandFinalsResetMatchId = undefined;
  }

  // Rebuild rounds array with new match references
  const updatedRounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches
      .filter((m) => updatedMatchesById[m.id])
      .map((m) => updatedMatchesById[m.id]),
  }));

  return {
    ...bracket,
    grandFinalsResetMatchId,
    rounds: updatedRounds,
    matchesById: updatedMatchesById,
  };
}

/**
 * Pure state reducer to manually swap or reassign participant slots between matches within the same round.
 * Used by tournament organizers and floor judges to override bracket placement when unexpected real-world situations arise.
 */
export function swapMatchSlots(
  bracket: BracketStructure,
  payload: MatchSlotSwapPayload
): BracketStructure {
  const { sourceMatchId, sourceSlot, targetMatchId, targetSlot } = payload;
  const sourceMatch = bracket.matchesById[sourceMatchId];
  const targetMatch = bracket.matchesById[targetMatchId];

  if (!sourceMatch) {
    throw new Error(`Source match with id "${sourceMatchId}" not found in bracket.`);
  }
  if (!targetMatch) {
    throw new Error(`Target match with id "${targetMatchId}" not found in bracket.`);
  }

  // Safety Invariants:
  // 1. Must be in the exact same round
  if (sourceMatch.roundNumber !== targetMatch.roundNumber) {
    throw new Error(
      `Cannot swap match slots across different rounds: Source round ${sourceMatch.roundNumber} vs Target round ${targetMatch.roundNumber}.`
    );
  }

  // 2. Must be in the same stage (e.g. Winners vs Winners, Losers vs Losers)
  const sourceStage = sourceMatch.stage || 'WINNERS';
  const targetStage = targetMatch.stage || 'WINNERS';
  if (sourceStage !== targetStage) {
    throw new Error(
      `Cannot swap match slots across different bracket stages: ${sourceStage} vs ${targetStage}.`
    );
  }

  // Deep clone matches to preserve pure functional immutability
  const updatedMatchesById: Record<string, BracketMatch> = {};
  for (const [id, m] of Object.entries(bracket.matchesById)) {
    updatedMatchesById[id] = {
      ...m,
      player1: { ...m.player1, player: m.player1.player ? { ...m.player1.player } : null },
      player2: { ...m.player2, player: m.player2.player ? { ...m.player2.player } : null },
    };
  }

  const clonedSource = updatedMatchesById[sourceMatchId];
  const clonedTarget = updatedMatchesById[targetMatchId];

  const srcParticipant = sourceSlot === 1 ? clonedSource.player1 : clonedSource.player2;
  const tgtParticipant = targetSlot === 1 ? clonedTarget.player1 : clonedTarget.player2;

  const tempSrc = { ...srcParticipant };
  const tempTgt = { ...tgtParticipant };

  const srcHasPlayer = tempSrc.player !== null;
  const tgtHasPlayer = tempTgt.player !== null;

  // Swap into source slot
  if (sourceSlot === 1) {
    clonedSource.player1 = {
      ...tempTgt,
      isManualOverride: tgtHasPlayer ? true : undefined,
      originalSourceMatchId: tempTgt.originalSourceMatchId || tempTgt.sourceMatchId,
    };
  } else {
    clonedSource.player2 = {
      ...tempTgt,
      isManualOverride: tgtHasPlayer ? true : undefined,
      originalSourceMatchId: tempTgt.originalSourceMatchId || tempTgt.sourceMatchId,
    };
  }

  // Swap into target slot
  if (targetSlot === 1) {
    clonedTarget.player1 = {
      ...tempSrc,
      isManualOverride: srcHasPlayer ? true : undefined,
      originalSourceMatchId: tempSrc.originalSourceMatchId || tempSrc.sourceMatchId,
    };
  } else {
    clonedTarget.player2 = {
      ...tempSrc,
      isManualOverride: srcHasPlayer ? true : undefined,
      originalSourceMatchId: tempSrc.originalSourceMatchId || tempSrc.sourceMatchId,
    };
  }

  // Rebuild rounds array with new match references
  const updatedRounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches
      .filter((m) => updatedMatchesById[m.id])
      .map((m) => updatedMatchesById[m.id]),
  }));

  return {
    ...bracket,
    rounds: updatedRounds,
    matchesById: updatedMatchesById,
  };
}


