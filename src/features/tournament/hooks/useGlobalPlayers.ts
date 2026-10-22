import { useTournament } from '../store';
import type { PlayerProfile } from '../types';

export interface GlobalPlayersHook {
  globalPlayers: PlayerProfile[];
  addGlobalPlayer: (player: Omit<PlayerProfile, 'id'>) => PlayerProfile;
  updateGlobalPlayer: (playerId: string, updates: Partial<PlayerProfile>) => void;
  deleteGlobalPlayer: (playerId: string) => Promise<{ success: boolean; error?: string }>;
  clearAllGlobalPlayers: () => Promise<void>;
  generateFakeGlobalPlayers: (count: number) => PlayerProfile[];
  importPlayersToTournament: (tournamentId: string, players: PlayerProfile[]) => void;
  removePlayerFromTournament: (
    tournamentId: string,
    playerId: string
  ) => { success: boolean; error?: string };
  addPlayerToPool: (tournamentId: string, player: Omit<PlayerProfile, 'id'>) => PlayerProfile;
  updatePlayerInPool: (tournamentId: string, playerId: string, updates: Partial<PlayerProfile>) => void;
}

export function useGlobalPlayers(): GlobalPlayersHook {
  const store = useTournament();
  return {
    globalPlayers: store.globalPlayers,
    addGlobalPlayer: store.addGlobalPlayer,
    updateGlobalPlayer: store.updateGlobalPlayer,
    deleteGlobalPlayer: store.deleteGlobalPlayer,
    clearAllGlobalPlayers: store.clearAllGlobalPlayers,
    generateFakeGlobalPlayers: store.generateFakeGlobalPlayers,
    importPlayersToTournament: store.importPlayersToTournament,
    removePlayerFromTournament: store.removePlayerFromTournament,
    addPlayerToPool: store.addPlayerToPool,
    updatePlayerInPool: store.updatePlayerInPool,
  };
}
