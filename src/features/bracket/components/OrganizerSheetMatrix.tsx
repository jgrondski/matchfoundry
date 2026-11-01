import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tournament, TournamentTier, PlayerProfile } from '../../tournament/types';
import { BracketMatch, canonicalizeBracketRounds } from '../types';
import { MatchScoreDrawer } from './MatchScoreDrawer';
import {
  colorWithAlpha,
  getDefaultTierColors,
  getAlternateShade,
} from '../colorUtils';
import { PlayerDetailDrawer } from '../../qualifiers/components/PlayerDetailDrawer';
import {
  SheetDensitySize,
  SHEET_SIZE_CONFIG,
  getEffectiveRoundGameCount,
  getAbbreviatedRoundName,
  getMatchStatus,
  getInheritedRoundBestOf,
} from '../sheetUtils';
import { SheetTelemetryBar } from './sheet/SheetTelemetryBar';
import { SheetMatchRow } from './sheet/SheetMatchRow';
import { cn } from '../../../components/ui';
import { LOWER_BRACKET_COLOR } from '../../../theme/palette';

// Re-export utilities so existing tests and callers have zero breaking changes
export {
  getAbbreviatedRoundName,
  getMatchStatus,
  getInheritedRoundBestOf,
  getEffectiveRoundGameCount,
  SHEET_SIZE_CONFIG,
};
export type { SheetDensitySize, SheetSizeTokens } from '../sheetUtils';

interface OrganizerSheetMatrixProps {
  tournament: Tournament;
  tier: TournamentTier;
}

