import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Tournament,
  TournamentTier,
  QualifierScore,
  PlayerProfile,
  QualifierSubmission,
  SeedingMethod,
} from './types';
import { canonicalizeBracketRounds } from '../bracket/types';
import { generateDraftBracketsForTournament } from '../qualifiers/scoring';
import {
  generateAdditionalFakePlayers,
} from './simulation';
import { getAuthHeaders, usePinAuth } from '../auth/AuthContext';

interface TournamentContextType {
  tournaments: Tournament[];
  globalPlayers: PlayerProfile[];
  activeTournamentId: string | null;
  activeTournament?: Tournament;
  isLoading: boolean;
  isHydrated: boolean;
  isDbConnected: boolean;
  dbError: string | null;
  checkDbHealth: () => Promise<boolean>;
  retryConnection: () => Promise<void>;
  refreshTournament: (tournamentIdOrSlug: string) => Promise<Tournament | null>;
  apiError?: string | null;
  clearApiError?: () => void;
  simulateSampleTournament: () => Promise<Tournament | undefined>;
  setActiveTournamentId: (id: string | null) => void;
  getTournamentBySlug: (slug: string) => Tournament | undefined;
  getTierBySlug: (
    tournamentSlug: string,
    tierSlug: string
  ) => { tournament: Tournament; tier: TournamentTier } | undefined;
  createTournament: (
    data: Omit<
      Tournament,
      'id' | 'matchScores' | 'playersPool' | 'qualifierSubmissions' | 'tournamentPlayers'
    >
  ) => Promise<Tournament>;
  updateTournament: (tournamentId: string, updates: Partial<Tournament>) => Promise<Tournament | null>;
  saveTiers: (tournamentId: string, tiers: TournamentTier[]) => Promise<Tournament | null>;
  addPlayerToPool: (tournamentId: string, player: Omit<PlayerProfile, 'id'>) => PlayerProfile;
  updatePlayerInPool: (tournamentId: string, playerId: string, updates: Partial<PlayerProfile>) => void;
  submitQualifierScore: (tournamentId: string, playerId: string, score: number, playerName?: string) => Promise<Tournament | null>;
  deleteQualifierScore: (tournamentId: string, submissionId: string) => Promise<Tournament | null>;
  togglePlayerDisqualification: (
    tournamentId: string,
    playerId: string,
    isDisqualified: boolean
  ) => void;
  setOnlineQualsOpen: (tournamentId: string, open: boolean) => Promise<boolean>;
  testDiscordWebhook: (tournamentId: string, url?: string) => Promise<{ ok: boolean; message: string }>;
  togglePlayerQualsCompleted: (
    tournamentId: string,
    playerId: string,
    qualsCompleted: boolean
  ) => void;
  togglePlayerQualifierVerified: (
    tournamentId: string,
    playerId: string,
    isVerified?: boolean
  ) => void;
  lockTournament: (tournamentId: string) => Promise<Tournament | null>;
  unlockBrackets: (tournamentId: string) => Promise<{ success: boolean; error?: string }>;
  recordGameScore: (
    tournamentId: string,
    tierId: string,
    matchId: string,
    gameNumber: number,
    p1Points: number | null,
    p2Points: number | null,
    declaredWinnerId?: string | null
  ) => Promise<Tournament | null>;
  saveMatchScores: (
    tournamentId: string,
    tierId: string,
    matchId: string,
    scoredGames: Array<{
      gameNumber: number;
      player1Points: number | null;
      player2Points: number | null;
      winnerPlayerId: string | null;
    }>,
    hasTiebreaker?: boolean
  ) => Promise<Tournament | null>;
  updateMatchBestOf: (tournamentId: string, tierId: string, matchId: string, bestOf: number) => Promise<Tournament | null>;
  forfeitMatch: (tournamentId: string, tierId: string, matchId: string, winnerPlayerId: string) => Promise<Tournament | null>;
  addQualifierScore: (tournamentId: string, entry: Omit<QualifierScore, 'id' | 'totalScore'>) => void;
  verifyQualifierScore: (tournamentId: string, qualifierId: string, verified: boolean) => void;
  clearMatchScores: (tournamentId: string) => Promise<Tournament | null>;
  clearQualifierScores: (tournamentId: string) => Promise<Tournament | null>;
  clearAllTournamentData: (tournamentId: string) => Promise<Tournament | null>;
  seedQualifiers: (tournamentId: string) => Promise<Tournament | null>;
  simulateFullTournament: (tournamentId: string) => Promise<Tournament | null>;
  deleteTournament: (tournamentId: string) => Promise<boolean>;
  addGlobalPlayer: (player: Omit<PlayerProfile, 'id'>) => PlayerProfile;
  updateGlobalPlayer: (playerId: string, updates: Partial<PlayerProfile>) => void;
  deleteGlobalPlayer: (playerId: string) => Promise<{ success: boolean; error?: string }>;
  clearAllGlobalPlayers: () => Promise<void>;
  generateFakeGlobalPlayers: (count: number) => PlayerProfile[];
  refreshGlobalPlayers: () => Promise<void>;
  refreshAllTournaments: () => Promise<void>;
  importPlayersToTournament: (tournamentId: string, players: PlayerProfile[]) => void;
  removePlayerFromTournament: (
    tournamentId: string,
    playerId: string
  ) => { success: boolean; error?: string };
  swapMatchSlots: (
    tournamentId: string,
    tierId: string,
    payload: {
      sourceMatchId: string;
      sourceSlot: 1 | 2;
      targetMatchId: string;
      targetSlot: 1 | 2;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  setSeedingMethod: (tournamentId: string, method: SeedingMethod) => void;
  setManualSeeds: (tournamentId: string, playerIds: string[]) => void;
  reorderManualSeed: (tournamentId: string, fromIndex: number, toIndex: number) => void;
  shuffleManualSeeds: (tournamentId: string) => void;
  addManualSeed: (tournamentId: string, playerId: string) => void;
  removeManualSeed: (tournamentId: string, playerId: string) => void;
  batchMoveManualSeeds: (tournamentId: string, playerIds: string[], direction: 'UP' | 'DOWN') => void;
  batchJumpManualSeeds: (tournamentId: string, playerIds: string[], targetSeed: number) => void;
  batchRemoveManualSeeds: (tournamentId: string, playerIds: string[]) => void;
  batchAddManualSeeds: (tournamentId: string, playerIds: string[], position: 'TOP' | 'BOTTOM') => void;
}

/**

 * Generates an RFC4122 v4 compliant UUID string.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Shifts clusters of selected seeds UP or DOWN.
 * Non-contiguous items move independently by 1 step (e.g. 3, 6, 9 -> 2, 5, 8).
 * Contiguous blocks shift together as a cluster, displacing the adjacent boundary item.
 */
export function shiftSeedsCluster(
  seeds: string[],
  playerIds: string[],
  direction: 'UP' | 'DOWN'
): string[] {
  if (!seeds || seeds.length <= 1 || !playerIds || playerIds.length === 0) {
    return seeds ? [...seeds] : [];
  }

  const selectedSet = new Set(playerIds);
  const result = [...seeds];

  if (direction === 'UP') {
    let i = 0;
    while (i < result.length) {
      if (selectedSet.has(result[i])) {
        const start = i;
        while (i < result.length && selectedSet.has(result[i])) {
          i++;
        }
        const end = i - 1;

        if (start > 0) {
          // Shift cluster up by 1, displacing the item at start - 1 to end
          const displaced = result[start - 1];
          for (let k = start; k <= end; k++) {
            result[k - 1] = result[k];
          }
          result[end] = displaced;
        }
      } else {
        i++;
      }
    }
  } else {
    // DOWN
    let i = result.length - 1;
    while (i >= 0) {
      if (selectedSet.has(result[i])) {
        const end = i;
        while (i >= 0 && selectedSet.has(result[i])) {
          i--;
        }
        const start = i + 1;

        if (end < result.length - 1) {
          // Shift cluster down by 1, displacing the item at end + 1 to start
          const displaced = result[end + 1];
          for (let k = end; k >= start; k--) {
            result[k + 1] = result[k];
          }
          result[start] = displaced;
        }
      } else {
        i--;
      }
    }
  }

  return result;
}

/**
 * Bunches selected seeds contiguously at the target seed in their existing relative order.
 * E.g., selecting 3, 6, 9 and jumping to 1 produces 1, 2, 3 (from 3, 6, 9 respectively).
 */
export function jumpSeedsBunched(
  seeds: string[],
  playerIds: string[],
  targetSeed: number
): string[] {
  if (!seeds || seeds.length <= 1 || !playerIds || playerIds.length === 0) {
    return seeds ? [...seeds] : [];
  }

  const selectedSet = new Set(playerIds);
  const selectedOrdered = seeds.filter(id => selectedSet.has(id));
  const remaining = seeds.filter(id => !selectedSet.has(id));

  const targetIndex = targetSeed - 1;
  const clampedIndex = Math.max(0, Math.min(targetIndex, remaining.length));

  return [
    ...remaining.slice(0, clampedIndex),
    ...selectedOrdered,
    ...remaining.slice(clampedIndex),
  ];
}

export const TournamentContext = createContext<TournamentContextType | null>(null);

async function apiCall(endpoint: string, options: RequestInit = {}) {
  if (typeof fetch === 'undefined') return null;
  const authHeaders = getAuthHeaders();
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };
  const res = await fetch(endpoint, {
    ...options,
    headers: mergedHeaders,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    const msg = errorData.error || `HTTP ${res.status}`;
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint} failed:`, msg);
    throw new Error(msg);
  }
  return await res.json();
}

export const TournamentProvider: React.FC<{
  children: React.ReactNode;
  initialTournaments?: Tournament[];
  initialHydrated?: boolean;
}> = ({ children, initialTournaments, initialHydrated }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments || []);
  const [globalPlayers, setGlobalPlayers] = useState<PlayerProfile[]>([]);
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialHydrated);
  const [isHydrated, setIsHydrated] = useState<boolean>(initialHydrated ?? false);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const clearApiError = () => setApiError(null);

  const checkDbHealth = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'ok') {
        setIsDbConnected(true);
        setDbError(null);
        return true;
      } else {
        setIsDbConnected(false);
        setDbError(data.error || 'PostgreSQL database is currently disconnected.');
        return false;
      }
    } catch (err: any) {
      setIsDbConnected(false);
      setDbError(err.message || 'Cannot reach API server');
      return false;
    }
  };

  const retryConnection = async (): Promise<void> => {
    const ok = await checkDbHealth();
    if (ok) {
      setIsLoading(true);
      try {
        const [tourneys, players] = await Promise.all([
          apiCall('/api/tournaments').catch(() => []),
          apiCall('/api/players').catch(() => []),
        ]);
        if (Array.isArray(tourneys)) setTournaments(tourneys);
        if (Array.isArray(players)) setGlobalPlayers(players);
      } finally {
        setIsLoading(false);
        setIsHydrated(true);
      }
    }
  };

  const refreshTournament = useCallback(async (tournamentIdOrSlug: string): Promise<Tournament | null> => {
    if (typeof fetch === 'undefined') return null;
    try {
      const fresh = await apiCall(`/api/tournaments/${tournamentIdOrSlug}`);
      if (fresh && fresh.id) {
        setIsDbConnected(true);
        setDbError(null);
        setTournaments(prev => {
          const matchIndex = prev.findIndex(
            t => t.id === fresh.id || (fresh.slug && t.slug === fresh.slug)
          );
          if (matchIndex >= 0) {
            const next = [...prev];
            next[matchIndex] = fresh;
            return next;
          }
          return [fresh, ...prev];
        });

        // Sync updated & new players into globalPlayers
        if (Array.isArray(fresh.playersPool)) {
          setGlobalPlayers(prev => {
            const freshMap = new Map(fresh.playersPool.map((p: PlayerProfile) => [p.id, p]));
            const existingIds = new Set(prev.map(p => p.id));
            const updatedPrev = prev.map(p => freshMap.get(p.id) || p);
            const toAdd = fresh.playersPool.filter((p: PlayerProfile) => !existingIds.has(p.id));
            return toAdd.length > 0 ? [...updatedPrev, ...toAdd] : updatedPrev;
          });
        }
        return fresh;
      }
      return null;
    } catch (err: any) {
      console.warn(`[Store] Failed to refresh tournament "${tournamentIdOrSlug}":`, err);
      return null;
    }
  }, []);

  // Reloads the full tournament list (e.g. the front page picking up quals opened elsewhere).
  const refreshAllTournaments = useCallback(async (): Promise<void> => {
    if (typeof fetch === 'undefined') return;
    try {
      const tourneys = await apiCall('/api/tournaments');
      if (Array.isArray(tourneys)) setTournaments(tourneys);
    } catch (err) {
      console.error('Failed to reload tournaments:', err);
    }
  }, []);

  const refreshGlobalPlayers = useCallback(async (): Promise<void> => {
    if (typeof fetch === 'undefined') return;
    try {
      const players = await apiCall('/api/players');
      if (Array.isArray(players)) {
        setGlobalPlayers(players);
      }
    } catch (err: any) {
      console.warn('[Store] Failed to refresh global players:', err);
    }
  }, []);

  const syncTournamentToApi = async (tourney: Tournament): Promise<Tournament | null> => {
    try {
      const saved = await apiCall(`/api/tournaments/${tourney.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tourney),
      });
      if (saved && saved.id) {
        setIsDbConnected(true);
        setDbError(null);
        setTournaments(prev => {
          const matchIndex = prev.findIndex(
            t =>
              t.id === saved.id ||
              (saved.slug && t.slug === saved.slug) ||
              t.id === tourney.id ||
              (tourney.slug && t.slug === tourney.slug)
          );
          if (matchIndex >= 0) {
            const next = [...prev];
            next[matchIndex] = saved;
            return next.filter((t, i) => i === matchIndex || t.id !== saved.id);
          }
          return [saved, ...prev.filter(t => t.id !== saved.id)];
        });
        console.log(`[Store] Tournament "${saved.name}" synced to database successfully.`);
        return saved;
      }
      return null;
    } catch (err: any) {
      console.error(`[Store] Database sync error for "${tourney.name}":`, err);
      setApiError(`Database sync error for "${tourney.name}": ${err.message}`);
      setIsDbConnected(false);
      setDbError(err.message);
      return null;
    }
  };

  // Hydrate initial state from PostgreSQL via API
  useEffect(() => {
    if (initialHydrated) return;
    let isMounted = true;
    async function hydrate() {
      setIsLoading(true);
      try {
        const isHealthy = await checkDbHealth();
        if (!isHealthy) {
          console.warn('[Store] Database health check failed. PostgreSQL is offline.');
          return;
        }
        const [tourneys, players] = await Promise.all([
          apiCall('/api/tournaments').catch(err => {
            console.error('Failed to load tournaments from DB:', err);
            setIsDbConnected(false);
            setDbError(err.message);
            return [];
          }),
          apiCall('/api/players').catch(err => {
            console.error('Failed to load players from DB:', err);
            return [];
          }),
        ]);
        if (isMounted) {
          if (Array.isArray(tourneys)) {
            setTournaments(tourneys);
          }
          if (Array.isArray(players)) {
            setGlobalPlayers(players);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsHydrated(true);
        }
      }
    }
    hydrate();
    return () => {
      isMounted = false;
    };
  }, []);

  // Signing in or out changes which fields the API returns (webhook URLs are only sent to managers),
  // so reload tournaments when the session changes after the initial hydrate.
  const { session } = usePinAuth();
  const authToken = session?.token;
  const lastAuthTokenRef = useRef(authToken);
  useEffect(() => {
    if (lastAuthTokenRef.current === authToken) return;
    lastAuthTokenRef.current = authToken;
    void refreshAllTournaments();
  }, [authToken, refreshAllTournaments]);

  const simulateSampleTournament = async (): Promise<Tournament | undefined> => {
    setIsLoading(true);
    try {
      const res = await apiCall('/api/simulate/sample', { method: 'POST' });
      if (res && res.id) {
        setTournaments(prev => [res, ...prev.filter(t => t.id !== res.id && t.slug !== res.slug)]);
        setActiveTournamentId(res.id);
        return res;
      }
    } finally {
      setIsLoading(false);
    }
    return undefined;
  };

  const activeTournament = tournaments.find(
    t => t.id === activeTournamentId || t.slug === activeTournamentId
  );
  if (activeTournament) {
    activeTournament.tiers.forEach(tier => {
      if (tier.bracket?.rounds) {
        canonicalizeBracketRounds(tier.bracket.rounds);
      }
    });
  }

  const getTournamentBySlug = (slug: string) => {
    const t = tournaments.find(t => t.slug === slug || t.id === slug);
    if (t) {
      t.tiers.forEach(tier => {
        if (tier.bracket?.rounds) {
          canonicalizeBracketRounds(tier.bracket.rounds);
        }
      });
    }
    return t;
  };

  const getTierBySlug = (tournamentSlug: string, tierSlug: string) => {
    const tournament = getTournamentBySlug(tournamentSlug);
    if (!tournament) return undefined;
    const tier = tournament.tiers.find(t => t.slug === tierSlug || t.id === tierSlug);
    if (!tier) return undefined;
    if (tier.bracket?.rounds) {
      canonicalizeBracketRounds(tier.bracket.rounds);
    }
    return { tournament, tier };
  };

  const createTournament = async (
    data: Omit<
      Tournament,
      'id' | 'matchScores' | 'playersPool' | 'qualifierSubmissions' | 'tournamentPlayers'
    >
  ): Promise<Tournament> => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    const newTourney: Tournament = {
      ...data,
      id,
      organizationId: data.organizationId || undefined,
      slug: data.slug || id,
      matchScores: {},
      playersPool: [],
      qualifierSubmissions: [],
      tournamentPlayers: {},
      seedingMethod: data.seedingMethod || 'QUALIFIERS',
      manualSeeds: data.manualSeeds || [],
      isLocked: Boolean(data.isLocked),
      tiers: data.tiers || [],
      useOrgBranding: data.useOrgBranding !== undefined ? data.useOrgBranding : true,
    };

    // Calculate initial draft brackets if tiers exist
    if (newTourney.tiers.length > 0) {
      newTourney.tiers = generateDraftBracketsForTournament(newTourney);
    }

    try {
      const saved = await apiCall('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTourney),
      });

      const canonical = saved && saved.id ? saved : newTourney;
      setIsDbConnected(true);
      setDbError(null);
      setTournaments(prev => [
        canonical,
        ...prev.filter(t => t.id !== canonical.id && t.id !== newTourney.id && t.slug !== canonical.slug),
      ]);
      setActiveTournamentId(canonical.id);
      console.log(`[Store] Tournament "${canonical.name}" created and saved to database.`);
      return canonical;
    } catch (err: any) {
      console.error(`[Store] Failed to save tournament "${newTourney.name}" to database:`, err);
      setApiError(`Failed to save tournament "${newTourney.name}" to database: ${err.message}`);
      setIsDbConnected(false);
      setDbError(err.message);
      setTournaments(prev => [newTourney, ...prev.filter(t => t.id !== newTourney.id && t.slug !== newTourney.slug)]);
      setActiveTournamentId(newTourney.id);
      return newTourney;
    }
  };

  const updateTournament = async (
    tournamentId: string,
    updates: Partial<Tournament>
  ): Promise<Tournament | null> => {
    const target = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!target) return null;
    const updated = { ...target, ...updates };
    if (!updated.isLocked) {
      updated.tiers = generateDraftBracketsForTournament(updated);
    }
    return await syncTournamentToApi(updated);
  };

  const saveTiers = async (
    tournamentId: string,
    tiers: TournamentTier[]
  ): Promise<Tournament | null> => {
    const target = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!target) return null;
    const updated = { ...target, tiers };
    if (!updated.isLocked) {
      updated.tiers = generateDraftBracketsForTournament(updated);
    }
    return await syncTournamentToApi(updated);
  };

  const addPlayerToPool = (
    tournamentId: string,
    player: Omit<PlayerProfile, 'id'>
  ): PlayerProfile => {
    const cleanName = player.name.trim();
    const lowerName = cleanName.toLowerCase();

    // 1. If competitor already exists in global players, reuse and import them
    const existingGlobal = globalPlayers.find(
      p => p.name.trim().toLowerCase() === lowerName
    );
    if (existingGlobal) {
      importPlayersToTournament(tournamentId, [existingGlobal]);
      return existingGlobal;
    }

    // 2. Generate a valid RFC4122 UUID for the new player
    const tempId = generateUUID();
    const newPlayer: PlayerProfile = {
      ...player,
      name: cleanName,
      id: tempId,
      personalBest: player.personalBest ?? 0,
      playstyle: player.playstyle || 'Rolling',
      avatarType: player.avatarType || 'flag',
    };

    // Optimistically update global players
    setGlobalPlayers(prev => {
      if (prev.some(p => p.id === tempId || p.name.toLowerCase() === lowerName)) {
        return prev;
      }
      return [newPlayer, ...prev];
    });

    // Optimistically update tournament roster
    setTournaments(prev =>
      prev.map(t => {
        if (t.id !== tournamentId && t.slug !== tournamentId) return t;
        const currentPool = t.playersPool || [];
        if (currentPool.some(p => p.id === tempId || p.name.toLowerCase() === lowerName)) {
          return t;
        }
        const updatedPool = [...currentPool, newPlayer];
        const currentTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        currentTournamentPlayers[tempId] = {
          playerId: tempId,
          tournamentId: t.id,
          organizationId: t.organizationId,
        };
        const updated = {
          ...t,
          playersPool: updatedPool,
          tournamentPlayers: currentTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      })
    );

    apiCall('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newPlayer,
        upsertIfExists: true,
      }),
    })
      .then((createdPlayer: any) => {
        const savedPlayer: PlayerProfile = {
          ...newPlayer,
          id: createdPlayer?.id || newPlayer.id,
        };

        if (savedPlayer.id !== tempId) {
          setGlobalPlayers(prev =>
            prev.map(p => (p.id === tempId ? savedPlayer : p))
          );
        }

        setTournaments(prev => {
          const currentTarget = prev.find(t => t.id === tournamentId || t.slug === tournamentId);
          if (!currentTarget) return prev;

          const currentPool = (currentTarget.playersPool || []).map(p =>
            p.id === tempId ? savedPlayer : p
          );
          const currentTournamentPlayers = { ...(currentTarget.tournamentPlayers || {}) };
          if (savedPlayer.id !== tempId) {
            delete currentTournamentPlayers[tempId];
          }
          currentTournamentPlayers[savedPlayer.id] = {
            playerId: savedPlayer.id,
            tournamentId: currentTarget.id,
            organizationId: currentTarget.organizationId,
          };

          const updated = {
            ...currentTarget,
            playersPool: currentPool,
            tournamentPlayers: currentTournamentPlayers,
          };
          if (!updated.isLocked) {
            updated.tiers = generateDraftBracketsForTournament(updated);
          }

          apiCall(`/api/tournaments/${currentTarget.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          })
            .then(savedTourney => {
              if (savedTourney && savedTourney.id) {
                setTournaments(innerPrev =>
                  innerPrev.map(t => (t.id === savedTourney.id ? savedTourney : t))
                );
              }
            })
            .catch(err => {
              setApiError(`Failed to save tournament player: ${err.message}`);
            });

          return prev.map(t => (t.id === currentTarget.id ? updated : t));
        });
      })
      .catch(err => {
        setApiError(`Failed to create player: ${err.message}`);
      });

    return newPlayer;
  };

  const updatePlayerInPool = (
    tournamentId: string,
    playerId: string,
    updates: Partial<PlayerProfile>
  ) => {
    // DQ is tournament-scoped and set only via judge adjudication: never write it from profile edits
    const { isDisqualified: _ignoredDq, ...profileUpdates } = updates;

    // Optimistically update globalPlayers
    setGlobalPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, ...profileUpdates } : p))
    );

    setTournaments(prev => {
      const target = prev.find(t => t.id === tournamentId || t.slug === tournamentId);
      if (!target) return prev;
      const currentPool = target.playersPool || [];
      const updatedPool = currentPool.map(p =>
        p.id === playerId ? { ...p, ...profileUpdates } : p
      );
      const updated = { ...target, playersPool: updatedPool };
      if (!updated.isLocked) {
        updated.tiers = generateDraftBracketsForTournament(updated);
      }

      apiCall(`/api/players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileUpdates),
      })
        .then(() => {
          apiCall(`/api/tournaments/${target.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          })
            .then(saved => {
              if (saved && saved.id) {
                setTournaments(innerPrev => innerPrev.map(t => (t.id === saved.id ? saved : t)));
              }
            })
            .catch(err => {
              setApiError(`Failed to update tournament player: ${err.message}`);
            });
        })
        .catch(err => {
          setApiError(`Failed to update player: ${err.message}`);
        });

      return prev.map(t => (t.id === target.id ? updated : t));
    });
  };

  const submitQualifierScore = async (
    tournamentId: string,
    playerId: string,
    score: number,
    playerName?: string
  ): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/qualifiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, score, playerName }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to submit qualifier score: ${err.message}`);
      return null;
    }
  };

  const deleteQualifierScore = async (tournamentId: string, submissionId: string): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/qualifiers/${submissionId}`, {
        method: 'DELETE',
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to delete qualifier score: ${err.message}`);
      return null;
    }
  };

  const togglePlayerDisqualification = (
    tournamentId: string,
    playerId: string,
    isDisqualified: boolean
  ) => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return;
    void persistDisqualification(tournament.id, playerId, isDisqualified);
  };

  // DQ is tournament-scoped and only persisted through the dedicated endpoint;
  // the full-tournament PUT intentionally ignores it.
  const persistDisqualification = async (
    tournamentId: string,
    playerId: string,
    isDisqualified: boolean
  ): Promise<Tournament | null> => {
    try {
      const saved = await apiCall(`/api/tournaments/${tournamentId}/qualify/disqualification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, isDisqualified }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to update disqualification: ${err.message}`);
      return null;
    }
  };

  // Online quals open/close only goes through its dedicated endpoint;
  // the full-tournament PUT intentionally ignores it.
  const setOnlineQualsOpen = async (tournamentId: string, open: boolean): Promise<boolean> => {
    try {
      const saved = await apiCall(`/api/tournaments/${tournamentId}/online-quals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return true;
      }
      return false;
    } catch (err: any) {
      setApiError(`Failed to update online qualifying: ${err.message}`);
      return false;
    }
  };

  const testDiscordWebhook = async (
    tournamentId: string,
    url?: string
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const result = await apiCall(`/api/tournaments/${tournamentId}/discord-webhook/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const target = result?.source === 'organization' ? "the organization's webhook" : 'the webhook';
      return { ok: true, message: `Test message sent to ${target}. Check the Discord channel.` };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Webhook test failed' };
    }
  };

  const togglePlayerQualsCompleted = (
    tournamentId: string,
    playerId: string,
    qualsCompleted: boolean
  ) => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return;
    const currentPlayers = tournament.tournamentPlayers || {};
    const existing = currentPlayers[playerId] || {
      playerId,
      tournamentId: tournament.id,
      organizationId: tournament.organizationId,
    };
    const updatedPlayers = {
      ...currentPlayers,
      [playerId]: { ...existing, qualsCompleted },
    };
    const updated = { ...tournament, tournamentPlayers: updatedPlayers };
    if (!updated.isLocked) {
      updated.tiers = generateDraftBracketsForTournament(updated);
    }
    syncTournamentToApi(updated);
  };

  const togglePlayerQualifierVerified = (
    tournamentId: string,
    playerId: string,
    isVerified?: boolean
  ) => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return;
    const currentPlayers = tournament.tournamentPlayers || {};
    const existing = currentPlayers[playerId] || {
      playerId,
      tournamentId: tournament.id,
      organizationId: tournament.organizationId,
    };
    const currentVal = Boolean(existing.isVerified || existing.qualsCompleted);
    const newVerified = isVerified !== undefined ? isVerified : !currentVal;
    const updatedPlayers = {
      ...currentPlayers,
      [playerId]: {
        ...existing,
        isVerified: newVerified,
        qualsCompleted: newVerified,
      },
    };

    const updatedSubmissions = (tournament.qualifierSubmissions || []).map(s => {
      if (s.playerId === playerId) {
        return {
          ...s,
          status: (newVerified ? 'VERIFIED' : 'SUBMITTED') as any,
          verifiedAt: newVerified ? Date.now() : undefined,
          verifiedBy: newVerified ? (s.verifiedBy || 'Judge') : undefined,
        };
      }
      return s;
    });

    const updatedLegacyQuals = (tournament.qualifiers || []).map(q => {
      if (q.playerId === playerId) {
        return { ...q, verified: newVerified };
      }
      return q;
    });

    const updatedTourney: Tournament = {
      ...tournament,
      tournamentPlayers: updatedPlayers,
      qualifierSubmissions: updatedSubmissions,
      qualifiers: updatedLegacyQuals,
    };

    setTournaments(prev => prev.map(t => (t.id === tournament.id ? updatedTourney : t)));
    syncTournamentToApi(updatedTourney);
  };

  const lockTournament = async (tournamentId: string): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/lock`, { method: 'POST' });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to lock tournament: ${err.message}`);
      return null;
    }
  };

  const unlockBrackets = async (tournamentId: string): Promise<{ success: boolean; error?: string }> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return { success: false, error: 'Tournament not found' };

    const hasRecordedScores = Object.values(tournament.matchScores || {}).some(
      record =>
        record.isComplete ||
        record.games.some(
          g => g.player1Points !== null || g.player2Points !== null || g.winnerPlayerId !== null
        ) ||
        record.player1Wins > 0 ||
        record.player2Wins > 0 ||
        Boolean(record.winnerPlayerId)
    );

    if (hasRecordedScores) {
      return {
        success: false,
        error: 'Cannot unlock: Match play has begun. Clear recorded scores before unlocking.',
      };
    }

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/unlock`, { method: 'POST' });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return { success: true };
      }
      return { success: false, error: 'Failed to unlock brackets' };
    } catch (err: any) {
      const msg = err.message || 'Failed to unlock brackets';
      setApiError(`Failed to unlock brackets: ${msg}`);
      return { success: false, error: msg };
    }
  };

  const recordGameScore = async (
    tournamentId: string,
    tierId: string,
    matchId: string,
    gameNumber: number,
    p1Points: number | null,
    p2Points: number | null,
    declaredWinnerId?: string | null
  ): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;
    const tier = tournament.tiers.find(t => t.id === tierId);
    const targetMatch = tier?.bracket.matchesById[matchId];
    if (!targetMatch) return null;

    const currentRecord = tournament.matchScores[matchId] || {
      matchId,
      tierId,
      organizationId: tournament.organizationId,
      bestOf: targetMatch.bestOf || tier.bestOf,
      player1Wins: 0,
      player2Wins: 0,
      games: [],
      winnerPlayerId: null,
      loserPlayerId: null,
      isComplete: false,
    };

    const existingGames = [...currentRecord.games];
    const p1 = targetMatch.player1.player;
    const p2 = targetMatch.player2.player;

    let gameWinner: string | null = declaredWinnerId ?? null;
    if (!gameWinner && p1 && p2 && p1Points !== null && p2Points !== null) {
      if (p1Points > p2Points) gameWinner = p1.id;
      else if (p2Points > p1Points) gameWinner = p2.id;
      else if (p1Points === p2Points) gameWinner = 'TIE';
    }

    const gameIdx = existingGames.findIndex(g => g.gameNumber === gameNumber);
    if (gameIdx >= 0) {
      existingGames[gameIdx] = {
        gameNumber,
        player1Points: p1Points,
        player2Points: p2Points,
        winnerPlayerId: gameWinner,
      };
    } else {
      existingGames.push({
        gameNumber,
        player1Points: p1Points,
        player2Points: p2Points,
        winnerPlayerId: gameWinner,
      });
    }

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/matches/${matchId}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId,
          scoredGames: existingGames,
          bestOf: currentRecord.bestOf,
        }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to save game score to database: ${err.message}`);
      return null;
    }
  };

  const saveMatchScores = async (
    tournamentId: string,
    tierId: string,
    matchId: string,
    scoredGames: Array<{
      gameNumber: number;
      player1Points: number | null;
      player2Points: number | null;
      winnerPlayerId: string | null;
    }>,
    hasTiebreaker?: boolean
  ): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;
    const tier = tournament.tiers.find(t => t.id === tierId);
    const targetMatch = tier?.bracket.matchesById[matchId];
    const bestOf = targetMatch?.bestOf || tier?.bestOf || 5;

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/matches/${matchId}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId,
          scoredGames,
          bestOf,
          hasTiebreaker,
        }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to save match scores to database: ${err.message}`);
      return null;
    }
  };

  const updateMatchBestOf = async (
    tournamentId: string,
    tierId: string,
    matchId: string,
    bestOf: number
  ): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/matches/${matchId}/best-of`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, bestOf }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to update match best-of: ${err.message}`);
      return null;
    }
  };

  const swapMatchSlotsAction = async (
    tournamentId: string,
    tierId: string,
    payload: {
      sourceMatchId: string;
      sourceSlot: 1 | 2;
      targetMatchId: string;
      targetSlot: 1 | 2;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return { success: false, error: 'Tournament not found' };

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/matches/swap-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, ...payload }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return { success: true };
      }
      return { success: false, error: 'Failed to swap match slots' };
    } catch (err: any) {
      const msg = err.message || 'Failed to swap match slots';
      setApiError(`Failed to swap match slots: ${msg}`);
      return { success: false, error: msg };
    }
  };

  const forfeitMatch = async (
    tournamentId: string,
    tierId: string,
    matchId: string,
    winnerPlayerId: string
  ): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;

    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/matches/${matchId}/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, winnerPlayerId }),
      });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to record forfeit: ${err.message}`);
      return null;
    }
  };

  const addQualifierScore = (
    tournamentId: string,
    entry: Omit<QualifierScore, 'id' | 'totalScore'>
  ) => {
    // Legacy support: also submit as qualifier submissions
    setTournaments(prev =>
      prev.map(tournament => {
        if (tournament.id !== tournamentId) return tournament;
        const total = (entry.game1 || 0) + (entry.game2 || 0) + (entry.game3 || 0);
        const newScore: QualifierScore = {
          ...entry,
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          totalScore: total,
        };
        const currentQuals = tournament.qualifiers || [];
        const updated = [...currentQuals, newScore].sort(
          (a, b) => b.totalScore - a.totalScore
        );
        updated.forEach((q, idx) => {
          q.seed = idx + 1;
        });

        // Add corresponding submission
        const newSub: QualifierSubmission = {
          id: `sub_${Date.now()}`,
          tournamentId,
          organizationId: tournament.organizationId,
          playerId: entry.playerId,
          score: entry.game1,
          submittedAt: Date.now(),
        };

        const updatedTourney: Tournament = {
          ...tournament,
          qualifiers: updated,
          qualifierSubmissions: [...(tournament.qualifierSubmissions || []), newSub],
        };

        if (!updatedTourney.isLocked) {
          updatedTourney.tiers = generateDraftBracketsForTournament(updatedTourney);
        }

        return updatedTourney;
      })
    );
  };

  const verifyQualifierScore = (
    tournamentId: string,
    qualifierId: string,
    verified: boolean
  ) => {
    setTournaments(prev =>
      prev.map(tournament => {
        if (tournament.id !== tournamentId) return tournament;
        return {
          ...tournament,
          qualifiers: (tournament.qualifiers || []).map(q =>
            q.id === qualifierId ? { ...q, verified } : q
          ),
        };
      })
    );
  };

  const persistTournamentUpdate = (
    tournamentId: string,
    updater: (current: Tournament) => Tournament,
    actionName = 'update tournament'
  ) => {
    const current = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!current) return;
    const updated = updater(current);
    apiCall(`/api/tournaments/${current.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .then(saved => {
        if (saved && saved.id) {
          setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        }
      })
      .catch(err => {
        setApiError(`Failed to ${actionName}: ${err.message}`);
      });
  };

  const clearMatchScores = async (tournamentId: string): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;
    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/matches`, { method: 'DELETE' });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to clear match scores: ${err.message}`);
      return null;
    }
  };

  const clearQualifierScores = async (tournamentId: string): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;
    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/qualifiers`, { method: 'DELETE' });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to clear qualifier scores: ${err.message}`);
      return null;
    }
  };

  const clearAllTournamentData = async (tournamentId: string): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;
    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/clear-all`, { method: 'POST' });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to clear all tournament data: ${err.message}`);
      return null;
    }
  };

  const seedQualifiers = async (tournamentId: string): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;
    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/simulate/seed-quals`, { method: 'POST' });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to seed qualifiers: ${err.message}`);
      return null;
    }
  };

  const simulateFullTournament = async (tournamentId: string): Promise<Tournament | null> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return null;
    try {
      const saved = await apiCall(`/api/tournaments/${tournament.id}/simulate/full`, { method: 'POST' });
      if (saved && saved.id) {
        setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        return saved;
      }
      return null;
    } catch (err: any) {
      setApiError(`Failed to simulate tournament: ${err.message}`);
      return null;
    }
  };

  const deleteTournament = async (tournamentId: string): Promise<boolean> => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    const targetId = tournament?.id || tournamentId;
    try {
      await apiCall(`/api/tournaments/${targetId}`, { method: 'DELETE' });
      setTournaments(prev => prev.filter(t => t.id !== targetId && t.slug !== targetId));
      if (activeTournamentId === targetId || activeTournament?.slug === targetId) {
        setActiveTournamentId(null);
      }
      return true;
    } catch (err: any) {
      setApiError(`Failed to delete tournament: ${err.message}`);
      return false;
    }
  };

  const addGlobalPlayer = (player: Omit<PlayerProfile, 'id'>): PlayerProfile => {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p_global_${Date.now()}`;
    const newPlayer: PlayerProfile = { ...player, id: tempId };
    apiCall('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPlayer),
    })
      .then(saved => {
        if (saved && saved.id) {
          const profile: PlayerProfile = {
            id: saved.id,
            name: saved.name,
            displayName: saved.displayName || undefined,
            nickname: saved.nickname || undefined,
            twitchUsername: saved.twitchUsername || undefined,
            country: saved.country || undefined,
            avatarType: saved.avatarType || 'flag',
            avatarUrl: saved.avatarUrl || undefined,
            personalBest: saved.personalBest ?? 0,
            playstyle: saved.playstyle || 'Rolling',
            notes: saved.notes || undefined,
            isDisqualified: saved.isDisqualified || false,
          };
          setGlobalPlayers(prev => [profile, ...prev.filter(p => p.id !== profile.id)]);
        }
      })
      .catch(err => {
        setApiError(`Failed to create global player: ${err.message}`);
      });
    return newPlayer;
  };

  const updateGlobalPlayer = (playerId: string, updates: Partial<PlayerProfile>) => {
    apiCall(`/api/players/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
      .then(saved => {
        if (saved && saved.id) {
          setGlobalPlayers(prev =>
            prev.map(p => (p.id === playerId ? { ...p, ...updates } : p))
          );
          // Propagate updates to tournaments in memory
          setTournaments(prev =>
            prev.map(t => {
              const hasPlayer = (t.playersPool || []).some(p => p.id === playerId);
              if (!hasPlayer) return t;
              const updatedPool = t.playersPool.map(p =>
                p.id === playerId ? { ...p, ...updates } : p
              );
              const updated = { ...t, playersPool: updatedPool };
              if (!updated.isLocked) {
                updated.tiers = generateDraftBracketsForTournament(updated);
              }
              return updated;
            })
          );
        }
      })
      .catch(err => {
        setApiError(`Failed to update global player: ${err.message}`);
      });
  };

  const deleteGlobalPlayer = async (playerId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiCall(`/api/players/${playerId}`, { method: 'DELETE' });
      setGlobalPlayers(prev => prev.filter(p => p.id !== playerId));
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to delete global player';
      setApiError(`Failed to delete global player: ${msg}`);
      return { success: false, error: msg };
    }
  };

  const clearAllGlobalPlayers = async (): Promise<void> => {
    try {
      const res = await apiCall('/api/players', { method: 'DELETE' });
      if (res && Array.isArray(res.deletedIds)) {
        const deletedSet = new Set(res.deletedIds);
        setGlobalPlayers(prev => prev.filter(p => !deletedSet.has(p.id)));
      }
    } catch (err: any) {
      setApiError(`Failed to clear global players: ${err.message}`);
    }
  };

  const generateFakeGlobalPlayers = (count: number): PlayerProfile[] => {
    const rawFake = generateAdditionalFakePlayers(count, globalPlayers);
    apiCall('/api/players/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawFake),
    })
      .then(created => {
        if (Array.isArray(created)) {
          const mapped: PlayerProfile[] = created.map((p: any) => ({
            id: p.id,
            name: p.name,
            country: p.country || undefined,
            avatarType: p.avatarType || 'flag',
            avatarUrl: p.avatarUrl || undefined,
            personalBest: p.personalBest ?? 0,
            playstyle: p.playstyle || 'Rolling',
            notes: p.notes || undefined,
            isDisqualified: p.isDisqualified || false,
          }));
          setGlobalPlayers(prev => [...mapped, ...prev]);
        }
      })
      .catch(err => {
        setApiError(`Failed to generate players: ${err.message}`);
      });
    return rawFake;
  };

  const importPlayersToTournament = (tournamentId: string, playersToImport: PlayerProfile[]) => {
    setTournaments(prev => {
      const target = prev.find(t => t.id === tournamentId || t.slug === tournamentId);
      if (!target) return prev;
      const existingPool = target.playersPool || [];
      const existingIds = new Set(existingPool.map(p => p.id));
      const existingNames = new Set(existingPool.map(p => p.name.toLowerCase()));

      const toAdd = playersToImport.filter(
        p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase())
      );

      if (toAdd.length === 0) return prev;

      const updatedTournamentPlayers = { ...(target.tournamentPlayers || {}) };
      toAdd.forEach(p => {
        if (!updatedTournamentPlayers[p.id]) {
          updatedTournamentPlayers[p.id] = {
            playerId: p.id,
            tournamentId: target.id,
            organizationId: target.organizationId,
          };
        }
      });

      const updated = {
        ...target,
        playersPool: [...existingPool, ...toAdd],
        tournamentPlayers: updatedTournamentPlayers,
      };
      if (!updated.isLocked) {
        updated.tiers = generateDraftBracketsForTournament(updated);
      }

      apiCall(`/api/tournaments/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
        .then(saved => {
          if (saved && saved.id) {
            setTournaments(innerPrev => innerPrev.map(t => (t.id === saved.id ? saved : t)));
          }
        })
        .catch(err => {
          setApiError(`Failed to import players: ${err.message}`);
        });

      return prev.map(t => (t.id === target.id ? updated : t));
    });
  };

  const removePlayerFromTournament = (
    tournamentId: string,
    playerId: string
  ): { success: boolean; error?: string } => {
    const tournament = tournaments.find(t => t.id === tournamentId || t.slug === tournamentId);
    if (!tournament) return { success: false, error: 'Tournament not found' };

    const hasRecordedMatches = Object.values(tournament.matchScores || {}).some(
      m =>
        (m.winnerPlayerId === playerId || m.loserPlayerId === playerId) ||
        (m.isComplete && (m.games || []).length > 0)
    );
    if (hasRecordedMatches) {
      return {
        success: false,
        error: 'Cannot remove competitor who has recorded matches. Clear match scores first.',
      };
    }

    if (tournament.isLocked) {
      return {
        success: false,
        error: 'Cannot remove competitor while brackets are locked. Unlock brackets first.',
      };
    }

    const hasQualScores = (tournament.qualifierSubmissions || []).some(
      s => s.playerId === playerId
    );
    if (hasQualScores) {
      return {
        success: false,
        error: 'Cannot remove competitor while they have recorded qualifier scores. Delete their qualifier scores first.',
      };
    }

    apiCall(`/api/tournaments/${tournament.id}/players/${playerId}`, {
      method: 'DELETE',
    })
      .then(saved => {
        if (saved && saved.id) {
          setTournaments(prev => prev.map(t => (t.id === saved.id ? saved : t)));
        }
      })
      .catch(err => {
        setApiError(`Failed to remove competitor: ${err.message}`);
      });

    return { success: true };
  };

  const setSeedingMethod = (tournamentId: string, method: SeedingMethod) => {
    persistTournamentUpdate(
      tournamentId,
      t => {
        const updated = { ...t, seedingMethod: method };
        if (method === 'MANUAL' && (!updated.manualSeeds || updated.manualSeeds.length === 0)) {
          updated.manualSeeds = (updated.playersPool || []).map(p => p.id);
          const updatedTournamentPlayers = { ...(updated.tournamentPlayers || {}) };
          updated.manualSeeds.forEach((id, idx) => {
            if (updatedTournamentPlayers[id]) {
              updatedTournamentPlayers[id] = {
                ...updatedTournamentPlayers[id],
                seed: idx + 1,
              };
            }
          });
          updated.tournamentPlayers = updatedTournamentPlayers;
        }
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'set seeding method'
    );
  };

  const setManualSeeds = (tournamentId: string, playerIds: string[]) => {
    persistTournamentUpdate(
      tournamentId,
      t => {
        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        playerIds.forEach((id, idx) => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: idx + 1,
            };
          }
        });

        const updated = {
          ...t,
          manualSeeds: playerIds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'set manual seeds'
    );
  };

  const reorderManualSeed = (tournamentId: string, fromIndex: number, toIndex: number) => {
    persistTournamentUpdate(
      tournamentId,
      t => {
        const seeds = [...(t.manualSeeds || [])];
        if (fromIndex < 0 || fromIndex >= seeds.length || toIndex < 0 || toIndex >= seeds.length) {
          return t;
        }
        const [moved] = seeds.splice(fromIndex, 1);
        seeds.splice(toIndex, 0, moved);

        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        seeds.forEach((id, idx) => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: idx + 1,
            };
          }
        });

        const updated = {
          ...t,
          manualSeeds: seeds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'reorder manual seed'
    );
  };

  const shuffleManualSeeds = (tournamentId: string) => {
    persistTournamentUpdate(
      tournamentId,
      t => {
        const seeds = [...(t.manualSeeds || [])];
        for (let i = seeds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
        }

        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        seeds.forEach((id, idx) => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: idx + 1,
            };
          }
        });

        const updated = {
          ...t,
          manualSeeds: seeds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'shuffle manual seeds'
    );
  };

  const addManualSeed = (tournamentId: string, playerId: string) => {
    persistTournamentUpdate(
      tournamentId,
      t => {
        const seeds = t.manualSeeds || [];
        if (seeds.includes(playerId)) return t;
        const updatedSeeds = [...seeds, playerId];

        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        if (updatedTournamentPlayers[playerId]) {
          updatedTournamentPlayers[playerId] = {
            ...updatedTournamentPlayers[playerId],
            seed: updatedSeeds.length,
          };
        }

        const updated = {
          ...t,
          manualSeeds: updatedSeeds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'add manual seed'
    );
  };

  const removeManualSeed = (tournamentId: string, playerId: string) => {
    batchRemoveManualSeeds(tournamentId, [playerId]);
  };

  const batchRemoveManualSeeds = (tournamentId: string, playerIds: string[]) => {
    if (playerIds.length === 0) return;
    const toRemoveSet = new Set(playerIds);
    persistTournamentUpdate(
      tournamentId,
      t => {
        const updatedSeeds = (t.manualSeeds || []).filter(id => !toRemoveSet.has(id));
        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        playerIds.forEach(id => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: undefined,
            };
          }
        });
        updatedSeeds.forEach((id, idx) => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: idx + 1,
            };
          }
        });

        const updated = {
          ...t,
          manualSeeds: updatedSeeds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'remove manual seeds'
    );
  };

  const batchAddManualSeeds = (
    tournamentId: string,
    playerIds: string[],
    position: 'TOP' | 'BOTTOM'
  ) => {
    if (playerIds.length === 0) return;
    persistTournamentUpdate(
      tournamentId,
      t => {
        const existingSeeds = t.manualSeeds || [];
        const existingSet = new Set(existingSeeds);
        const uniqueToAdd = playerIds.filter(id => !existingSet.has(id));
        if (uniqueToAdd.length === 0) return t;

        const updatedSeeds =
          position === 'TOP'
            ? [...uniqueToAdd, ...existingSeeds]
            : [...existingSeeds, ...uniqueToAdd];

        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        updatedSeeds.forEach((id, idx) => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: idx + 1,
            };
          }
        });

        const updated = {
          ...t,
          manualSeeds: updatedSeeds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'add manual seeds'
    );
  };

  const batchMoveManualSeeds = (
    tournamentId: string,
    playerIds: string[],
    direction: 'UP' | 'DOWN'
  ) => {
    if (playerIds.length === 0) return;
    persistTournamentUpdate(
      tournamentId,
      t => {
        const seeds = t.manualSeeds || [];
        const updatedSeeds = shiftSeedsCluster(seeds, playerIds, direction);

        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        updatedSeeds.forEach((id, idx) => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: idx + 1,
            };
          }
        });

        const updated = {
          ...t,
          manualSeeds: updatedSeeds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'move manual seeds'
    );
  };

  const batchJumpManualSeeds = (
    tournamentId: string,
    playerIds: string[],
    targetSeed: number
  ) => {
    if (playerIds.length === 0) return;
    persistTournamentUpdate(
      tournamentId,
      t => {
        const seeds = t.manualSeeds || [];
        const updatedSeeds = jumpSeedsBunched(seeds, playerIds, targetSeed);

        const updatedTournamentPlayers = { ...(t.tournamentPlayers || {}) };
        updatedSeeds.forEach((id, idx) => {
          if (updatedTournamentPlayers[id]) {
            updatedTournamentPlayers[id] = {
              ...updatedTournamentPlayers[id],
              seed: idx + 1,
            };
          }
        });

        const updated = {
          ...t,
          manualSeeds: updatedSeeds,
          tournamentPlayers: updatedTournamentPlayers,
        };
        if (!updated.isLocked) {
          updated.tiers = generateDraftBracketsForTournament(updated);
        }
        return updated;
      },
      'jump manual seeds'
    );
  };

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        globalPlayers,
        activeTournamentId,
        activeTournament,
        isLoading,
        isHydrated,
        simulateSampleTournament,
        setActiveTournamentId,
        getTournamentBySlug,
        getTierBySlug,
        createTournament,
        updateTournament,
        saveTiers,
        addPlayerToPool,
        updatePlayerInPool,
        submitQualifierScore,
        deleteQualifierScore,
        togglePlayerDisqualification,
        setOnlineQualsOpen,
        testDiscordWebhook,
        togglePlayerQualsCompleted,
        togglePlayerQualifierVerified,
        lockTournament,
        unlockBrackets,
        recordGameScore,
        saveMatchScores,
        updateMatchBestOf,
        forfeitMatch,
        addQualifierScore,
        verifyQualifierScore,
        clearMatchScores,
        clearQualifierScores,
        clearAllTournamentData,
        seedQualifiers,
        simulateFullTournament,
        deleteTournament,
        addGlobalPlayer,
        updateGlobalPlayer,
        deleteGlobalPlayer,
        clearAllGlobalPlayers,
        generateFakeGlobalPlayers,
        importPlayersToTournament,
        removePlayerFromTournament,
        swapMatchSlots: swapMatchSlotsAction,
        setSeedingMethod,
        setManualSeeds,
        reorderManualSeed,
        shuffleManualSeeds,
        addManualSeed,
        removeManualSeed,
        batchMoveManualSeeds,
        batchJumpManualSeeds,
        batchRemoveManualSeeds,
        batchAddManualSeeds,
        isDbConnected,
        dbError,
        checkDbHealth,
        retryConnection,
        refreshTournament,
        refreshGlobalPlayers,
        refreshAllTournaments,
        apiError,
        clearApiError,
      }}
    >
      {!isDbConnected && (
        <div
          role="alert"
          style={{
            backgroundColor: '#991b1b',
            backgroundImage: 'linear-gradient(90deg, #991b1b 0%, #7f1d1d 100%)',
            color: '#ffffff',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 99999,
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px' }}>🔴</span>
            <span>
              <strong>PostgreSQL Database Offline:</strong>{' '}
              {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (
                <>Unable to connect on port 5433 ({dbError || 'Connection refused'}). Tournaments cannot be loaded or saved. Please ensure the Docker container is running (<code>npm run db:up</code>).</>
              ) : (
                <>Unable to connect to database ({dbError || 'Connection refused'}). Tournaments cannot be loaded or saved.</>
              )}
            </span>
          </div>
          <button
            onClick={() => retryConnection()}
            style={{
              background: '#ffffff',
              color: '#991b1b',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginLeft: '12px',
            }}
          >
            Retry Connection
          </button>
        </div>
      )}
      {apiError && (
        <div
          role="alert"
          style={{
            backgroundColor: '#dc2626',
            color: '#ffffff',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 99999,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>{apiError}</span>
          </div>
          <button
            onClick={clearApiError}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
      {children}
    </TournamentContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};

export {
  useTournamentSettings,
  useQualifiers,
  useMatches,
  useGlobalPlayers,
} from './hooks';

