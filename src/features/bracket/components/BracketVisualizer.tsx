import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BracketStructure, BracketMatch, SeededPlayer, BracketRound, canonicalizeBracketRounds } from '../types';
import { Tournament, TournamentTier, PlayerProfile } from '../../tournament/types';
import { MatchScoreDrawer } from './MatchScoreDrawer';
import { MatchTelemetryModal } from './MatchTelemetryModal';
import {
  getTierCanvasBackground,
  getTierCardBackground,
  getTextScale,
  getDefaultTierColors,
} from '../colorUtils';
import {
  calculateBracketLayout,
  calculateAcceleratedHybridAccelLayout,
  calculateAcceleratedHybridPreMergeLayout,
  calculateAcceleratedHybridPreMergeUpperLayout,
  calculateAcceleratedHybridLowerBracketLayout,
  calculateAcceleratedHybridPhase2Layout,
  BracketViewMode,
  BracketLayoutMetadata,
} from '../bracketLayout';
import { PlayerDetailDrawer } from '../../qualifiers/components/PlayerDetailDrawer';
import { findPlayerJourney, findAncestors } from '../journeyHighlight';
import { BracketBroadcastHeader } from './visualizer/BracketBroadcastHeader';
import { BracketStageNavBar, HybridStageTab } from './visualizer/BracketStageNavBar';
import { BracketQualifierPodGrid } from './visualizer/BracketQualifierPodGrid';
import { BracketCanvas } from './visualizer/BracketCanvas';

export * from '../routingChips';
export * from '../journeyHighlight';
export type { HybridStageTab } from './visualizer/BracketStageNavBar';

interface BracketVisualizerProps {
  tournament: Tournament;
  tier: TournamentTier;
  isObsMode?: boolean;
  canManage?: boolean;
  obsView?: BracketViewMode;
  chroma?: string | null;
  highlightedPlayerId?: string | null;
}

