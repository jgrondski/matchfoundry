import { useContext, useState, useEffect } from 'react';
import {
  Gamepad2,
  Tv,
  CheckCircle,
  AlertCircle,
  Play,
  ShieldAlert,
  User,
  LogOut,
} from 'lucide-react';
import { PreFlightModal } from './PreFlightModal';
import { AuthwordHudCard } from './AuthwordHudCard';
import { CountdownTimerHud } from './CountdownTimerHud';
import { SubmissionFormCard } from './SubmissionFormCard';
import { StreamCrashModal } from './StreamCrashModal';
import { AwaitingVerificationCard } from './AwaitingVerificationCard';
import type { Tournament } from '../../tournament/types';
import type { OnlineQualSessionSummary } from '../../../api/qualifiers';
import { TournamentContext } from '../../tournament/store';

export interface CompetitorPortalViewProps {
  tournament: Tournament;
}

export const CompetitorPortalView: React.FC<CompetitorPortalViewProps> = ({ tournament }) => {
  const tournamentContext = useContext(TournamentContext);
  const refreshTournament = tournamentContext?.refreshTournament;
  // Intake form state (strictly local until Pre-Flight confirmation)
  const [enteredPlayerName, setEnteredPlayerName] = useState('');
  const [enteredTwitchHandle, setEnteredTwitchHandle] = useState('');

  // Active official session state
  const [resolvedPlayer, setResolvedPlayer] = useState<{ id: string; name: string } | null>(null);
  const [activeSession, setActiveSession] = useState<OnlineQualSessionSummary | null>(null);

  // Modals state
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isCrashModalOpen, setIsCrashModalOpen] = useState(false);

  // Form submission state
  const [scores, setScores] = useState<number[]>([]);
  const [twitchVodUrl, setTwitchVodUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const windowMinutes = tournament.qualWindowMinutes || 90;
  const isQualsClosed = Boolean(tournament.qualsClosed || tournament.isLocked);

  // Restore existing session on mount or refresh
  const refreshSession = async (playerId: string, fallbackName?: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/session?playerId=${playerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.playerId) {
          setActiveSession(data);
          setResolvedPlayer({
            id: data.playerId,
            name: data.playerName || fallbackName || enteredPlayerName || 'Competitor',
          });
          if (data.submittedTwitchUsername) {
            setEnteredTwitchHandle(data.submittedTwitchUsername);
          }
          if (data.scores?.length > 0) {
            setScores(data.scores);
          }
          if (data.twitchVodUrl) {
            setTwitchVodUrl(data.twitchVodUrl);
          }
        } else {
          localStorage.removeItem(`online_qual_session_${tournament.id}`);
          setActiveSession(null);
          setResolvedPlayer(null);
        }
      } else {
        localStorage.removeItem(`online_qual_session_${tournament.id}`);
        setActiveSession(null);
        setResolvedPlayer(null);
      }
    } catch {
      // Ignore network recovery error
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`online_qual_session_${tournament.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.playerId) {
          void refreshSession(parsed.playerId, parsed.playerName);
        }
      }
    } catch {
      // Ignore storage error
    }
  }, [tournament.id]);

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

      try {
        localStorage.setItem(
          `online_qual_session_${tournament.id}`,
          JSON.stringify({ playerId: data.playerId, playerName: pName })
        );
      } catch {
        // Storage fail safe
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
      setIsCrashModalOpen(false);
      setStatusNotice('Technical reset request transmitted to tournament judges.');
      await refreshTournament?.(tournament.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearSession = () => {
    try {
      localStorage.removeItem(`online_qual_session_${tournament.id}`);
    } catch {
      // Ignore
    }
    setActiveSession(null);
    setResolvedPlayer(null);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
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
            }}
          >
            {tournament.qualMode || 'HYBRID'} Qualifiers
          </span>
          <span style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.85rem' }}>
            &bull; Window: {windowMinutes} min
          </span>
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
          {tournament.name}
        </h1>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-secondary, #94a3b8)', lineHeight: 1.5 }}>
          Official Competitor Self-Service Portal. Stream your games, verify with your assigned NES Authword,
          and submit your scores directly to tournament adjudicators.
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
              Official qualifying for this tournament has completed or brackets have locked. No further submissions are accepted.
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
              Enter your player name and Twitch channel. You'll review the pre-flight checklist and receive your
              official NES Authword before launching your run.
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
                  placeholder="e.g. Sharky DAS"
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
                  placeholder="e.g. sharkydas"
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
                Stream your games live on this channel with VOD storage enabled.
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
          {/* Competitor Identity Bar */}
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
              onClick={handleClearSession}
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

          {activeSession.status === 'SUBMITTED' || activeSession.status === 'VERIFIED' ? (
            /* SUBMITTED / VERIFIED State */
            <AwaitingVerificationCard session={activeSession} tournamentSlug={tournament.slug} />
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
                onScoresChange={setScores}
                twitchVodUrl={twitchVodUrl}
                onTwitchVodUrlChange={setTwitchVodUrl}
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
    </div>
  );
};
