import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Card, IconButton } from '../../../components/ui';
import { PlayerProfile } from '../../tournament/types';
import { PlaystyleChip } from './PlaystyleChip';
import { CountryFlag } from '../flagUtils';
import { formatPersonalBest, PlayerStatusBadge } from './PlayerDirectorySections';

export interface PlayerDirectoryCardListProps {
  players: PlayerProfile[];
  onEditPlayer: (player: PlayerProfile) => void;
  onDeletePlayer: (player: PlayerProfile) => void;
}

/** Phone layout of the global player directory table (/players). */
export const PlayerDirectoryCardList: React.FC<PlayerDirectoryCardListProps> = ({
  players,
  onEditPlayer,
  onDeletePlayer,
}) => (
  <ul className="flex flex-col gap-2">
    {players.map((player, idx) => (
      <li key={player.id}>
        <Card padding="sm" className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-fg-muted tabular-nums">{idx + 1}</span>
            {player.country && <CountryFlag country={player.country} />}
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-fg">{player.name}</span>
            <IconButton aria-label="Edit Competitor" onClick={() => onEditPlayer(player)}>
              <Edit2 size={16} />
            </IconButton>
            <IconButton
              aria-label="Delete Competitor"
              onClick={() => onDeletePlayer(player)}
              className="text-red"
            >
              <Trash2 size={16} />
            </IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <PlaystyleChip style={player.playstyle} />
            <span className="text-fg-muted">PB</span>
            <span className="font-mono font-bold text-fg">{formatPersonalBest(player.personalBest)}</span>
            <PlayerStatusBadge />
          </div>
          {player.notes && (
            <p className="m-0 line-clamp-2 text-xs text-fg-secondary">{player.notes}</p>
          )}
        </Card>
      </li>
    ))}
  </ul>
);