export const OrganizerSheetMatrix: React.FC<OrganizerSheetMatrixProps> = ({ tournament, tier }) => {
  const [sheetSize, setSheetSize] = useState<SheetDensitySize>(() => {
    try {
      const stored = localStorage.getItem(`tournament_matrix_size_${tier.id}`);
      if (stored === 'xs' || stored === 'sm' || stored === 'md' || stored === 'lg') {
        return stored;
      }
    } catch {
      // Ignore
    }
    return 'md';
  });

  const handleSizeChange = (newSize: SheetDensitySize) => {
    setSheetSize(newSize);
    try {
      localStorage.setItem(`tournament_matrix_size_${tier.id}`, newSize);
    } catch {
      // Ignore
    }
  };

  const sizeTokens = SHEET_SIZE_CONFIG[sheetSize];

  const [competitorColWidth, setCompetitorColWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`tournament_matrix_col_w_${tier.id}`);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 120 && parsed <= 500) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return 210;
  });

  const [isResizingCol, setIsResizingCol] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(210);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingCol(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = competitorColWidth;
  };

  const handleResizeTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      setIsResizingCol(true);
      resizeStartXRef.current = e.touches[0].clientX;
      resizeStartWidthRef.current = competitorColWidth;
    }
  };

  const handleResetColWidth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCompetitorColWidth(210);
    try {
      localStorage.setItem(`tournament_matrix_col_w_${tier.id}`, '210');
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!isResizingCol) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartXRef.current;
      const nextWidth = Math.max(120, Math.min(500, resizeStartWidthRef.current + deltaX));
      setCompetitorColWidth(nextWidth);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - resizeStartXRef.current;
        const nextWidth = Math.max(120, Math.min(500, resizeStartWidthRef.current + deltaX));
        setCompetitorColWidth(nextWidth);
      }
    };

    const onMouseUp = () => {
      setIsResizingCol(false);
      try {
        localStorage.setItem(`tournament_matrix_col_w_${tier.id}`, String(competitorColWidth));
      } catch {
        // Ignore
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [isResizingCol, competitorColWidth, tier.id]);

  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [hoveredPlayerKey, setHoveredPlayerKey] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<{ match: BracketMatch; roundName: string } | null>(null);

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);

  const handlePlayerClick = (pId: string) => {
    // Only registered competitors have a profile; draft placeholder seeds ("Seed N") are not players
    const profile = (tournament.playersPool || []).find(p => p.id === pId);
    if (!profile) return;
    setSelectedPlayer(profile);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETE' | string[]>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const allRounds = useMemo(() => {
    if (tier.bracket?.rounds) {
      canonicalizeBracketRounds(tier.bracket.rounds);
    }
    return tier.bracket?.rounds || [];
  }, [tier.bracket?.rounds]);

  const roundNames = useMemo(() => allRounds.map(r => r.name), [allRounds]);

  const filteredRounds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allRounds.map(round => {
      const matches = round.matches.filter(m => {
        const record = tournament.matchScores[m.id];
        const status = getMatchStatus(m, record);

        if (selectedRoundFilter === 'IN_PROGRESS' && status.type !== 'in_progress') return false;
        if (selectedRoundFilter === 'COMPLETE' && status.type !== 'complete') return false;
        if (Array.isArray(selectedRoundFilter) && !selectedRoundFilter.includes(round.name)) return false;

        if (term) {
          const mNum = String(m.matchNumber || '');
          const p1 = (m.player1.player?.name || '').toLowerCase();
          const p2 = (m.player2.player?.name || '').toLowerCase();
          const matchNumMatch = mNum === term || `#${mNum}` === term;
          const playerMatch = p1.includes(term) || p2.includes(term);
          if (!matchNumMatch && !playerMatch) return false;
        }

        return true;
      });

      return {
        ...round,
        filteredMatches: matches,
      };
    }).filter(r => r.filteredMatches.length > 0);
  }, [allRounds, tournament.matchScores, searchTerm, selectedRoundFilter]);

  const telemetry = useMemo(() => {
    let total = 0;
    let completed = 0;
    let inProgress = 0;

    for (const r of allRounds) {
      for (const m of r.matches) {
        if (!m.isBye) {
          total++;
          const status = getMatchStatus(m, tournament.matchScores[m.id]);
          if (status.type === 'complete') completed++;
          else if (status.type === 'in_progress') inProgress++;
        }
      }
    }

    return { total, completed, inProgress };
  }, [allRounds, tournament.matchScores]);

  const toggleRoundFilter = (roundName: string) => {
    if (selectedRoundFilter === 'ALL' || selectedRoundFilter === 'IN_PROGRESS' || selectedRoundFilter === 'COMPLETE') {
      setSelectedRoundFilter([roundName]);
    } else {
      const next = selectedRoundFilter.filter(r => r !== roundName);
      if (next.length === selectedRoundFilter.length) {
        setSelectedRoundFilter([...selectedRoundFilter, roundName]);
      } else {
        setSelectedRoundFilter(next.length === 0 ? 'ALL' : next);
      }
    }
  };

  const defaults = getDefaultTierColors(tier);
  const primaryColor = tier.primaryColor || defaults.primaryColor;
  const secondaryColor = tier.secondaryColor || defaults.secondaryColor;
  const cardColor = tier.cardColor || defaults.cardColor;
  const textColor = tier.textColor || defaults.textColor;
  const lowerBracketColor = tier.lowerBracketColor || defaults.lowerBracketColor || LOWER_BRACKET_COLOR;

  const maxGameColumns = useMemo(() => {
    let maxCols = tier.bestOf || 5;
    for (const r of filteredRounds) {
      const { effectiveGameCount } = getEffectiveRoundGameCount(r, tier, tournament.matchScores);
      if (effectiveGameCount > maxCols) maxCols = effectiveGameCount;
    }
    return maxCols;
  }, [filteredRounds, tier, tournament.matchScores]);

  const gameNumbers = useMemo(() => {
    return Array.from({ length: maxGameColumns }, (_, i) => i + 1);
  }, [maxGameColumns]);

  const totalColCount = 4 + gameNumbers.length;

  const maxTableWidth = useMemo(() => {
    const computed =
      sizeTokens.colMatch +
      competitorColWidth +
      sizeTokens.colGamesWon +
      maxGameColumns * sizeTokens.colGame +
      sizeTokens.colComplete +
      2;
    return Math.max(760, computed);
  }, [maxGameColumns, competitorColWidth, sizeTokens]);

  const thClass = cn(
    sizeTokens.thPadding,
    'font-bold uppercase tracking-wide whitespace-nowrap border-r border-white/5'
  );

  return (
    <div
      className="flex flex-col gap-3.5 max-w-full mx-auto items-center"
      style={{ width: `${maxTableWidth}px` }}
    >
      <SheetTelemetryBar
        tournamentName={tournament.name}
        tierName={tier.name}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        cardColor={cardColor}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        selectedRoundFilter={selectedRoundFilter}
        isFilterDropdownOpen={isFilterDropdownOpen}
        onToggleFilterDropdown={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
        onSelectFilterPreset={preset => {
          setSelectedRoundFilter(preset);
          setIsFilterDropdownOpen(false);
        }}
        onToggleRoundFilter={toggleRoundFilter}
        roundNames={roundNames}
        telemetry={telemetry}
        sheetSize={sheetSize}
        onSizeChange={handleSizeChange}
      />

      {/* Continuous Master Sheet Matrix Table */}
      <div
        className="rounded-md overflow-x-auto w-full"
        style={{
          background: cardColor,
          border: `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'var(--color-line)')}`,
        }}
      >
        {filteredRounds.length === 0 ? (
          <div className="py-12 px-6 text-center text-fg-secondary">
            <p className="m-0 text-sm">No matches found matching your filters.</p>
          </div>
        ) : (
          <table
            className="w-full border-separate border-spacing-0 table-fixed"
            style={{ fontSize: sizeTokens.fontSizeTable }}
          >
            <thead>
              <tr
                style={{
                  background: getAlternateShade(cardColor, 7),
                  borderBottom: `2px solid ${colorWithAlpha(secondaryColor, 0.6, 'var(--color-line)')}`,
                }}
              >
                <th
                  className={cn(thClass, 'text-center px-1')}
                  style={{
                    fontSize: sizeTokens.fontSizeTh,
                    width: `${sizeTokens.colMatch}px`,
                    minWidth: `${sizeTokens.colMatch}px`,
                    maxWidth: `${sizeTokens.colMatch}px`,
                    color: textColor,
                  }}
                >
                  Match #
                </th>
                <th
                  className={cn(thClass, 'text-left relative', isResizingCol ? 'select-none' : 'select-auto')}
                  style={{
                    fontSize: sizeTokens.fontSizeTh,
                    width: `${competitorColWidth}px`,
                    minWidth: `${competitorColWidth}px`,
                    maxWidth: `${competitorColWidth}px`,
                    paddingLeft: `${sizeTokens.competitorLeftPad}px`,
                    color: textColor,
                  }}
                >
                  <span>Competitor</span>

                  {/* Google Sheet Style Resizer Handle */}
                  <div
                    onMouseDown={handleResizeMouseDown}
                    onTouchStart={handleResizeTouchStart}
                    onDoubleClick={handleResetColWidth}
                    title="Drag to adjust column width (double-click to reset)"
                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center touch-none select-none"
                  >
                    <div
                      className={cn(
                        'h-[65%] rounded-2xs transition-all duration-100',
                        isResizingCol ? 'w-0.75' : 'w-0.5'
                      )}
                      style={{
                        background: isResizingCol
                          ? primaryColor
                          : colorWithAlpha(secondaryColor, 0.7, 'var(--color-line)'),
                        boxShadow: isResizingCol ? `0 0 6px ${primaryColor}` : 'none',
                      }}
                    />
                  </div>
                </th>
                <th
                  className={cn(thClass, 'text-center pr-3.5')}
                  style={{
                    fontSize: sizeTokens.fontSizeTh,
                    width: `${sizeTokens.colGamesWon}px`,
                    minWidth: `${sizeTokens.colGamesWon}px`,
                    maxWidth: `${sizeTokens.colGamesWon}px`,
                    color: textColor,
                  }}
                >
                  Games Won
                </th>
                {gameNumbers.map((gNum) => (
                  <th
                    key={gNum}
                    className={cn(thClass, 'text-center')}
                    style={{
                      fontSize: sizeTokens.fontSizeTh,
                      width: `${sizeTokens.colGame}px`,
                      minWidth: `${sizeTokens.colGame}px`,
                      maxWidth: `${sizeTokens.colGame}px`,
                      color: textColor,
                    }}
                  >
                    Game {gNum}
                  </th>
                ))}
                <th
                  className={cn(thClass, 'text-center px-1')}
                  style={{
                    fontSize: sizeTokens.fontSizeTh,
                    width: `${sizeTokens.colComplete}px`,
                    minWidth: `${sizeTokens.colComplete}px`,
                    maxWidth: `${sizeTokens.colComplete}px`,
                    color: textColor,
                  }}
                >
                  Complete
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRounds.map((round, roundIdx) => {
                const { inheritedBestOf } = getEffectiveRoundGameCount(round, tier, tournament.matchScores);

                const isLoserRound =
                  round.roundIdentifier?.startsWith('L') ||
                  round.name.toLowerCase().includes('loser') ||
                  round.roundIdentifier === 'PRE_L1' ||
                  round.roundIdentifier === 'PRE_L2' ||
                  round.roundIdentifier === '2C' ||
                  round.roundIdentifier === 'PO';
                const roundAccentColor = isLoserRound ? lowerBracketColor : primaryColor;

                const completedCount = round.filteredMatches.filter(
                  m => getMatchStatus(m, tournament.matchScores[m.id]).type === 'complete'
                ).length;

                return (
                  <React.Fragment key={round.name}>
                    {/* Embedded Round Section Header Row */}
                    <tr key={`header-${round.name}`}>
                      <td
                        colSpan={totalColCount}
                        className={cn(sizeTokens.bannerPadding, 'bg-canvas')}
                        style={{
                          borderTop: roundIdx > 0 ? `2px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-line)')}` : 'none',
                          borderBottom: `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'var(--color-line)')}`,
                          borderLeft: `4px solid ${roundAccentColor}`,
                        }}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="font-extrabold text-fg tracking-wide uppercase"
                              style={{ fontSize: sizeTokens.fontSizeRoundTitle }}
                            >
                              {round.name}
                            </span>
                            <span
                              className="py-0.5 px-2 rounded-sm bg-white/6 border border-line text-fg-secondary font-semibold font-mono"
                              style={{ fontSize: sizeTokens.fontSizeRoundMeta }}
                            >
                              Best of {inheritedBestOf}
                            </span>
                            <span className="text-fg-muted" style={{ fontSize: sizeTokens.fontSizeRoundMeta }}>
                              • {round.filteredMatches.length} {round.filteredMatches.length === 1 ? 'Match' : 'Matches'}
                            </span>
                          </div>
                          <span
                            className="font-mono tabular-nums tracking-tight font-semibold py-0.5 px-2 rounded-full bg-white/6 text-fg-secondary border border-line"
                            style={{ fontSize: sizeTokens.fontSizeRoundMeta }}
                          >
                            {completedCount} / {round.filteredMatches.length} Complete
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Round Matches */}
                    {round.filteredMatches.map((match, matchIdx) => (
                      <SheetMatchRow
                        key={match.id}
                        match={match}
                        matchIdx={matchIdx}
                        round={round}
                        tournament={tournament}
                        tier={tier}
                        inheritedBestOf={inheritedBestOf}
                        effectiveGameCount={maxGameColumns}
                        gameNumbers={gameNumbers}
                        sizeTokens={sizeTokens}
                        competitorColWidth={competitorColWidth}
                        isLoserRound={isLoserRound}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                        cardColor={cardColor}
                        lowerBracketColor={lowerBracketColor}
                        hoveredMatchId={hoveredMatchId}
                        hoveredPlayerKey={hoveredPlayerKey}
                        onHoverMatch={setHoveredMatchId}
                        onHoverPlayer={setHoveredPlayerKey}
                        onSelectMatch={(m, rName) => setSelectedMatch({ match: m, roundName: rName })}
                        onPlayerClick={handlePlayerClick}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Match Score Drawer */}
      {selectedMatch && (
        <MatchScoreDrawer
          isOpen={Boolean(selectedMatch)}
          onClose={() => setSelectedMatch(null)}
          match={selectedMatch.match}
          matchScoreRecord={tournament.matchScores[selectedMatch.match.id]}
          tournamentId={tournament.id}
          tierId={tier.id}
          roundName={selectedMatch.roundName}
        />
      )}

      {/* Competitor Profile Drawer */}
      {selectedPlayer && (
        <PlayerDetailDrawer
          isOpen={Boolean(selectedPlayer)}
          onClose={() => setSelectedPlayer(null)}
          player={selectedPlayer}
          tournament={tournament}
          tier={tier}
        />
      )}
    </div>
  );
};
