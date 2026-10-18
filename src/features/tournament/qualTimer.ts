import { useState, useEffect, useCallback, useContext } from 'react';
import type { Tournament, TournamentQualTimer } from './types';
import { TournamentContext } from './store';

/**
 * Computes remaining seconds for a tournament qualification countdown timer.
 */
export function getQualTimerRemainingSeconds(
  timer?: TournamentQualTimer,
  qualWindowMinutes: number = 90,
  nowMs: number = Date.now()
): number {
  const duration = (timer?.durationMinutes || qualWindowMinutes || 90) * 60;
  if (!timer) return duration;

  const runningElapsed =
    timer.isRunning && timer.lastResumedAt
      ? Math.max(0, Math.floor((nowMs - timer.lastResumedAt) / 1000))
      : 0;
  const totalElapsed = (timer.elapsedSeconds || 0) + runningElapsed;
  return Math.max(0, duration - totalElapsed);
}

/**
 * Formats seconds into HH:MM:SS or MM:SS string.
 */
export function formatTimerSeconds(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * React hook to observe and control the tournament-level qual countdown timer.
 * Interval runs ONLY when the timer is actively running.
 */
export function useTournamentQualTimer(tournament?: Tournament) {
  const context = useContext(TournamentContext);
  const updateTournament = context?.updateTournament;
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const timer = tournament?.qualTimer;
  const qualWindowMinutes = tournament?.qualWindowMinutes ?? 90;
  const isRunning = Boolean(timer?.isRunning);

  // 1-second interval execution strictly when running
  useEffect(() => {
    if (!isRunning) return;
    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const remainingSeconds = getQualTimerRemainingSeconds(timer, qualWindowMinutes, nowMs);
  const formattedTime = formatTimerSeconds(remainingSeconds);
  const durationSeconds = (timer?.durationMinutes || qualWindowMinutes) * 60;
  const isExpired = remainingSeconds === 0 && Boolean(timer && (timer.elapsedSeconds > 0 || timer.isRunning));

  const toggleRunning = useCallback(async () => {
    if (!tournament) return;
    const currentTimer = tournament.qualTimer;
    const dur = currentTimer?.durationMinutes || tournament.qualWindowMinutes || 90;

    if (currentTimer?.isRunning) {
      // Pause
      const additional = currentTimer.lastResumedAt
        ? Math.max(0, Math.floor((Date.now() - currentTimer.lastResumedAt) / 1000))
        : 0;
      const updatedTimer: TournamentQualTimer = {
        durationMinutes: dur,
        elapsedSeconds: (currentTimer.elapsedSeconds || 0) + additional,
        isRunning: false,
        lastResumedAt: null,
        startedAt: currentTimer.startedAt || Date.now(),
      };
      if (updateTournament) {
        await updateTournament(tournament.id, { qualTimer: updatedTimer });
      }
    } else {
      // Start / Unpause
      const updatedTimer: TournamentQualTimer = {
        durationMinutes: dur,
        elapsedSeconds: currentTimer?.elapsedSeconds || 0,
        isRunning: true,
        lastResumedAt: Date.now(),
        startedAt: currentTimer?.startedAt || Date.now(),
      };
      if (updateTournament) {
        await updateTournament(tournament.id, { qualTimer: updatedTimer });
      }
    }
  }, [tournament, updateTournament]);

  const resetTimer = useCallback(async () => {
    if (!tournament) return;
    const dur = tournament.qualWindowMinutes || 90;
    const freshTimer: TournamentQualTimer = {
      durationMinutes: dur,
      elapsedSeconds: 0,
      isRunning: false,
      lastResumedAt: null,
      startedAt: null,
    };
    if (updateTournament) {
      await updateTournament(tournament.id, { qualTimer: freshTimer });
    }
  }, [tournament, updateTournament]);

  const setTimeRemaining = useCallback(
    async (targetSeconds: number) => {
      if (!tournament) return;
      const dur = tournament.qualTimer?.durationMinutes || tournament.qualWindowMinutes || 90;
      const totalDurSec = dur * 60;
      const cleanRemaining = Math.max(0, targetSeconds);
      const newElapsed = Math.max(0, totalDurSec - cleanRemaining);

      const updatedTimer: TournamentQualTimer = {
        durationMinutes: dur,
        elapsedSeconds: newElapsed,
        isRunning: Boolean(tournament.qualTimer?.isRunning),
        lastResumedAt: tournament.qualTimer?.isRunning ? Date.now() : null,
        startedAt: tournament.qualTimer?.startedAt || Date.now(),
      };
      if (updateTournament) {
        await updateTournament(tournament.id, { qualTimer: updatedTimer });
      }
    },
    [tournament, updateTournament]
  );

  return {
    remainingSeconds,
    durationSeconds,
    formattedTime,
    isRunning,
    isExpired,
    toggleRunning,
    resetTimer,
    setTimeRemaining,
  };
}
