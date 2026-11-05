import React from 'react';
import { Edit2, UserX } from 'lucide-react';
import { Card, IconButton } from '../../../components/ui';
import { PlayerProfile } from '../types';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../players/components/PlaystyleChip';
import { getEffectivePlayerName } from '../../players/playerNameUtils';

/** Personal best as the roster shows it, in both the table and the cards. */
export function formatPersonalBest(personalBest: number | undefined | null): string {
  return personalBest ? personalBest.toLocaleString() : '—';
}

export interface RosterCardListProps {
  players: PlayerProfile[];
  onOpenPlayer: (player: PlayerProfile) => void;
  onEditPlayer: (player: PlayerProfile) => void;
  onRemovePlayer: (player: PlayerProfile) => void;
}

/** Phone layout of the tournament roster table (/:slug/manage/players). */
export const RosterCardList: React.FC<RosterCardListProps> = ({
  players,
  onOpenPlayer,
  onEditPlayer,
  onRemovePlayer,
}) => (
  <ul className="flex flex-col gap-2">
    {players.map((player, pIdx) => (
      <li key={player.id}>
        <Card padding="sm" className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-fg-muted tabular-nums">{pIdx + 1}</span>
            <PlayerAvatar player={player} />
            <button
              type="button"
              onClick={() => onOpenPlayer(player)}
              className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-sm font-semibold text-fg"
              title="View Competitor"
            >
              {getEffectivePlayerName(player)}
            </button>
            <IconButton aria-label="Edit Competitor" onClick={() => onEditPlayer(player)}>
              <Edit2 size={16} />
            </IconButton>
            <IconButton aria-label="Remove Competitor" onClick={() => onRemovePlayer(player)} className="text-red">
              <UserX size={16} />
            </IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <PlaystyleChip style={player.playstyle} />
            <span className="text-fg-muted">PB</span>
            <span className="font-mono font-semibold tabular-nums tracking-tight">
              {formatPersonalBest(player.personalBest)}
            </span>
          </div>
        </Card>
      </li>
    ))}
  </ul>
);
