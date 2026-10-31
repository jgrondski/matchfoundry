import { BracketStructure, BracketMatch } from './types';
import { cn } from '../../components/ui';
import {
  ACCELERATED_HYBRID_POD_PALETTE,
  DEFAULT_TIER_THEME,
  LOWER_BRACKET_CHIP_TEXT,
  LOWER_BRACKET_COLOR,
  THEME_FALLBACK,
} from '../../theme/palette';

export interface MicroChipData {
  text: string;
  tooltip: string;
  bg: string;
  color: string;
  border?: string;
  glow?: string;
  opacity?: number;
  sourceMatchId?: string;
  targetMatchId?: string;
}

export { ACCELERATED_HYBRID_POD_PALETTE };

export function getMatchBranchColor(match: BracketMatch, lowerBracketColor?: string): string | null {
  // Top 16 Championship: Neutral / Default tier theme (remove any pod-specific accent colors)
  if (
    match.phase === 'CHAMPIONSHIP' ||
    match.stage === 'GRAND_FINALS' ||
    match.roundIdentifier?.startsWith('CHAMP')
  ) {
    return null;
  }
  if (match.subTrack === 'ACCELERATED' || match.roundIdentifier === 'AR') {
    return ACCELERATED_HYBRID_POD_PALETTE.AR.border;
  }
  if (match.subTrack === 'PRE_MERGE_UPPER' || match.roundIdentifier?.startsWith('PRE_W')) {
    return ACCELERATED_HYBRID_POD_PALETTE.UB.border;
  }
  if (
    match.subTrack === 'PRE_MERGE_LOWER' ||
    match.subTrack === 'RE_CLIMB' ||
    match.roundIdentifier === 'PRE_L1' ||
    match.roundIdentifier === 'PRE_L2' ||
    match.roundIdentifier === '2C' ||
    match.roundIdentifier === 'PO'
  ) {
    return lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;
  }
  return null;
}

