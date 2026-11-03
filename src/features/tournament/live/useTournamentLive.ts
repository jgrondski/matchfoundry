import { useEffect, useRef } from 'react';
import { useTournament } from '../store';
import { getAuthToken } from '../../auth/AuthContext';
import { REALTIME_URL } from '../../../utils/realtimeConfig';
import {
  HIDDEN_DISCONNECT_MS,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  isStaleEvent,
  parseLiveMessage,
  reconnectDelayMs,
  refreshJitterMs,
  toWebSocketUrl,
} from './liveScheduler';

/**
 * Keeps the given tournament live: listens on the realtime worker's socket and re-fetches the
 * tournament when a newer revision is announced. Does nothing when REALTIME_URL is not configured.
 */
export function useTournamentLive(tournamentId: string | null | undefined): void {
  const { tournaments, refreshTournament } = useTournament();
  const knownRevisionRef = useRef<number | undefined>(undefined);
  const refreshRef = useRef(refreshTournament);

  useEffect(() => {
    knownRevisionRef.current = tournaments.find(t => t.id === tournamentId)?.revision;
  }, [tournaments, tournamentId]);

  useEffect(() => {
    refreshRef.current = refreshTournament;
  }, [refreshTournament]);

  useEffect(() => {
    if (!tournamentId || !REALTIME_URL || typeof WebSocket === 'undefined') return;

    let ws: WebSocket | null = null;
    let cleanedUp = false;
    let attempt = 0;
    let hasOpened = false;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let pongTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingRevision: number | undefined;
    let inFlight: Promise<unknown> | null = null;

    const clearPingPong = () => {
      if (pingTimer) clearInterval(pingTimer);
      if (pongTimer) clearTimeout(pongTimer);
      pingTimer = null;
      pongTimer = null;
    };

    const runRefresh = (revision: number | undefined) => {
      const task = refreshRef.current(tournamentId, { revision });
      inFlight = task;
      void task.finally(() => {
        if (inFlight === task) inFlight = null;
      });
      return task;
    };

    const fireRefresh = () => {
      const revision = pendingRevision;
      refreshTimer = null;
      pendingRevision = undefined;
      if (cleanedUp) return;
      if (inFlight) {
        void inFlight.finally(() => {
          if (cleanedUp) return;
          const known = knownRevisionRef.current;
          if (typeof revision === 'number' && (typeof known !== 'number' || revision > known)) {
            void runRefresh(revision);
          }
        });
        return;
      }
      void runRefresh(revision);
    };

    const scheduleRefresh = (revision: number | undefined) => {
      if (typeof revision === 'number' && (typeof pendingRevision !== 'number' || revision > pendingRevision)) {
        pendingRevision = revision;
      }
      if (refreshTimer) return;
      refreshTimer = setTimeout(fireRefresh, refreshJitterMs(Boolean(getAuthToken())));
    };

    const scheduleReconnect = () => {
      if (cleanedUp || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, reconnectDelayMs(attempt++));
    };

    const connect = () => {
      if (cleanedUp) return;
      const socket = new WebSocket(toWebSocketUrl(REALTIME_URL, tournamentId));
      ws = socket;

      socket.addEventListener('open', () => {
        if (ws !== socket) return;
        attempt = 0;
        clearPingPong();
        pingTimer = setInterval(() => {
          try {
            socket.send('ping');
          } catch {
            // The close handler reconnects.
          }
          if (pongTimer) clearTimeout(pongTimer);
          pongTimer = setTimeout(() => socket.close(), PONG_TIMEOUT_MS);
        }, PING_INTERVAL_MS);
        if (hasOpened) scheduleRefresh(undefined);
        hasOpened = true;
      });

      socket.addEventListener('message', (event: MessageEvent) => {
        if (ws !== socket) return;
        if (event.data === 'pong') {
          if (pongTimer) clearTimeout(pongTimer);
          pongTimer = null;
          return;
        }
        const m = parseLiveMessage(event.data);
        if (!m || m.tournamentId !== tournamentId) return;
        if (isStaleEvent(m.revision, knownRevisionRef.current)) return;
        scheduleRefresh(m.revision);
      });

      const handleDown = () => {
        if (ws !== socket) return;
        clearPingPong();
        scheduleReconnect();
      };
      socket.addEventListener('close', handleDown);
      socket.addEventListener('error', handleDown);
    };

    const isSocketClosed = () =>
      !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        hiddenTimer = setTimeout(() => {
          hiddenTimer = null;
          // Closing while hidden counts as cleanup: no reconnect until the tab is visible again.
          const socket = ws;
          ws = null;
          clearPingPong();
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = null;
          socket?.close(1000);
        }, HIDDEN_DISCONNECT_MS);
        return;
      }
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = null;
      if (isSocketClosed() && !reconnectTimer) {
        hasOpened = false; // the refresh below catches up; the open handler need not refresh again
        connect();
        scheduleRefresh(undefined);
      }
    };

    connect();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cleanedUp = true;
      clearPingPong();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
      const socket = ws;
      ws = null;
      socket?.close(1000);
    };
  }, [tournamentId]);
}