export const BracketVisualizer: React.FC<BracketVisualizerProps> = ({
  tournament,
  tier,
  isObsMode = false,
  canManage = true,
  obsView,
  chroma,
  highlightedPlayerId,
}) => {
  const [searchParams] = useSearchParams();
  const effectiveObsView = (obsView || (searchParams.get('view') as BracketViewMode) || (isObsMode ? 'fit' : 'standard')) as BracketViewMode;
  const effectiveChroma = chroma !== undefined ? chroma : searchParams.get('chroma');

  const [selectedMatch, setSelectedMatch] = useState<{ match: BracketMatch; roundName: string } | null>(null);
  const [selectedPlayerForDrawer, setSelectedPlayerForDrawer] = useState<PlayerProfile | null>(null);
  const [isPlayerDrawerOpen, setIsPlayerDrawerOpen] = useState(false);
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [hoveredOriginMatchId, setHoveredOriginMatchId] = useState<string | null>(null);
  const [hoveredAncestry, setHoveredAncestry] = useState<{
    matchIds: Set<string>;
    slotKeys: Set<string>;
    isChampion?: boolean;
    targetPlayerId?: string | null;
  } | null>(null);

  const combinedContentRef = useRef<HTMLDivElement>(null);
  const [measuredCombinedDim, setMeasuredCombinedDim] = useState<{ w: number; h: number } | null>(null);

  const journeyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSlotHover = (matchId: string | null, slotNum: 1 | 2 | null) => {
    if (journeyTimeoutRef.current) {
      clearTimeout(journeyTimeoutRef.current);
      journeyTimeoutRef.current = null;
    }
    if (!matchId || !slotNum || !bracket) {
      if (highlightedPlayerId) {
        const journey = findPlayerJourney(
          highlightedPlayerId,
          null,
          null,
          bracket,
          tournament.matchScores,
          championPlayer?.id
        );
        setHoveredAncestry(journey);
      } else {
        setHoveredAncestry(null);
      }
      return;
    }
    journeyTimeoutRef.current = setTimeout(() => {
      const ancestry = findAncestors(matchId, slotNum, bracket, tournament.matchScores, championPlayer?.id);
      setHoveredAncestry(ancestry);
    }, 200);
  };

  const handleChampHover = (champPlayerId?: string | null) => {
    if (journeyTimeoutRef.current) {
      clearTimeout(journeyTimeoutRef.current);
      journeyTimeoutRef.current = null;
    }
    if (!champPlayerId || !bracket) {
      if (highlightedPlayerId) {
        const journey = findPlayerJourney(
          highlightedPlayerId,
          null,
          null,
          bracket,
          tournament.matchScores,
          championPlayer?.id
        );
        setHoveredAncestry(journey);
      } else {
        setHoveredAncestry(null);
      }
      return;
    }
    journeyTimeoutRef.current = setTimeout(() => {
      const journey = findPlayerJourney(
        champPlayerId,
        null,
        null,
        bracket,
        tournament.matchScores,
        championPlayer?.id
      );
      setHoveredAncestry(journey);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (journeyTimeoutRef.current) {
        clearTimeout(journeyTimeoutRef.current);
      }
    };
  }, []);

  const fitContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic measurement for Strategy B (Fit to 1080p / responsive canvas)
  const [viewportDim, setViewportDim] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1920,
    h: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    if (effectiveObsView !== 'fit') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

    const updateDimensions = () => {
      if (fitContainerRef.current) {
        const rect = fitContainerRef.current.getBoundingClientRect();
        const availableHeight = Math.round(window.innerHeight - rect.top);
        setViewportDim({
          w: Math.round(rect.width) || window.innerWidth || 1920,
          h: availableHeight > 100 ? availableHeight : (window.innerHeight - 52) || 1080,
        });
      } else {
        setViewportDim({
          w: window.innerWidth || 1920,
          h: window.innerHeight || 1080,
        });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (fitContainerRef.current) {
      resizeObserver.observe(fitContainerRef.current);
    }
    window.addEventListener('resize', updateDimensions);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [effectiveObsView]);

  const handlePlayerClick = (pId: string) => {
    // Only registered competitors have a profile; draft placeholder seeds ("Seed N") are not players
    const profile = (tournament.playersPool || []).find((p) => p.id === pId);
    if (!profile) return;
    setSelectedPlayerForDrawer(profile);
    setIsPlayerDrawerOpen(true);
  };

  const bracket: BracketStructure = tier.bracket;
  if (bracket?.rounds) {
    canonicalizeBracketRounds(bracket.rounds);
  }
  const rounds = bracket?.rounds || [];
  const tierDefaults = getDefaultTierColors(tier);
  const primaryColor = tier.primaryColor || tierDefaults.primaryColor;
  const secondaryColor = tier.secondaryColor || tierDefaults.secondaryColor;
  const cardColor = tier.cardColor || tierDefaults.cardColor;
  const backgroundColor = tier.backgroundColor || tierDefaults.backgroundColor;
  const textColor = tier.textColor || tierDefaults.textColor;
  const lowerBracketColor = tier.lowerBracketColor || tierDefaults.lowerBracketColor || '#c2410c';
  const textScale = getTextScale(tier.textSize);

  // Dynamic text scaling derived from smaller baseline:
  const shelfFontSize = `${(0.64 * textScale).toFixed(3)}rem`;
  const seedDim = Math.max(16, Math.round(18 * textScale));
  const seedFontSize = `${(0.68 * textScale).toFixed(3)}rem`;
  const flagFontSize = `${(0.9 * textScale).toFixed(3)}rem`;
  const nameFontSize = `${(0.84 * textScale).toFixed(3)}rem`;
  const scoreFontSize = `${(0.88 * textScale).toFixed(3)}rem`;
  const scoreMinW = Math.max(18, Math.round(20 * textScale));
  const scoreH = Math.max(18, Math.round(20 * textScale));

  const isAcceleratedHybrid = bracket?.bracketRouting === 'ACCELERATED_HYBRID';

  // Partition rounds into constituent stages for Accelerated Hybrid:
  // 1. Pod Top-Left: Accelerated Round (seeds 1 to finalsCutoff)
  const accelRounds = useMemo(
    () => (rounds || []).filter((r) => r.roundIdentifier === 'AR'),
    [rounds]
  );

  // 2. Pod Top-Right: Pre-Merge Upper Bracket (PRE_W1, PRE_W2)
  const preUpperRounds = useMemo(
    () => (rounds || []).filter((r) => r.roundIdentifier?.startsWith('PRE_W')),
    [rounds]
  );

  // Pod 3 (Consolidated Lower Bracket): PRE_L1, PRE_L2, 2C, PO
  const lowerBracketRounds = useMemo(() => {
    if (!rounds) return [];
    const r1 = rounds.find((r) => r.roundIdentifier === 'PRE_L1');
    const r2 = rounds.find((r) => r.roundIdentifier === 'PRE_L2');
    const r3 = rounds.find((r) => r.roundIdentifier === '2C');
    const r4 = rounds.find((r) => r.roundIdentifier === 'PO');
    return [r1, r2, r3, r4].filter(Boolean) as BracketRound[];
  }, [rounds]);

  // Backward compatibility: combined pre-merge rounds
  const preMergeRounds = useMemo(
    () => (rounds || []).filter((r) => r.phase === 'QUALIFIERS' && r.roundIdentifier !== 'AR'),
    [rounds]
  );

  // Phase 2: Top C Finals (Round of C, QF, SF, Finals)
  const championshipRounds = useMemo(
    () => (rounds || []).filter((r) => r.phase === 'CHAMPIONSHIP'),
    [rounds]
  );

  // Activity checks to pick the most relevant default tab
  const hasChampionshipActivity = useMemo(() => {
    if (!isAcceleratedHybrid || !bracket?.matchesById) return false;
    const champMatches = Object.values(bracket.matchesById).filter(
      (m) => m.phase === 'CHAMPIONSHIP'
    );
    return champMatches.some((m) => {
      const score = tournament.matchScores[m.id];
      return Boolean(
        m.winnerId ||
        score?.isComplete ||
        score?.winnerPlayerId ||
        (score?.player1Wins || 0) > 0 ||
        (score?.player2Wins || 0) > 0
      );
    });
  }, [isAcceleratedHybrid, bracket?.matchesById, tournament.matchScores]);

  const rawParamStage = (searchParams.get('stage') || searchParams.get('phase')) as string | null;
  const mappedParamStage: HybridStageTab | null =
    rawParamStage === 'qualifiers' || rawParamStage === 'championship' || rawParamStage === 'combined' || rawParamStage === 'accel' || rawParamStage === 'premerge' || rawParamStage === 'upper' || rawParamStage === 'lower'
      ? rawParamStage
      : rawParamStage === 'phase1' || rawParamStage === 'pods' || rawParamStage === 'grid' || rawParamStage === 'early'
      ? 'qualifiers'
      : rawParamStage === 'phase2' || rawParamStage === 'top16' || rawParamStage === 'finals'
      ? 'championship'
      : rawParamStage === 'stacked' || rawParamStage === 'all'
      ? 'combined'
      : rawParamStage === 'pre_upper' || rawParamStage === 'pre-upper'
      ? 'upper'
      : rawParamStage === 'pre_lower' || rawParamStage === 'pre-lower' || rawParamStage === 'playin'
      ? 'lower'
      : null;

  const [selectedPhaseTab, setSelectedPhaseTab] = useState<HybridStageTab | null>(null);

  const activeHybridTab: HybridStageTab =
    selectedPhaseTab ||
    mappedParamStage ||
    (hasChampionshipActivity ? 'championship' : 'qualifiers');

  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  const handleChipClick = useCallback(
    (targetMatchId: string) => {
      if (!bracket?.matchesById) return;
      const targetMatch = bracket.matchesById[targetMatchId];
      if (!targetMatch) return;

      const isTargetChampionship =
        targetMatch.phase === 'CHAMPIONSHIP' ||
        targetMatch.roundIdentifier?.startsWith('CHAMP') ||
        championshipRounds.some((r) => r.matches.some((m) => m.id === targetMatchId));

      if (isAcceleratedHybrid && activeHybridTab !== 'combined') {
        if (isTargetChampionship && activeHybridTab !== 'championship') {
          setSelectedPhaseTab('championship');
        } else if (!isTargetChampionship && activeHybridTab !== 'qualifiers') {
          setSelectedPhaseTab('qualifiers');
        }
      }

      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
      setFocusedMatchId(targetMatchId);
      focusTimeoutRef.current = setTimeout(() => {
        setFocusedMatchId(null);
      }, 2800);

      const performScroll = () => {
        const matchEl = document.getElementById(`bracket-match-${targetMatchId}`);
        if (matchEl) {
          matchEl.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        }
      };

      performScroll();
      requestAnimationFrame(() => {
        setTimeout(performScroll, 60);
        setTimeout(performScroll, 180);
      });
    },
    [bracket?.matchesById, championshipRounds, isAcceleratedHybrid, activeHybridTab]
  );

  // Compute Layouts
  const standardLayout = useMemo(() => {
    if (isAcceleratedHybrid) return null;
    return calculateBracketLayout(bracket, undefined, effectiveObsView);
  }, [bracket, effectiveObsView, isAcceleratedHybrid]);

  const layoutAccel = useMemo(() => {
    if (!isAcceleratedHybrid) return null;
    return calculateAcceleratedHybridAccelLayout(bracket);
  }, [bracket, isAcceleratedHybrid]);

  const layoutPreMergeUpper = useMemo(() => {
    if (!isAcceleratedHybrid) return null;
    return calculateAcceleratedHybridPreMergeUpperLayout(bracket);
  }, [bracket, isAcceleratedHybrid]);

  const layoutLowerBracket = useMemo(() => {
    if (!isAcceleratedHybrid) return null;
    return calculateAcceleratedHybridLowerBracketLayout(bracket);
  }, [bracket, isAcceleratedHybrid]);

  const layoutPreMerge = useMemo(() => {
    if (!isAcceleratedHybrid) return null;
    return calculateAcceleratedHybridPreMergeLayout(bracket);
  }, [bracket, isAcceleratedHybrid]);

  const layoutChampionship = useMemo(() => {
    if (!isAcceleratedHybrid) return null;
    return calculateAcceleratedHybridPhase2Layout(bracket, undefined, effectiveObsView === 'fit' ? 'fit' : 'standard');
  }, [bracket, isAcceleratedHybrid, effectiveObsView]);

  const layout = useMemo(() => {
    if (!isAcceleratedHybrid) return standardLayout!;
    if (activeHybridTab === 'championship') return layoutChampionship!;
    if (activeHybridTab === 'accel') return layoutAccel!;
    if (activeHybridTab === 'premerge') return layoutPreMerge!;
    if (activeHybridTab === 'upper') return layoutPreMergeUpper!;
    if (activeHybridTab === 'lower') return layoutLowerBracket!;
    return layoutChampionship || layoutPreMerge || layoutAccel!;
  }, [isAcceleratedHybrid, activeHybridTab, standardLayout, layoutAccel, layoutPreMerge, layoutPreMergeUpper, layoutLowerBracket, layoutChampionship]);

  // Dynamic measurement of the combined view stage containers
  useEffect(() => {
    if (!combinedContentRef.current || activeHybridTab !== 'combined' || effectiveObsView === 'fit') return;
    const el = combinedContentRef.current;
    const updateDim = () => {
      const scrollH = el.scrollHeight;
      const rectH = el.getBoundingClientRect().height;
      const h = Math.max(scrollH, rectH);
      const scrollW = el.scrollWidth;
      const rectW = el.getBoundingClientRect().width;
      const w = Math.max(scrollW, rectW);
      if (h > 0 && w > 0) {
        setMeasuredCombinedDim((prev) => {
          if (prev && Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2) return prev;
          return { w, h };
        });
      }
    };
    updateDim();
    const observer = new ResizeObserver(updateDim);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeHybridTab, effectiveObsView, layoutAccel, layoutPreMergeUpper, layoutLowerBracket, layoutChampionship]);

  // Combined View bounding box: measures all rendered stages (Qualifiers and Championship)
  const combinedBounds = useMemo(() => {
    if (!isAcceleratedHybrid) return null;
    const wAccel = layoutAccel?.totalWidth || 300;
    const hAccel = layoutAccel?.totalHeight || 700;
    const wUpper = layoutPreMergeUpper?.totalWidth || 1200;
    const hUpper = layoutPreMergeUpper?.totalHeight || 750;
    const wLower = layoutLowerBracket?.totalWidth || 1080;
    const hLower = layoutLowerBracket?.totalHeight || 700;
    const wChamp = layoutChampionship?.totalWidth || 1200;
    const hChamp = layoutChampionship?.totalHeight || 700;

    const isSideBySide = effectiveObsView === 'fit' || effectiveObsView === 'split';
    const effectiveUpperW = wUpper + 24;
    const effectiveLowerW = wLower + 24;

    let qualW: number;
    let qualH: number;

    if (isSideBySide) {
      // 3 pods side-by-side: Pod 1 + gap (20px) + Pod 2 + gap (20px) + Pod 3 + container margins/padding
      qualW = wAccel + 20 + effectiveUpperW + 20 + effectiveLowerW + 40;
      // Single row height: Pod header strip (55px) + tallest pod + safety padding (90px)
      qualH = 55 + Math.max(hAccel, hUpper, hLower) + 90;
    } else {
      // Top row (Pod 1 & Pod 2) with pod header strip (55px), pod borders and padding (24px)
      const topRowW = wAccel + 20 + effectiveUpperW + 24;
      const topRowH = Math.max(hAccel, hUpper) + 90;
      // Lower pod (Pod 3) with pod header strip (55px) and padding (32px)
      const lowerH = hLower + 90;
      qualW = Math.max(topRowW, effectiveLowerW + 64);
      // Qualifiers height: header (55px) + top row + gap (20px) + lower row
      qualH = 55 + topRowH + 20 + lowerH;
    }

    // Stage 1 to 2 gap (40px) + divider (45px) + Stage 2 Header (55px)
    const stageDividerH = 40 + 45 + 55;
    const combinedW = Math.max(qualW, wChamp + 64) + 60;
    // Add 100px bottom safety padding as required
    const estimatedCombinedH = qualH + stageDividerH + hChamp + 100;

    const finalCombinedH = (effectiveObsView !== 'fit' && measuredCombinedDim?.h)
      ? Math.max(measuredCombinedDim.h + 100, estimatedCombinedH)
      : estimatedCombinedH;
    const finalCombinedW = (effectiveObsView !== 'fit' && measuredCombinedDim?.w)
      ? Math.max(measuredCombinedDim.w + 40, combinedW)
      : combinedW;

    return {
      qualW,
      qualH,
      wChamp,
      hChamp,
      combinedW: finalCombinedW,
      combinedH: finalCombinedH,
    };
  }, [
    isAcceleratedHybrid,
    effectiveObsView,
    layoutAccel,
    layoutPreMergeUpper,
    layoutLowerBracket,
    layoutChampionship,
    measuredCombinedDim,
  ]);

  // Fit scale calculation for 1080p / responsive OBS window
  const fitScale = useMemo(() => {
    if (effectiveObsView !== 'fit') return 1;
    const availableW = Math.max(240, viewportDim.w - (isObsMode ? 16 : 32));
    const availableH = Math.max(180, viewportDim.h - (isObsMode ? 12 : 24));

    let targetW = layout.totalWidth;
    let targetH = layout.totalHeight;

    if (isAcceleratedHybrid && activeHybridTab === 'combined' && combinedBounds) {
      targetW = combinedBounds.combinedW;
      targetH = combinedBounds.combinedH;
    } else if (isAcceleratedHybrid && activeHybridTab === 'qualifiers' && combinedBounds) {
      targetW = combinedBounds.qualW;
      targetH = combinedBounds.qualH;
    }

    const scaleX = availableW / targetW;
    const scaleY = availableH / targetH;
    return Math.min(scaleX, scaleY, 1.2);
  }, [
    effectiveObsView,
    viewportDim,
    layout.totalWidth,
    layout.totalHeight,
    isObsMode,
    isAcceleratedHybrid,
    activeHybridTab,
    combinedBounds,
  ]);

  // Find final match winner if tournament is concluded
  let championPlayer: SeededPlayer | null = null;
  if (isAcceleratedHybrid) {
    const finalRound = championshipRounds[championshipRounds.length - 1];
    const finalMatch = finalRound?.matches[0];
    const champWinnerId = finalMatch?.winnerId || tournament.matchScores[finalMatch?.id || '']?.winnerPlayerId;
    championPlayer =
      champWinnerId === finalMatch?.player1.player?.id
        ? finalMatch?.player1.player
        : champWinnerId === finalMatch?.player2.player?.id
        ? finalMatch?.player2.player
        : null;
  } else if (tier.eliminationType === 'DOUBLE') {
    const gfResetMatch = Object.values(bracket.matchesById).find(
      (m) => m.stage === 'GRAND_FINALS_RESET' || m.roundIdentifier === 'GF_RESET'
    );
    const gf1Match = Object.values(bracket.matchesById).find(
      (m) => m.stage === 'GRAND_FINALS' || m.roundIdentifier === 'GF'
    );

    const activeGfMatch =
      gfResetMatch && (tournament.matchScores[gfResetMatch.id]?.winnerPlayerId || gfResetMatch.winnerId)
        ? gfResetMatch
        : gf1Match;

    if (activeGfMatch) {
      const record = tournament.matchScores[activeGfMatch.id];
      const p1 = activeGfMatch.player1.player;
      const p2 = activeGfMatch.player2.player;
      const winnerId = record?.winnerPlayerId || activeGfMatch.winnerId;

      if (winnerId && (winnerId === p1?.id || winnerId === p2?.id)) {
        if (activeGfMatch === gf1Match && p2?.id && winnerId === p2.id && gfResetMatch) {
          const resetRecord = tournament.matchScores[gfResetMatch.id];
          const resetWinner = resetRecord?.winnerPlayerId || gfResetMatch.winnerId;
          if (resetWinner) {
            championPlayer =
              resetWinner === gfResetMatch.player1.player?.id
                ? gfResetMatch.player1.player
                : gfResetMatch.player2.player;
          }
        } else {
          championPlayer = winnerId === p1?.id ? p1 : p2;
        }
      }
    }
  } else {
    const finalRound = rounds[rounds.length - 1];
    const finalMatch = finalRound?.matches[0];
    const championWinnerId = finalMatch?.winnerId || tournament.matchScores[finalMatch?.id || '']?.winnerPlayerId;
    championPlayer =
      championWinnerId === finalMatch?.player1.player?.id
        ? finalMatch?.player1.player
        : championWinnerId === finalMatch?.player2.player?.id
        ? finalMatch?.player2.player
        : null;
  }

  // Sync search-induced player highlight journey
  const prevSearchPlayerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bracket) return;
    if (highlightedPlayerId) {
      prevSearchPlayerIdRef.current = highlightedPlayerId;
      const journey = findPlayerJourney(
        highlightedPlayerId,
        null,
        null,
        bracket,
        tournament.matchScores,
        championPlayer?.id
      );
      setHoveredAncestry(journey);
    } else if (prevSearchPlayerIdRef.current !== null) {
      // User explicitly cleared the search query
      prevSearchPlayerIdRef.current = null;
      setHoveredAncestry(null);
    }
  }, [highlightedPlayerId, bracket, tournament.matchScores, championPlayer?.id]);

  // Resolve chroma color if requested
  const getChromaColor = (param?: string | null) => {
    if (!param) return null;
    const c = param.toLowerCase().trim();
    if (c === 'green') return '#00ff00';
    if (c === 'magenta') return '#ff00ff';
    if (c === 'blue') return '#0000ff';
    if (c.startsWith('#')) return c;
    return `#${c}`;
  };

  const chromaHex = getChromaColor(effectiveChroma);
  const cardBg = getTierCardBackground(cardColor, primaryColor);
  const canvasBg = getTierCanvasBackground(backgroundColor, primaryColor);

  // Pure user-defined solid colors
  const effectiveCardBg = chromaHex ? (tier.cardColor || '#161922') : cardBg;
  const effectiveCanvasBg = chromaHex ? chromaHex : isObsMode ? 'transparent' : canvasBg;

  // Render a complete geometric canvas for a given layout and round set
  const renderCanvas = (
    targetLayout: BracketLayoutMetadata,
    targetRounds: BracketRound[],
    isPhase1View = false,
    isPhase2View = false,
    targetChampPlayer: SeededPlayer | null = null
  ) => {
    return (
      <BracketCanvas
        targetLayout={targetLayout}
        targetRounds={targetRounds}
        isPhase1View={isPhase1View}
        isPhase2View={isPhase2View}
        targetChampPlayer={targetChampPlayer}
        tournament={tournament}
        bracket={bracket}
        tier={tier}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        textColor={textColor}
        lowerBracketColor={lowerBracketColor}
        effectiveCardBg={effectiveCardBg}
        shelfFontSize={shelfFontSize}
        seedDim={seedDim}
        seedFontSize={seedFontSize}
        flagFontSize={flagFontSize}
        nameFontSize={nameFontSize}
        scoreFontSize={scoreFontSize}
        scoreMinW={scoreMinW}
        scoreH={scoreH}
        isAcceleratedHybrid={isAcceleratedHybrid}
        hoveredMatchId={hoveredMatchId}
        setHoveredMatchId={setHoveredMatchId}
        hoveredOriginMatchId={hoveredOriginMatchId}
        setHoveredOriginMatchId={setHoveredOriginMatchId}
        hoveredAncestry={hoveredAncestry}
        focusedMatchId={focusedMatchId}
        isObsMode={isObsMode}
        onSlotHover={handleSlotHover}
        onChampHover={handleChampHover}
        onPlayerClick={handlePlayerClick}
        onChipClick={handleChipClick}
        onSelectMatch={(match, roundName) => setSelectedMatch({ match, roundName })}
      />
    );
  };

  const renderQualifierPodGrid = () => {
    return (
      <BracketQualifierPodGrid
        effectiveObsView={effectiveObsView}
        effectiveCardBg={effectiveCardBg}
        secondaryColor={secondaryColor}
        primaryColor={primaryColor}
        lowerBracketColor={lowerBracketColor}
        layoutAccel={layoutAccel!}
        accelRounds={accelRounds}
        layoutPreMergeUpper={layoutPreMergeUpper!}
        preUpperRounds={preUpperRounds}
        layoutLowerBracket={layoutLowerBracket!}
        lowerBracketRounds={lowerBracketRounds}
        renderCanvas={renderCanvas}
      />
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: isObsMode ? '100vh' : 'calc(100vh - 120px)',
        height: effectiveObsView === 'fit' ? '100%' : 'auto',
        flex: effectiveObsView === 'fit' ? 1 : undefined,
        background: effectiveCanvasBg,
        overflow: effectiveObsView === 'fit' ? 'hidden' : 'visible',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tournament Name and Bracket Tier Header for OBS Broadcasts Only */}
      {isObsMode && (
        <BracketBroadcastHeader
          tournamentName={tournament.name}
          tierName={tier.name}
          eliminationType={tier.eliminationType}
          isAcceleratedHybrid={isAcceleratedHybrid}
          activeHybridTab={activeHybridTab}
          finalsCutoff={bracket.finalsCutoff || 16}
          isObsMode={isObsMode}
          chromaHex={chromaHex}
          primaryColor={primaryColor}
          isDraft={!tournament.isLocked}
        />
      )}

      {/* Sticky Stage Navigation Bar for Accelerated Hybrid Tournaments */}
      {isAcceleratedHybrid && !isObsMode && (
        <BracketStageNavBar
          activeHybridTab={activeHybridTab}
          onSelectTab={setSelectedPhaseTab}
          effectiveObsView={effectiveObsView}
          primaryColor={primaryColor}
          finalsCutoff={bracket.finalsCutoff || 16}
          topOffset={canManage ? 'var(--bracket-tier-bar-height, 48px)' : 'calc(56px + var(--bracket-tier-bar-height, 48px))'}
        />
      )}

      {/* Main Canvas Presentation */}
      {effectiveObsView === 'fit' ? (
        /* Strategy B: Viewport Auto-Scaled 1080p View */
        <div
          ref={fitContainerRef}
          style={{
            width: isObsMode ? '100vw' : '100%',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: isObsMode ? '4px' : '8px',
            background: effectiveCanvasBg,
            boxSizing: 'border-box',
          }}
        >
          {isAcceleratedHybrid && activeHybridTab === 'combined' && combinedBounds ? (
            <div
              style={{
                width: `${Math.ceil(combinedBounds.combinedW * fitScale)}px`,
                height: `${Math.ceil(combinedBounds.combinedH * fitScale)}px`,
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                ref={combinedContentRef}
                style={{
                  width: `${combinedBounds.combinedW}px`,
                  minHeight: `${combinedBounds.combinedH}px`,
                  transform: `scale(${fitScale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2.5rem',
                  alignItems: 'flex-start',
                  paddingBottom: '100px',
                }}
              >
                {/* Stage 1: Early Rounds (3 Pods) */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Early Rounds (3 Pods)
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Accelerated Round • Upper Bracket • Lower Bracket
                    </span>
                  </div>
                  {renderQualifierPodGrid()}
                </div>

                {/* Phase 1 to Phase 2 Divider */}
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
                  <div style={{ height: '2px', flex: 1, background: `linear-gradient(to right, transparent, ${primaryColor}88)` }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 900, color: primaryColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Top {bracket.finalsCutoff || 16} Finals ↓
                  </span>
                  <div style={{ height: '2px', flex: 1, background: `linear-gradient(to left, transparent, ${primaryColor}88)` }} />
                </div>

                {/* Stage 2: Top C Finals */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Top {bracket.finalsCutoff || 16} Finals
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Single Elimination Championship Tree to Tournament Champion
                    </span>
                  </div>
                  {renderCanvas(layoutChampionship!, championshipRounds, false, true, championPlayer)}
                </div>
              </div>
            </div>
          ) : isAcceleratedHybrid && activeHybridTab === 'qualifiers' && combinedBounds ? (
            <div
              style={{
                width: `${Math.ceil(combinedBounds.qualW * fitScale)}px`,
                height: `${Math.ceil(combinedBounds.qualH * fitScale)}px`,
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: `${combinedBounds.qualW}px`,
                  minHeight: `${combinedBounds.qualH}px`,
                  transform: `scale(${fitScale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                {renderQualifierPodGrid()}
              </div>
            </div>
          ) : (
            <div
              style={{
                width: `${Math.ceil(layout.totalWidth * fitScale)}px`,
                height: `${Math.ceil(layout.totalHeight * fitScale)}px`,
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: `${layout.totalWidth}px`,
                  height: `${layout.totalHeight}px`,
                  transform: `scale(${fitScale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                {isAcceleratedHybrid ? (
                  activeHybridTab === 'accel' ? (
                    renderCanvas(layoutAccel!, accelRounds, true, false, null)
                  ) : activeHybridTab === 'premerge' ? (
                    renderCanvas(layoutPreMerge!, preMergeRounds, true, false, null)
                  ) : activeHybridTab === 'upper' ? (
                    renderCanvas(layoutPreMergeUpper!, preUpperRounds, true, false, null)
                  ) : activeHybridTab === 'lower' ? (
                    renderCanvas(layoutLowerBracket!, lowerBracketRounds, true, false, null)
                  ) : (
                    renderCanvas(layoutChampionship!, championshipRounds, false, true, championPlayer)
                  )
                ) : (
                  renderCanvas(layout, rounds, false, false, championPlayer)
                )}
              </div>
            </div>
          )}
        </div>
      ) : activeHybridTab === 'combined' && isAcceleratedHybrid ? (
        /* All Stages (Combined): Phase 1 (3 Pods) + Phase 2 (Championship Tree) */
        <div
          ref={combinedContentRef}
          style={{
            width: '100%',
            padding: isObsMode ? '0.5rem' : '1.25rem 1.75rem',
            paddingBottom: '100px',
            overflowX: 'auto',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2.5rem',
            alignItems: 'flex-start',
          }}
        >
          {/* Stage 1: Early Rounds (3 Pods) */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Early Rounds (3 Pods)
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Accelerated Round • Upper Bracket • Lower Bracket
              </span>
            </div>
            {renderQualifierPodGrid()}
          </div>

          {/* Phase 1 to Phase 2 Divider */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(to right, transparent, ${primaryColor}88)` }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: primaryColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Top {bracket.finalsCutoff || 16} Finals ↓
            </span>
            <div style={{ height: '2px', flex: 1, background: `linear-gradient(to left, transparent, ${primaryColor}88)` }} />
          </div>

          {/* Stage 2: Top C Finals */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Top {bracket.finalsCutoff || 16} Finals
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Single Elimination Championship Tree to Tournament Champion
              </span>
            </div>
            {renderCanvas(layoutChampionship!, championshipRounds, false, true, championPlayer)}
          </div>
        </div>
      ) : (
        /* Standalone View for Selected Stage */
        <div
          style={{
            width: '100%',
            padding: isObsMode ? '0.5rem' : '0.75rem 1.5rem',
            overflowX: 'auto',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          {isAcceleratedHybrid ? (
            activeHybridTab === 'championship' ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                {renderCanvas(layoutChampionship!, championshipRounds, false, true, championPlayer)}
              </div>
            ) : activeHybridTab === 'accel' ? (
              renderCanvas(layoutAccel!, accelRounds, true, false, null)
            ) : activeHybridTab === 'premerge' ? (
              renderCanvas(layoutPreMerge!, preMergeRounds, true, false, null)
            ) : activeHybridTab === 'upper' ? (
              renderCanvas(layoutPreMergeUpper!, preUpperRounds, true, false, null)
            ) : activeHybridTab === 'lower' ? (
              renderCanvas(layoutLowerBracket!, lowerBracketRounds, true, false, null)
            ) : (
              renderQualifierPodGrid()
            )
          ) : (
            renderCanvas(layout, rounds, false, false, championPlayer)
          )}
        </div>
      )}

      {/* Drawers & Modals */}
      {selectedMatch && canManage && (
        <MatchScoreDrawer
          isOpen={true}
          onClose={() => setSelectedMatch(null)}
          tournamentId={tournament.id}
          tierId={tier.id}
          match={selectedMatch.match}
          matchScoreRecord={tournament.matchScores[selectedMatch.match.id]}
          roundName={selectedMatch.roundName}
        />
      )}

      {selectedMatch && !canManage && (
        <MatchTelemetryModal
          isOpen={true}
          onClose={() => setSelectedMatch(null)}
          tournament={tournament}
          tier={tier}
          match={selectedMatch.match}
          matchScoreRecord={tournament.matchScores[selectedMatch.match.id]}
          roundName={selectedMatch.roundName}
          onSelectPlayer={(pId) => {
            setSelectedMatch(null);
            handlePlayerClick(pId);
          }}
        />
      )}

      {selectedPlayerForDrawer && (
        <PlayerDetailDrawer
          isOpen={isPlayerDrawerOpen}
          onClose={() => {
            setIsPlayerDrawerOpen(false);
            setSelectedPlayerForDrawer(null);
          }}
          player={selectedPlayerForDrawer}
          tournament={tournament}
          tier={tier}
        />
      )}
    </div>
  );
};
