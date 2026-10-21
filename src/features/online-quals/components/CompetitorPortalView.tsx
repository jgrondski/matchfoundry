import { useContext, useState } from 'react';
import {
  Gamepad2,
  Tv,
  CheckCircle,
  AlertCircle,
  Play,
  ShieldAlert,
  User,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { PreFlightModal } from './PreFlightModal';
import { AuthwordHudCard } from './AuthwordHudCard';
import { CountdownTimerHud } from './CountdownTimerHud';
import { SubmissionFormCard } from './SubmissionFormCard';
import { StreamCrashModal } from './StreamCrashModal';
import { AwaitingVerificationCard } from './AwaitingVerificationCard';
import type { Tournament } from '../../tournament/types';
import { DEFAULT_POINTS_THRESHOLDS } from '../../tournament/types';
import type { OnlineQualSessionSummary } from '../../../api/qualifiers';
import { TournamentContext } from '../../tournament/store';

export interface CompetitorPortalViewProps {
  tournament: Tournament;
}

export const getPortalStorageKey = (tournamentId: string) => `tm_qual_portal_${tournamentId}`;

export interface PersistedPortalSession {
  playerId: string;
  playerName: string;
  twitchHandle: string;
  activeSession: OnlineQualSessionSummary;
  scores: number[];
  twitchVodUrl: string;
}

export function clearPersistedSession(tournamentId: string): void {
  const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage ? (globalThis as any).localStorage : null);
  if (!storage) return;
  try {
    storage.removeItem(getPortalStorageKey(tournamentId));
  } catch {
    // Ignore storage errors
  }
}