export const getInboundChip = (
  slotNum: 1 | 2,
  match: BracketMatch,
  bracket: BracketStructure,
  mIdx: number,
  isPhase2OpeningRound: boolean,
  primaryColor = DEFAULT_TIER_THEME.primaryColor,
  lowerBracketColor = LOWER_BRACKET_COLOR
): MicroChipData | null => {
  // Finals Rule: Suppress all incoming and outgoing routing chips for Grand Finals,
  // Grand Finals Reset, and Finals (connecting lines already represent these paths).
  const isChampOpening = Boolean(isPhase2OpeningRound || match.roundIdentifier === 'CHAMP_R1');
  if (
    !isChampOpening &&
    (match.stage === 'GRAND_FINALS' ||
      match.stage === 'GRAND_FINALS_RESET' ||
      match.roundIdentifier === 'GF' ||
      match.roundIdentifier === 'GFR' ||
      match.phase === 'CHAMPIONSHIP')
  ) {
    return null;
  }

  const isAcceleratedHybrid = bracket?.bracketRouting === 'ACCELERATED_HYBRID';
  const slot = slotNum === 1 ? match.player1 : match.player2;
  const feeder = slotNum === 1 ? match.slotA : match.slotB;
  const srcId = slot?.sourceMatchId || feeder?.matchId;
  const srcMatch = srcId ? bracket?.matchesById?.[srcId] : undefined;

  const buildAHChip = (
    branch: 'AR' | 'UB' | 'LB',
    matchNumber: number | string,
    action: string,
    detailRound: string,
    targetId?: string
  ): MicroChipData => {
    const isLb = branch === 'LB';
    const effectiveLbColor = lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;
    const palette = isLb
      ? {
          border: effectiveLbColor,
          text: LOWER_BRACKET_CHIP_TEXT,
          bgTranslucent: `${effectiveLbColor}26`,
          badgeBg: `${effectiveLbColor}33`,
          glow: `${effectiveLbColor}88`,
        }
      : ACCELERATED_HYBRID_POD_PALETTE[branch];
    const resolvedId = targetId || srcId;
    return {
      text: `${matchNumber}`,
      tooltip: `${action} of ${detailRound} (Match #${matchNumber})`,
      bg: palette.bgTranslucent,
      color: palette.text,
      border: `1px solid ${palette.border}88`,
      sourceMatchId: resolvedId,
      targetMatchId: resolvedId,
    };
  };

  // Phase 2 opening round (Top 16 Championship)
  if (isPhase2OpeningRound || match.roundIdentifier === 'CHAMP_R1') {
    if (slotNum === 1) {
      const arMatches = Object.values(bracket.matchesById).filter(m => m.roundIdentifier === 'AR');
      const fallbackSrc = arMatches[mIdx];
      const targetId = srcMatch?.id || slot?.sourceMatchId || fallbackSrc?.id;
      const mNum = srcMatch?.matchNumber ?? fallbackSrc?.matchNumber ?? (mIdx + 1);
      return buildAHChip('AR', mNum, 'Qualifier', 'Accelerated Round', targetId);
    } else {
      const poMatches = Object.values(bracket.matchesById).filter(m => m.roundIdentifier === 'PO');
      const fallbackSrc = poMatches[mIdx];
      const targetId = srcMatch?.id || slot?.sourceMatchId || fallbackSrc?.id;
      const mNum = srcMatch?.matchNumber ?? fallbackSrc?.matchNumber ?? (mIdx + 1);
      return buildAHChip('LB', mNum, 'Qualifier', 'Lower Bracket R4', targetId);
    }
  }

  if (isAcceleratedHybrid) {
    // Lower Bracket R4 (PO):
    // Slot 1: Inter-pod jump from Upper Bracket R2 (PRE_W2)
    // Slot 2: Incoming horizontal connector line from Lower Bracket R3 (2C) -> Hide chip
    if (match.roundIdentifier === 'PO') {
      if (slotNum === 1) {
        const preW2Matches = Object.values(bracket.matchesById).filter(m => m.roundIdentifier === 'PRE_W2');
        const fallbackSrc = preW2Matches[mIdx];
        const targetId = srcMatch?.id || slot?.sourceMatchId || fallbackSrc?.id;
        const mNum = srcMatch?.matchNumber ?? fallbackSrc?.matchNumber ?? (mIdx + 1);
        return buildAHChip('UB', mNum, 'Winner', 'Upper Bracket R2', targetId);
      }
      return null;
    }

    // Lower Bracket R3 (2C):
    // Slot 1: Incoming horizontal connector line from PRE_L2 -> Hide chip
    // Slot 2: Inter-pod jump from Accelerated Round losers (AR)
    if (match.roundIdentifier === '2C') {
      if (slotNum === 2) {
        const arMatches = Object.values(bracket.matchesById).filter(m => m.roundIdentifier === 'AR');
        const fallbackSrc = arMatches[mIdx];
        const targetId = srcMatch?.id || slot?.sourceMatchId || fallbackSrc?.id;
        const mNum = srcMatch?.matchNumber ?? fallbackSrc?.matchNumber ?? (mIdx + 1);
        return buildAHChip('AR', mNum, 'Dropped', 'Accelerated Round', targetId);
      }
      return null;
    }

    // Lower Bracket R2 (PRE_L2):
    // Slot 1: Incoming horizontal connector line from PRE_L1 -> Hide chip
    // Slot 2: Inter-pod jump from Upper Bracket R1 losers (PRE_W1)
    if (match.roundIdentifier === 'PRE_L2') {
      if (slotNum === 2) {
        const mNum = srcMatch?.matchNumber ?? (mIdx + 1);
        return buildAHChip('UB', mNum, 'Dropped', 'Upper Bracket R1', srcId);
      }
      return null;
    }

    // Lower Bracket R1 (PRE_L1):
    // Both slots entered from Upper Bracket R1 losers (PRE_W1 - inter-pod jump)
    if (match.roundIdentifier === 'PRE_L1') {
      const mNum = srcMatch?.matchNumber ?? (mIdx + 1);
      return buildAHChip('UB', mNum, 'Dropped', 'Upper Bracket R1', srcId);
    }

    // Upper Bracket R2 (PRE_W2): Incoming visual SVG connector line from PRE_W1 -> Hide chip
    if (match.roundIdentifier === 'PRE_W2') {
      return null;
    }

    return null;
  }

  // Double Elimination (Traditional & Flat)
  if (bracket?.eliminationType === 'DOUBLE') {
    // Lower Bracket matches: show chip ONLY for slots entering from Winners Bracket (disconnected transition)
    if (match.stage === 'LOSERS' || match.roundIdentifier?.startsWith('L')) {
      const isFromWinners = Boolean(
        feeder?.type === 'LOSER' ||
        srcMatch?.stage === 'WINNERS' ||
        srcMatch?.roundIdentifier?.startsWith('W')
      );
      if (isFromWinners && (srcMatch || srcId)) {
        const mNum = srcMatch?.matchNumber;
        const label = mNum ? `${mNum}` : '';
        const targetId = srcMatch?.id || srcId;
        return {
          text: label,
          tooltip: `From Winners Bracket${mNum ? ` (Match #${mNum})` : ''}`,
          bg: `${primaryColor}26`,
          color: primaryColor,
          border: `1px solid ${primaryColor}88`,
          sourceMatchId: targetId,
          targetMatchId: targetId,
        };
      }
      return null;
    }

    return null;
  }

  return null;
};

export const getOriginChip = getInboundChip;

export const getOutboundChip = (
  slotNum: 1 | 2,
  match: BracketMatch,
  isComplete: boolean,
  p1Won: boolean,
  p2Won: boolean,
  finalsCutoff: number,
  bracket?: BracketStructure,
  primaryColor = DEFAULT_TIER_THEME.primaryColor,
  _secondaryColor = THEME_FALLBACK.primaryColor,
  lowerBracketColor = LOWER_BRACKET_COLOR
): MicroChipData | null => {
  // Finals Rule: Suppress all incoming and outgoing routing chips for Grand Finals,
  // Grand Finals Reset, and Finals (connecting lines already represent these paths).
  if (
    match.stage === 'GRAND_FINALS' ||
    match.stage === 'GRAND_FINALS_RESET' ||
    match.roundIdentifier === 'GF' ||
    match.roundIdentifier === 'GFR' ||
    match.phase === 'CHAMPIONSHIP' ||
    match.roundIdentifier?.startsWith('CHAMP')
  ) {
    return null;
  }

  const isAcceleratedHybrid = bracket?.bracketRouting === 'ACCELERATED_HYBRID';
  const isSlot1 = slotNum === 1;
  const isThisSlotWinner = isComplete && (isSlot1 ? p1Won : p2Won);
  const isThisSlotLoser = isComplete && (isSlot1 ? !p1Won : !p2Won);

  if (isAcceleratedHybrid) {
    const findDestMatch = (mId: string): BracketMatch | undefined => {
      if (!bracket?.matchesById) return undefined;
      if (match.nextMatchId && bracket.matchesById[match.nextMatchId]) {
        return bracket.matchesById[match.nextMatchId];
      }
      const dest = Object.values(bracket.matchesById).find(
        (m) =>
          (m.phase === 'CHAMPIONSHIP' || m.roundIdentifier?.startsWith('CHAMP')) &&
          (m.player1.sourceMatchId === mId ||
            m.player2.sourceMatchId === mId ||
            m.slotA?.matchId === mId ||
            m.slotB?.matchId === mId)
      );
      if (dest) return dest;

      // Fallback if sourceMatchId wasn't populated on championship matches
      if (match.roundIdentifier === 'AR' || match.roundIdentifier === 'PO') {
        const roundMatches = Object.values(bracket.matchesById).filter(
          (m) => m.roundIdentifier === match.roundIdentifier
        );
        const idx = roundMatches.findIndex((m) => m.id === mId);
        if (idx >= 0) {
          const champR1 = Object.values(bracket.matchesById).filter(
            (m) => m.roundNumber === (bracket.rounds.find((r) => r.phase === 'CHAMPIONSHIP')?.roundNumber || 0)
          );
          if (champR1[idx]) return champR1[idx];
        }
      }
      return undefined;
    };

    const findLbR3Match = (mId: string): BracketMatch | undefined => {
      if (!bracket?.matchesById) return undefined;
      const dest = Object.values(bracket.matchesById).find(
        (m) =>
          m.roundIdentifier === '2C' &&
          (m.player1.sourceMatchId === mId ||
            m.player2.sourceMatchId === mId ||
            m.slotA?.matchId === mId ||
            m.slotB?.matchId === mId)
      );
      if (dest) return dest;
      const arMatches = Object.values(bracket.matchesById).filter((m) => m.roundIdentifier === 'AR');
      const idx = arMatches.findIndex((m) => m.id === mId);
      if (idx >= 0) {
        const scMatches = Object.values(bracket.matchesById).filter((m) => m.roundIdentifier === '2C');
        return scMatches[idx];
      }
      return undefined;
    };

    const findPoMatch = (mId: string): BracketMatch | undefined => {
      if (!bracket?.matchesById) return undefined;
      const dest = Object.values(bracket.matchesById).find(
        (m) =>
          m.roundIdentifier === 'PO' &&
          (m.player1.sourceMatchId === mId ||
            m.player2.sourceMatchId === mId ||
            m.slotA?.matchId === mId ||
            m.slotB?.matchId === mId)
      );
      if (dest) return dest;
      const preW2Matches = Object.values(bracket.matchesById).filter((m) => m.roundIdentifier === 'PRE_W2');
      const idx = preW2Matches.findIndex((m) => m.id === mId);
      if (idx >= 0) {
        const poMatches = Object.values(bracket.matchesById).filter((m) => m.roundIdentifier === 'PO');
        return poMatches[idx];
      }
      return undefined;
    };

    const findLbDropMatch = (mId: string): BracketMatch | undefined => {
      if (!bracket?.matchesById) return undefined;
      return Object.values(bracket.matchesById).find(
        (m) =>
          (m.roundIdentifier === 'PRE_L1' || m.roundIdentifier === 'PRE_L2') &&
          (m.player1.sourceMatchId === mId ||
            m.player2.sourceMatchId === mId ||
            m.slotA?.matchId === mId ||
            m.slotB?.matchId === mId)
      );
    };

    const cutoff = finalsCutoff || 16;

    // 1. Accelerated Round (AR):
    // Winner: Disconnected jump to Top 16 Championship ("► T16-[MatchNumber]")
    // Loser: Disconnected drop to Lower Bracket Round 3 ("▼ LB-[MatchNumber]")
    if (match.roundIdentifier === 'AR') {
      const destMatch = findDestMatch(match.id);
      const destNum = destMatch?.matchNumber;
      const lbMatch = findLbR3Match(match.id);
      const lbNum = lbMatch?.matchNumber;

      if (isComplete) {
        if (isThisSlotWinner) {
          return {
            text: destNum ? `${destNum}` : '',
            tooltip: `QUALIFIED to Top ${cutoff} Championship${destNum ? ` (Match #${destNum})` : ''}`,
            bg: `${primaryColor}26`,
            color: primaryColor,
            border: `1px solid ${primaryColor}88`,
            glow: `0 0 10px ${primaryColor}88`,
            sourceMatchId: destMatch?.id,
            targetMatchId: destMatch?.id,
            opacity: 1,
          };
        }
        if (isThisSlotLoser) {
          const effectiveLbColor = lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;
          const lbPalette = {
            border: effectiveLbColor,
            text: LOWER_BRACKET_CHIP_TEXT,
            bgTranslucent: `${effectiveLbColor}26`,
            badgeBg: `${effectiveLbColor}33`,
            glow: `${effectiveLbColor}88`,
          };
          return {
            text: lbNum ? `${lbNum}` : '',
            tooltip: `Drops to Lower Bracket R3${lbNum ? ` (Match #${lbNum})` : ''}`,
            bg: lbPalette.bgTranslucent,
            color: lbPalette.text,
            border: `1px solid ${lbPalette.border}88`,
            sourceMatchId: lbMatch?.id,
            targetMatchId: lbMatch?.id,
            opacity: 1,
          };
        }
        return null;
      } else {
        // In-progress / uncompleted: drop stake shown at opacity 0.4
        const effectiveLbColor = lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;
        const lbPalette = {
          border: effectiveLbColor,
          text: LOWER_BRACKET_CHIP_TEXT,
          bgTranslucent: `${effectiveLbColor}26`,
          badgeBg: `${effectiveLbColor}33`,
          glow: `${effectiveLbColor}88`,
        };
        return {
          text: lbNum ? `${lbNum}` : '',
          tooltip: `Drops to Lower Bracket R3 on defeat${lbNum ? ` (Match #${lbNum})` : ''}`,
          bg: lbPalette.bgTranslucent,
          color: lbPalette.text,
          border: `1px solid ${lbPalette.border}88`,
          sourceMatchId: lbMatch?.id,
          targetMatchId: lbMatch?.id,
          opacity: 0.4,
        };
      }
    }

    // 2. Upper Bracket Round 1 (PRE_W1):
    // Winner: advances to PRE_W2 via SVG connector line -> SUPPRESS chip
    // Loser: drops to Lower Bracket (PRE_L1 / PRE_L2)
    if (match.roundIdentifier === 'PRE_W1') {
      const lbMatch = findLbDropMatch(match.id);
      const lbNum = lbMatch?.matchNumber;
      if (isComplete) {
        if (isThisSlotLoser && lbMatch) {
          const effectiveLbColor = lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;
          const lbPalette = {
            border: effectiveLbColor,
            text: LOWER_BRACKET_CHIP_TEXT,
            bgTranslucent: `${effectiveLbColor}26`,
            badgeBg: `${effectiveLbColor}33`,
            glow: `${effectiveLbColor}88`,
          };
          return {
            text: lbNum ? `${lbNum}` : '',
            tooltip: `Drops to Lower Bracket${lbNum ? ` (Match #${lbNum})` : ''}`,
            bg: lbPalette.bgTranslucent,
            color: lbPalette.text,
            border: `1px solid ${lbPalette.border}88`,
            sourceMatchId: lbMatch.id,
            targetMatchId: lbMatch.id,
            opacity: 1,
          };
        }
        return null;
      } else if (lbMatch) {
        // In-progress / uncompleted drop stake
        const effectiveLbColor = lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;
        const lbPalette = {
          border: effectiveLbColor,
          text: LOWER_BRACKET_CHIP_TEXT,
          bgTranslucent: `${effectiveLbColor}26`,
          badgeBg: `${effectiveLbColor}33`,
          glow: `${effectiveLbColor}88`,
        };
        return {
          text: lbNum ? `${lbNum}` : '',
          tooltip: `Drops to Lower Bracket on defeat${lbNum ? ` (Match #${lbNum})` : ''}`,
          bg: lbPalette.bgTranslucent,
          color: lbPalette.text,
          border: `1px solid ${lbPalette.border}88`,
          sourceMatchId: lbMatch.id,
          targetMatchId: lbMatch.id,
          opacity: 0.4,
        };
      }
      return null;
    }

    // 3. Upper Bracket R2 (PRE_W2):
    // Winner: advances to Lower Bracket R4 (PO) -> "► LB-[MatchNumber]"
    // Loser: eliminated -> no chip
    if (match.roundIdentifier === 'PRE_W2') {
      if (isComplete && isThisSlotWinner) {
        const destMatch = findPoMatch(match.id);
        const effectiveLbColor = lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;
        const lbPalette = {
          border: effectiveLbColor,
          text: LOWER_BRACKET_CHIP_TEXT,
          bgTranslucent: `${effectiveLbColor}26`,
          badgeBg: `${effectiveLbColor}33`,
          glow: `${effectiveLbColor}88`,
        };
        return {
          text: destMatch?.matchNumber ? `${destMatch.matchNumber}` : '',
          tooltip: `Advances to Lower Bracket R4${destMatch?.matchNumber ? ` - Match #${destMatch.matchNumber}` : ''}`,
          bg: lbPalette.bgTranslucent,
          color: lbPalette.text,
          border: `1px solid ${lbPalette.border}88`,
          sourceMatchId: destMatch?.id,
          targetMatchId: destMatch?.id,
          opacity: 1,
        };
      }
      return null;
    }

    // 4. Lower Bracket Round 4 (PO):
    // Winner: qualifies to Top 16 Championship ("► T16-[MatchNumber]")
    // Loser: eliminated -> no chip
    if (match.roundIdentifier === 'PO') {
      if (isComplete && isThisSlotWinner) {
        const destMatch = findDestMatch(match.id);
        const destNum = destMatch?.matchNumber;
        return {
          text: destNum ? `${destNum}` : '',
          tooltip: `QUALIFIED to Top ${cutoff} Championship${destNum ? ` (Match #${destNum})` : ''}`,
          bg: `${primaryColor}26`,
          color: primaryColor,
          border: `1px solid ${primaryColor}88`,
          glow: `0 0 10px ${primaryColor}88`,
          sourceMatchId: destMatch?.id,
          targetMatchId: destMatch?.id,
          opacity: 1,
        };
      }
      return null;
    }

    // All other rounds: connected by SVG lines or elimination -> SUPPRESS chip
    return null;
  }

  // Double Elimination (Traditional & Flat)
  if (bracket?.eliminationType === 'DOUBLE') {
    // 1. Winners Bracket:
    if (match.stage === 'WINNERS' || match.roundIdentifier?.startsWith('W')) {
      // Find loser drop match in Losers bracket
      let destMatch = match.loserNextMatchId && bracket?.matchesById
        ? bracket.matchesById[match.loserNextMatchId]
        : undefined;
      if (!destMatch && bracket?.matchesById) {
        destMatch = Object.values(bracket.matchesById).find(
          (m) =>
            (m.stage === 'LOSERS' || m.roundIdentifier?.startsWith('L')) &&
            ((m.slotA?.matchId === match.id && m.slotA?.type === 'LOSER') ||
              (m.slotB?.matchId === match.id && m.slotB?.type === 'LOSER') ||
              (m.player1?.sourceMatchId === match.id && m.slotA?.type === 'LOSER') ||
              (m.player2?.sourceMatchId === match.id && m.slotB?.type === 'LOSER'))
        );
      }

      if (destMatch) {
        const destNum = destMatch.matchNumber;
        const label = destNum ? `${destNum}` : '';

        if (isComplete) {
          // Only show on the dropping loser's row
          if (isThisSlotLoser) {
            return {
              text: label,
              tooltip: `Drops to Lower Bracket (Match #${destNum ?? '?'})`,
              bg: `${lowerBracketColor}26`,
              color: lowerBracketColor,
              border: `1px solid ${lowerBracketColor}88`,
              sourceMatchId: destMatch.id,
              targetMatchId: destMatch.id,
              opacity: 1,
            };
          }
          // Advancing winner advances via SVG line -> null
          return null;
        } else {
          // Uncompleted / in-progress: both slots have drop stake at opacity 0.4
          return {
            text: label,
            tooltip: `Drops to Lower Bracket on defeat (Match #${destNum ?? '?'})`,
            bg: `${lowerBracketColor}26`,
            color: lowerBracketColor,
            border: `1px solid ${lowerBracketColor}88`,
            sourceMatchId: destMatch.id,
            targetMatchId: destMatch.id,
            opacity: 0.4,
          };
        }
      }

      return null;
    }

    // 2. Losers Bracket:
    // Winner advances via SVG line (or to GF via SVG line). Loser eliminated.
    // Connector line rule & Finals rule -> SUPPRESS chip completely.
    return null;
  }

  return null;
};

export const getOutcomeChip = (
  slotWon: boolean,
  match: BracketMatch,
  finalsCutoff: number,
  bracket?: BracketStructure,
  primaryColor = DEFAULT_TIER_THEME.primaryColor,
  secondaryColor = THEME_FALLBACK.primaryColor,
  lowerBracketColor = LOWER_BRACKET_COLOR
): MicroChipData | null => {
  return getOutboundChip(
    1,
    match,
    true,
    slotWon,
    !slotWon,
    finalsCutoff,
    bracket,
    primaryColor,
    secondaryColor,
    lowerBracketColor
  );
};

export const renderMicroChip = (
  chip: MicroChipData | null,
  onHover?: (sourceMatchId: string | null) => void,
  onClick?: (matchId: string) => void
) => {
  if (!chip || !chip.text) return null;
  const matchId = chip.targetMatchId || chip.sourceMatchId;
  return (
    <span
      className={cn(
        'inline-flex min-w-4.5 shrink-0 items-center justify-center rounded-xs py-px px-1.5 font-mono text-3xs font-bold leading-none tracking-tight whitespace-nowrap select-none',
        matchId
          ? 'cursor-pointer transition-[transform,scale,filter,box-shadow] duration-150 hover:z-35 hover:scale-[1.18] hover:brightness-[1.28] active:scale-95'
          : 'cursor-help'
      )}
      onClick={(e) => {
        if (matchId && onClick) {
          e.stopPropagation();
          onClick(matchId);
        }
      }}
      onMouseEnter={() => {
        if (matchId && onHover) {
          onHover(matchId);
        }
      }}
      onMouseLeave={() => {
        if (matchId && onHover) {
          onHover(null);
        }
      }}
      style={{
        backgroundColor: chip.bg,
        color: chip.color,
        border: chip.border || 'none',
        boxShadow: chip.glow || 'none',
        opacity: chip.opacity !== undefined ? chip.opacity : 1,
      }}
      title={chip.tooltip}
    >
      {chip.text}
    </span>
  );
};