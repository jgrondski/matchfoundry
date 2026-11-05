import React from 'react';
import type { Playstyle } from '../types';
import type { GlobalStandingRow } from '../standings';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { Card } from '../../../components/ui';
import {
  StandingGameScoreAvg,
  StandingMatchRecord,
  StandingQualDelta,
  StandingStageReached,
  getStandingRowAccent,
} from './FinalStandingsTable';

export interface FinalStandingsCardListProps {
  rows: GlobalStandingRow[];
  isObsMode: boolean;
  onSelectPlayer: (pId: string, pName: string, country?: string, playstyle?: Playstyle) => void;
}

/** Phone layout of the final standings: one card per competitor, same data as the table rows. */
export const FinalStandingsCardList: React.FC<FinalStandingsCardListProps> = ({ rows, isObsMode, onSelectPlayer }) => (
  <ul className="flex flex-col gap-2">
    {rows.map(row => {
      const { tierColor } = getStandingRowAccent(row);
      const name = getEffectivePlayerName(row.player);
      const content = (
        <>
          {/* Line 1: rank, flag and name, stage reached */}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 font-mono text-base font-black text-fg">{row.finalRank}</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <PlayerAvatar player={row.player} className="shrink-0" />
              <span className="min-w-0 truncate font-bold text-white">{name}</span>
            </div>
            <span className="shrink-0">
              <StandingStageReached row={row} tierColor={tierColor} />
            </span>
          </div>

          {/* Line 2: qual seed and delta, match record, game score average */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <StandingQualDelta row={row} tierColor={tierColor} showQualScore={false} />
            <StandingMatchRecord row={row} />
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
              Avg <StandingGameScoreAvg row={row} tierColor={tierColor} />
            </span>
          </div>
        </>
      );
      return (
        <li key={row.player.id}>
          <Card padding="sm">
            {isObsMode ? (
              <div className="flex flex-col gap-1.5">{content}</div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectPlayer(row.player.id, name, row.player.country, row.player.playstyle)}
                className="flex w-full cursor-pointer flex-col gap-1.5 border-0 bg-transparent p-0 text-left"
                title="View Competitor"
              >
                {content}
              </button>
            )}
          </Card>
        </li>
      );
    })}
  </ul>
);