export function savePersistedSession(tournamentId: string, data: PersistedPortalSession): void {
  const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage ? (globalThis as any).localStorage : null);
  if (!storage) return;
  try {
    storage.setItem(getPortalStorageKey(tournamentId), JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPersistedSession(tournament: Tournament): PersistedPortalSession | null {
  const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage ? (globalThis as any).localStorage : null);
  if (!storage) return null;
  try {
    // If the tournament qualifiers are closed or locked, qual is over: clear and do not restore
    if (tournament.qualsClosed || tournament.isLocked) {
      clearPersistedSession(tournament.id);
      return null;
    }

    const raw = storage.getItem(getPortalStorageKey(tournament.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPortalSession;
    if (!parsed?.playerId || !parsed?.activeSession) return null;

    // Resilient against refresh ONLY applies to active in-progress runs, never if the qual is already over!
    if (parsed.activeSession.status !== 'IN_PROGRESS') {
      clearPersistedSession(tournament.id);
      return null;
    }

    // Reconcile with latest server submissions in tournament prop if present
    const subs = (tournament.qualifierSubmissions || []).filter(s => s.playerId === parsed.playerId);
    if (subs.length > 0) {
      const first = subs[0];
      // If the submission is no longer in progress (e.g. submitted, verified, dq, dnq), the qual is over!
      if (first.status && first.status !== 'IN_PROGRESS') {
        clearPersistedSession(tournament.id);
        return null;
      }
      const scoredRows = subs.filter(s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED');
      parsed.activeSession = {
        ...parsed.activeSession,
        status: first.status || parsed.activeSession.status,
        authWord: first.authWord || parsed.activeSession.authWord,
        twitchVodUrl: first.twitchVodUrl || parsed.activeSession.twitchVodUrl,
        timerLog: first.timerLog || parsed.activeSession.timerLog,
        scores: scoredRows.length > 0 ? scoredRows.map(s => s.score) : parsed.activeSession.scores,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

export const CompetitorPortalView: React.FC<CompetitorPortalViewProps> = ({ tournament }) => {
  const tournamentContext = useContext(TournamentContext);
  const refreshTournament = tournamentContext?.refreshTournament;

  const initialPersisted = loadPersistedSession(tournament);

  // Intake form state (strictly local until Pre-Flight confirmation)
  const [enteredPlayerName, setEnteredPlayerName] = useState(initialPersisted?.playerName || '');
  const [enteredTwitchHandle, setEnteredTwitchHandle] = useState(initialPersisted?.twitchHandle || '');

  // Active official session state
  const [resolvedPlayer, setResolvedPlayer] = useState<{ id: string; name: string } | null>(
    initialPersisted ? { id: initialPersisted.playerId, name: initialPersisted.playerName } : null
  );
  const [activeSession, setActiveSession] = useState<OnlineQualSessionSummary | null>(
    initialPersisted?.activeSession || null
  );

  // Modals state
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isCrashModalOpen, setIsCrashModalOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  // Form submission state
  const [scores, setScores] = useState<number[]>(initialPersisted?.scores || []);
  const [twitchVodUrl, setTwitchVodUrl] = useState(initialPersisted?.twitchVodUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [showPointsTooltip, setShowPointsTooltip] = useState(false);
  const windowMinutes = tournament.qualWindowMinutes || 90;
  const isQualsClosed = Boolean(tournament.qualsClosed || tournament.isLocked);

  // Derive Qualifier Format presentation
  const formatLabel = (() => {
    if (tournament.qualFormat === 'POINTS') return 'Points Qualifier';
    if (tournament.qualFormat === 'AVERAGE_OF_X') {
      const attempts = tournament.qualAverageCount || 3;
      return `Average of ${attempts} (Ao${attempts}) Qualifier`;
    }
    return 'High Score Qualifier';
  })();

  const pointsThresholds = (tournament.pointsConfig && tournament.pointsConfig.length > 0)
    ? [...tournament.pointsConfig].sort((a, b) => b.minScore - a.minScore)
    : [...DEFAULT_POINTS_THRESHOLDS].sort((a, b) => b.minScore - a.minScore);

  const handleScoresChange = (nextScores: number[]) => {
    setScores(nextScores);
    if (activeSession && resolvedPlayer && activeSession.status === 'IN_PROGRESS') {
      savePersistedSession(tournament.id, {
        playerId: resolvedPlayer.id,
        playerName: resolvedPlayer.name,
        twitchHandle: enteredTwitchHandle,
        activeSession,
        scores: nextScores,
        twitchVodUrl,
      });
    }
  };

  const handleVodUrlChange = (nextVodUrl: string) => {
    setTwitchVodUrl(nextVodUrl);
    if (activeSession && resolvedPlayer && activeSession.status === 'IN_PROGRESS') {
      savePersistedSession(tournament.id, {
        playerId: resolvedPlayer.id,
        playerName: resolvedPlayer.name,
        twitchHandle: enteredTwitchHandle,
        activeSession,
        scores,
        twitchVodUrl: nextVodUrl,
      });
    }
  };

  // Open Pre-Flight modal after validating non-empty local intake
  const handleOpenPreFlight = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanName = enteredPlayerName.trim();
    const cleanTwitch = enteredTwitchHandle.trim().replace(/^@/, '');

    if (!cleanName) {
      setErrorMessage('Please enter your Player Name / Alias.');
      return;
    }
    if (!cleanTwitch) {
      setErrorMessage('Please enter your Twitch channel or handle.');
      return;
    }

    const existingPlayer = (tournament.playersPool || []).find(
      p => p.name.trim().toLowerCase() === cleanName.toLowerCase() ||
           (p.twitchUsername && p.twitchUsername.trim().toLowerCase() === cleanTwitch.toLowerCase())
    );
    const hasExistingSession = Boolean(
      (tournament.qualifierSubmissions || []).some(
        s => (existingPlayer && s.playerId === existingPlayer.id) ||
             (s.submittedTwitchUsername && s.submittedTwitchUsername.trim().toLowerCase() === cleanTwitch.toLowerCase())
      )
    );

    if (hasExistingSession) {
      void handleStartRun();
      return;
    }

    setIsPreFlightOpen(true);
  };

  // Start Official Qual Run — called ONLY when the 4 pre-flight checkboxes are confirmed!
  // Deferred persistence: Zero database records are created until this definite user action.
  const handleStartRun = async () => {
    const cleanName = enteredPlayerName.trim();
    const cleanTwitch = enteredTwitchHandle
      .trim()
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '');

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: cleanName,
          twitchUsername: cleanTwitch,
          submittedTwitchUsername: cleanTwitch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start official run');

      setActiveSession(data);
      const pName = data.player?.name || data.playerName || cleanName;
      setResolvedPlayer({ id: data.playerId, name: pName });

      // Persist to localStorage only if the run is still in-progress
      if (data.status === 'IN_PROGRESS') {
        savePersistedSession(tournament.id, {
          playerId: data.playerId,
          playerName: pName,
          twitchHandle: enteredTwitchHandle || cleanTwitch,
          activeSession: data,
          scores,
          twitchVodUrl,
        });
      } else {
        clearPersistedSession(tournament.id);
      }

      setIsPreFlightOpen(false);
      setStatusNotice('Official qualifier run launched! Your NES Authword is ready.');
      void refreshTournament?.(tournament.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to launch qualifier run');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Official Scores
  const handleSubmitScores = async () => {
    if (!resolvedPlayer) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const positiveScores = scores.filter(s => typeof s === 'number' && s > 0);
      const finalScores = positiveScores.length > 0 ? positiveScores : scores;
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: resolvedPlayer.id,
          scores: finalScores,
          twitchVodUrl,
          submittedTwitchUsername: enteredTwitchHandle.trim().replace(/^@/, ''),
        }),
      });
      const session = await res.json();
      if (!res.ok) throw new Error(session.error || 'Submission failed');

      // The qual is officially submitted and over! Clear persisted session so subsequent visits don't lock to this user.
      clearPersistedSession(tournament.id);
      setActiveSession(session);

      setStatusNotice('Official qualifier submitted! Your provisional score is recorded.');
      await refreshTournament?.(tournament.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Report Stream Crash / Request Reset
  const handleReportCrash = async (reason: string) => {
    if (!resolvedPlayer) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: resolvedPlayer.id,
          reason,
        }),
      });
      const session = await res.json();
      if (!res.ok) throw new Error(session.error || 'Failed to report stream crash');

      setActiveSession(session);

      if (session.status === 'IN_PROGRESS') {
        savePersistedSession(tournament.id, {
          playerId: resolvedPlayer.id,
          playerName: resolvedPlayer.name,
          twitchHandle: enteredTwitchHandle,
          activeSession: session,
          scores,
          twitchVodUrl,
        });
      } else {
        clearPersistedSession(tournament.id);
      }

      setIsCrashModalOpen(false);
      setStatusNotice('Technical reset request transmitted to tournament judges.');
      await refreshTournament?.(tournament.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestSwitchCompetitor = () => {
    if (activeSession?.status === 'IN_PROGRESS') {
      setIsSwitchModalOpen(true);
      return;
    }
    handleConfirmSwitchCompetitor();
  };

  const handleConfirmSwitchCompetitor = () => {
    clearPersistedSession(tournament.id);
    setIsSwitchModalOpen(false);
    setActiveSession(null);
    setResolvedPlayer(null);
    setEnteredPlayerName('');
    setEnteredTwitchHandle('');
    setScores([]);
    setTwitchVodUrl('');
    setErrorMessage(null);
    setStatusNotice(null);
  };

  const cleanTwitchUsername = enteredTwitchHandle.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '');

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.25rem' }} data-testid="competitor-portal">
      {/* Tournament Qual Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', position: 'relative' }}>
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: 'var(--color-gold-bright, #fbbf24)',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            data-testid="qual-format-badge"
          >
            {formatLabel}
            {tournament.qualFormat === 'POINTS' && (
              <span
                onMouseEnter={() => setShowPointsTooltip(true)}
                onMouseLeave={() => setShowPointsTooltip(false)}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--color-gold-bright, #fbbf24)',
                }}
                title="View points threshold breakdown"
                data-testid="points-info-icon"
              >
                <HelpCircle size={14} />
              </span>
            )}
          </span>

          {showPointsTooltip && tournament.qualFormat === 'POINTS' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '0.35rem',
                background: 'var(--color-bg-surface-elevated, #161e27)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                zIndex: 100,
                minWidth: '220px',
              }}
              data-testid="points-breakdown-tooltip"
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-gold-bright, #fbbf24)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Points Cutoff Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {pointsThresholds.map((pt, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span>&ge; {pt.minScore.toLocaleString()}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-gold-bright, #fbbf24)' }}>{pt.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
          {tournament.name}
        </h1>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-secondary, #94a3b8)', lineHeight: 1.5 }}>
          Stream your games, verify with your NES Authword, and submit scores directly for adjudication.
        </p>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#f87171',
            marginBottom: '1.5rem',
          }}
          data-testid="portal-error-banner"
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Status Notice Banner */}
      {statusNotice && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#4ade80',
            marginBottom: '1.5rem',
          }}
          data-testid="portal-status-notice"
        >
          <CheckCircle size={20} style={{ flexShrink: 0 }} />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Qualifiers Closed Speedbump */}
      {isQualsClosed && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '10px',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <ShieldAlert size={28} color="#fbbf24" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fbbf24', fontWeight: 800 }}>
              Qualifiers Closed
            </h4>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
              Qualifying is closed or brackets have locked. Submissions are no longer accepted.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: Streamlined Competitor Intake (No OAuth / No premature DB persistence) */}
      {!activeSession ? (
        <div
          style={{
            background: 'var(--color-bg-surface, #121820)',
            border: '1px solid var(--color-border, #263342)',
            borderRadius: '14px',
            padding: '2.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}
          data-testid="competitor-checkin-card"
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-gold-bright, #fbbf24)',
            }}
          >
            <Gamepad2 size={32} />
          </div>

          <div style={{ textAlign: 'center', maxWidth: '520px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.5rem' }}>
              Competitor Qualification Check-In
            </h2>
            <p style={{ margin: 0, color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Enter your details to receive your NES Authword and launch your run.
            </p>
          </div>

          <form
            onSubmit={handleOpenPreFlight}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', width: '100%', maxWidth: '420px' }}
          >
            {/* Player Name / Alias */}
            <div>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.45rem' }}>
                Player Name / Alias *
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted, #64748b)' }}>
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={enteredPlayerName}
                  onChange={e => setEnteredPlayerName(e.target.value)}
                  placeholder="e.g. Sharky"
                  disabled={isSubmitting || isQualsClosed}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                    borderRadius: '8px',
                    background: 'var(--color-bg-base, #0a0e14)',
                    border: '1px solid var(--color-border, #263342)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                  data-testid="player-name-input"
                />
              </div>
            </div>

            {/* Twitch Channel / Handle */}
            <div>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.45rem' }}>
                Twitch Channel / Handle *
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#a855f7' }}>
                  <Tv size={18} />
                </div>
                <input
                  type="text"
                  value={enteredTwitchHandle}
                  onChange={e => setEnteredTwitchHandle(e.target.value)}
                  placeholder="e.g. ITZsharky1"
                  disabled={isSubmitting || isQualsClosed}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                    borderRadius: '8px',
                    background: 'var(--color-bg-base, #0a0e14)',
                    border: '1px solid var(--color-border, #263342)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                  data-testid="twitch-handle-input"
                />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.3rem', display: 'block' }}>
                Channel name or link (e.g., ITZsharky1). Direct links are automatically parsed.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isQualsClosed}
              style={{
                marginTop: '0.5rem',
                background: 'var(--color-gold-bright, #f59e0b)',
                color: '#000000',
                border: 'none',
                borderRadius: '8px',
                padding: '0.85rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: isQualsClosed ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                transition: 'all 0.15s ease',
              }}
              data-testid="start-preflight-button"
            >
              <Play size={18} fill="#000000" />
              Review Rules &amp; Checklist
            </button>
          </form>
        </div>
      ) : (
        /* Authenticated Active Competitor Workspace */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Competitor Identity Bar (only shown during active run before qual is done) */}
          {activeSession.status !== 'SUBMITTED' && activeSession.status !== 'VERIFIED' && (
            <div
              style={{
                background: 'var(--color-bg-surface, #121820)',
                border: '1px solid var(--color-border, #263342)',
                borderRadius: '12px',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
              data-testid="competitor-identity-bar"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: 'var(--color-gold-bright, #fbbf24)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {(resolvedPlayer?.name || activeSession.playerName || enteredPlayerName || 'C').slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>
                      {resolvedPlayer?.name || activeSession.playerName || enteredPlayerName}
                    </strong>
                    <span
                      style={{
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        color: '#4ade80',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                      data-testid="identity-status-badge"
                    >
                      Active Run
                    </span>
                  </div>
                  {(activeSession.submittedTwitchUsername || enteredTwitchHandle) && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '0.15rem' }}>
                      Twitch: <span style={{ color: '#a855f7' }}>@{activeSession.submittedTwitchUsername || cleanTwitchUsername}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestSwitchCompetitor}
                data-testid="switch-competitor-button"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border, #263342)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.85rem',
                  color: 'var(--color-text-secondary, #94a3b8)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title="Clear active session from this browser"
              >
                <LogOut size={13} /> Switch Competitor
              </button>
            </div>
          )}

          {activeSession.status === 'SUBMITTED' || activeSession.status === 'VERIFIED' ? (
            /* SUBMITTED / VERIFIED State */
            <AwaitingVerificationCard
              session={activeSession}
              tournamentSlug={tournament.slug}
              playerName={resolvedPlayer?.name || activeSession.playerName || enteredPlayerName}
              onDone={handleConfirmSwitchCompetitor}
            />
          ) : (
            /* ACTIVE RUN (IN_PROGRESS) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* HUD: Authword and Optional Countdown Timer */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                <AuthwordHudCard
                  authWord={activeSession.authWord}
                  onReportCrash={() => setIsCrashModalOpen(true)}
                />
                <CountdownTimerHud
                  timerLog={activeSession.timerLog}
                  qualWindowMinutes={windowMinutes}
                  isCompleted={false}
                />
              </div>

              {/* Score and VOD Submission Form */}
              <SubmissionFormCard
                qualFormat={tournament.qualFormat}
                qualAverageCount={tournament.qualAverageCount || 2}
                scores={scores}
                onScoresChange={handleScoresChange}
                twitchVodUrl={twitchVodUrl}
                onTwitchVodUrlChange={handleVodUrlChange}
                onSubmit={handleSubmitScores}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
                disabled={isQualsClosed}
              />
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <PreFlightModal
        isOpen={isPreFlightOpen}
        tournamentName={tournament.name}
        qualWindowMinutes={windowMinutes}
        qualFormat={tournament.qualFormat}
        qualAverageCount={tournament.qualAverageCount || 2}
        twitchUsername={cleanTwitchUsername}
        onConfirm={handleStartRun}
        onCancel={() => setIsPreFlightOpen(false)}
        isStarting={isSubmitting}
      />

      <StreamCrashModal
        isOpen={isCrashModalOpen}
        onSubmit={handleReportCrash}
        onClose={() => setIsCrashModalOpen(false)}
        isSubmitting={isSubmitting}
      />

      {/* Switch Competitor Confirmation Speedbump Modal */}
      {isSwitchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="switch-competitor-modal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--color-bg-surface-elevated, #161e27)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-gold-bright, #f59e0b)' }}>
                <AlertCircle size={20} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Switch Competitor?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted, #94a3b8)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  padding: '0.2rem',
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary, #94a3b8)', lineHeight: 1.5 }}>
              Your qualifier run for <strong style={{ color: '#ffffff' }}>{resolvedPlayer?.name || activeSession?.playerName}</strong> (Authword: <strong style={{ color: 'var(--color-gold-bright, #f59e0b)' }}>{activeSession?.authWord}</strong>) is currently marked as <strong style={{ color: 'var(--color-gold-bright, #f59e0b)' }}>In Progress</strong> on the leaderboard.
            </p>

            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.4 }}>
              It will remain In Progress until a Tournament Judge resolves it in <strong style={{ color: '#ffffff' }}>Qual Review</strong>, or until you resume and finish submitting under the same competitor name (<strong style={{ color: '#ffffff' }}>{resolvedPlayer?.name || activeSession?.playerName}</strong>).
            </p>

            {scores.some(s => typeof s === 'number' && s > 0) && (
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.8rem' }}>
                ⚠️ Any unsubmitted scores currently typed into the form will be cleared from this browser.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                data-testid="cancel-switch-competitor-button"
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Stay in Run
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchCompetitor}
                data-testid="confirm-switch-competitor-button"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#ef4444',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Switch Competitor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
