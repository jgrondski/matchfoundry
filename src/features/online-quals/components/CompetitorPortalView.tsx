import { useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Gamepad2,
  Tv,
  CheckCircle,
  AlertCircle,
  Play,
  ShieldAlert,
  User,
  LogOut,
  Link2,
} from 'lucide-react';
import { PreFlightModal } from './PreFlightModal';
import { AuthwordHudCard } from './AuthwordHudCard';
import { SubmissionFormCard } from './SubmissionFormCard';
import { AwaitingVerificationCard } from './AwaitingVerificationCard';
import type { Tournament } from '../../tournament/types';
import { PointsInfoTip } from '../../qualifiers/components/PointsInfoTip';
import type { OnlineQualSessionSummary } from '../../../api/qualifiers';
import { TournamentContext } from '../../tournament/store';
import { isOnlineQualsOpen } from '../onlineQualsStatus';

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
  playerNotes?: string;
  // Token from the `?run=` link; absent for runs started before run links existed.
  resumeToken?: string;
  // True while this browser holds edits the server has not confirmed saving.
  draftDirty?: boolean;
}

const DRAFT_SAVE_DELAY_MS = 800;
const DRAFT_RETRY_DELAY_MS = 5000;

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

    // Reconcile with the server's rows for this player. Row order is arbitrary, so look for the
    // in-progress row itself; if the player has rows but none in progress, the qual is over.
    const subs = (tournament.qualifierSubmissions || []).filter(s => s.playerId === parsed.playerId);
    if (subs.length > 0) {
      const live = subs.find(s => s.status === 'IN_PROGRESS');
      if (!live) {
        clearPersistedSession(tournament.id);
        return null;
      }
      parsed.activeSession = {
        ...parsed.activeSession,
        authWord: live.authWord || parsed.activeSession.authWord,
        timerLog: live.timerLog || parsed.activeSession.timerLog,
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

  const [searchParams, setSearchParams] = useSearchParams();
  const urlToken = searchParams.get('run');

  // Read once on mount. A run link for a different run than the one saved here wins.
  const [initialPersisted] = useState(() => {
    const persisted = loadPersistedSession(tournament);
    return urlToken && persisted?.resumeToken !== urlToken ? null : persisted;
  });

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
  const [resumeToken, setResumeToken] = useState<string | null>(urlToken || initialPersisted?.resumeToken || null);
  // A run link with nothing saved in this browser shows a loading state until the server answers.
  const [isRestoring, setIsRestoring] = useState(Boolean(urlToken && !initialPersisted));

  // Modals state
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  // Form submission state
  const [scores, setScores] = useState<number[]>(initialPersisted?.scores || []);
  const [twitchVodUrl, setTwitchVodUrl] = useState(initialPersisted?.twitchVodUrl || '');
  const [playerNotes, setPlayerNotes] = useState(initialPersisted?.playerNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Draft autosave: edits bump editSeq; a save only clears the dirty flag if nothing changed meanwhile.
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftRetryTick, setDraftRetryTick] = useState(0);
  const draftDirtyRef = useRef(Boolean(initialPersisted?.draftDirty));
  const editSeqRef = useRef(0);
  const [linkCopied, setLinkCopied] = useState(false);

  const windowMinutes = tournament.qualWindowMinutes || 90;
  const isQualsClosed = Boolean(tournament.qualsClosed || tournament.isLocked);
  // New runs need the organizer's opt-in; a run already in progress can still be submitted.
  const canStartRun = isOnlineQualsOpen(tournament);

  // Derive Qualifier Format presentation
  const formatLabel = (() => {
    if (tournament.qualFormat === 'POINTS') return 'Points Qualifier';
    if (tournament.qualFormat === 'AVERAGE_OF_X') {
      const attempts = tournament.qualAverageCount || 3;
      return `Average of ${attempts} (Ao${attempts}) Qualifier`;
    }
    return '# of Maxes';
  })();

  const setRunParam = (token: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (token) next.set('run', token);
      else next.delete('run');
      return next;
    }, { replace: true });
  };

  const persistRun = (overrides: Partial<PersistedPortalSession> = {}) => {
    if (!activeSession || !resolvedPlayer || activeSession.status !== 'IN_PROGRESS') return;
    savePersistedSession(tournament.id, {
      playerId: resolvedPlayer.id,
      playerName: resolvedPlayer.name,
      twitchHandle: enteredTwitchHandle,
      activeSession,
      scores,
      twitchVodUrl,
      playerNotes,
      resumeToken: resumeToken || undefined,
      draftDirty: draftDirtyRef.current,
      ...overrides,
    });
  };

  const handleDraftEdit = (overrides: Pick<Partial<PersistedPortalSession>, 'scores' | 'twitchVodUrl' | 'playerNotes'>) => {
    editSeqRef.current += 1;
    draftDirtyRef.current = true;
    persistRun({ ...overrides, draftDirty: true });
  };

  const handleScoresChange = (nextScores: number[]) => {
    setScores(nextScores);
    handleDraftEdit({ scores: nextScores });
  };

  const handleVodUrlChange = (nextVodUrl: string) => {
    setTwitchVodUrl(nextVodUrl);
    handleDraftEdit({ twitchVodUrl: nextVodUrl });
  };

  const handlePlayerNotesChange = (nextNotes: string) => {
    setPlayerNotes(nextNotes);
    handleDraftEdit({ playerNotes: nextNotes });
  };

  const resetToIntake = () => {
    clearPersistedSession(tournament.id);
    setRunParam(null);
    setResumeToken(null);
    draftDirtyRef.current = false;
    setDraftStatus('idle');
    setActiveSession(null);
    setResolvedPlayer(null);
    setScores([]);
    setTwitchVodUrl('');
    setPlayerNotes('');
  };

  // The server is the source of truth for a run with a token: load it once on mount.
  useEffect(() => {
    if (!resumeToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/tournaments/${tournament.id}/qualify/run?token=${encodeURIComponent(resumeToken)}`
        );
        if (cancelled) return;
        if (res.status === 404) {
          resetToIntake();
          setErrorMessage('That run link is no longer active.');
          return;
        }
        // Server or network trouble: keep this browser's copy and let autosave catch up later.
        if (!res.ok) return;
        const run = (await res.json()) as OnlineQualSessionSummary;
        if (cancelled) return;

        // Edits this device never managed to save beat the server's older draft.
        const keepLocal = draftDirtyRef.current || !run.draft;
        const nextScores = keepLocal ? scores : run.draft?.scores || [];
        const nextVod = keepLocal ? twitchVodUrl : run.draft?.twitchVodUrl || '';
        const nextNotes = keepLocal ? playerNotes : run.draft?.playerNotes || '';
        const playerName = run.playerName || initialPersisted?.playerName || '';
        const twitchHandle = initialPersisted?.twitchHandle || run.submittedTwitchUsername || '';

        setActiveSession(run);
        setResolvedPlayer({ id: run.playerId, name: playerName });
        setEnteredPlayerName(playerName);
        setEnteredTwitchHandle(twitchHandle);
        setScores(nextScores);
        setTwitchVodUrl(nextVod);
        setPlayerNotes(nextNotes);
        savePersistedSession(tournament.id, {
          playerId: run.playerId,
          playerName,
          twitchHandle,
          activeSession: run,
          scores: nextScores,
          twitchVodUrl: nextVod,
          playerNotes: nextNotes,
          resumeToken,
          draftDirty: draftDirtyRef.current,
        });
        if (draftDirtyRef.current) setDraftRetryTick(t => t + 1);
      } catch {
        // Offline: keep this browser's copy.
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: later token changes come from start/submit/switch, which already hold the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the run link in the address bar while a tokened run is in progress.
  useEffect(() => {
    if (activeSession?.status === 'IN_PROGRESS' && resumeToken && urlToken !== resumeToken) {
      setRunParam(resumeToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.status, resumeToken, urlToken]);

  // Autosave the draft to the server shortly after edits stop; retry until it lands.
  useEffect(() => {
    if (!draftDirtyRef.current || !resumeToken || activeSession?.status !== 'IN_PROGRESS') return;
    const seq = editSeqRef.current;
    const timer = setTimeout(async () => {
      setDraftStatus('saving');
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}/qualify/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeToken, scores, twitchVodUrl, playerNotes }),
        });
        if (res.status === 403) {
          setDraftStatus('error');
          setErrorMessage('This run is no longer active. A judge may have closed it.');
          return;
        }
        if (!res.ok) throw new Error('Draft save failed');
        if (editSeqRef.current === seq) {
          draftDirtyRef.current = false;
          persistRun({ draftDirty: false });
        }
        setDraftStatus('saved');
      } catch {
        setDraftStatus('error');
        setTimeout(() => setDraftRetryTick(t => t + 1), DRAFT_RETRY_DELAY_MS);
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, twitchVodUrl, playerNotes, resumeToken, activeSession?.status, draftRetryTick]);

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

  // Start Official Qual Run — called ONLY when the pre-flight checkboxes are confirmed,
  // or directly to resume a run that already exists for this competitor.
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
        // Resuming: the server's draft restores everything typed so far.
        const draft = (data as OnlineQualSessionSummary).draft;
        const nextScores = draft ? draft.scores || [] : scores;
        const nextVod = draft ? draft.twitchVodUrl || '' : twitchVodUrl;
        const nextNotes = draft ? draft.playerNotes || '' : playerNotes;
        setScores(nextScores);
        setTwitchVodUrl(nextVod);
        setPlayerNotes(nextNotes);
        setResumeToken(data.resumeToken || null);
        draftDirtyRef.current = false;
        savePersistedSession(tournament.id, {
          playerId: data.playerId,
          playerName: pName,
          twitchHandle: enteredTwitchHandle || cleanTwitch,
          activeSession: data,
          scores: nextScores,
          twitchVodUrl: nextVod,
          playerNotes: nextNotes,
          resumeToken: data.resumeToken || undefined,
        });
      } else {
        clearPersistedSession(tournament.id);
      }

      setIsPreFlightOpen(false);
      setStatusNotice(
        data.isNewSession === false && data.status === 'IN_PROGRESS'
          ? 'Welcome back. Your run has been restored.'
          : 'Authword Ready. Start your timer when authword is entered, and remember your final game in progress when the timer ends will count.'
      );
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
          playerNotes,
          resumeToken: resumeToken || undefined,
          submittedTwitchUsername: enteredTwitchHandle.trim().replace(/^@/, ''),
        }),
      });
      const session = await res.json();
      if (!res.ok) throw new Error(session.error || 'Submission failed');

      // The qual is officially submitted and over! Clear persisted session so subsequent visits don't lock to this user.
      clearPersistedSession(tournament.id);
      setRunParam(null);
      setResumeToken(null);
      draftDirtyRef.current = false;
      setDraftStatus('idle');
      setActiveSession(session);

      setStatusNotice('Official qualifier submitted! Your provisional score is recorded.');
      await refreshTournament?.(tournament.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRunLink = async () => {
    if (!resumeToken) return;
    const link = `${window.location.origin}/${tournament.slug}/qualify?run=${resumeToken}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy your run link:', link);
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
    resetToIntake();
    setIsSwitchModalOpen(false);
    setEnteredPlayerName('');
    setEnteredTwitchHandle('');
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
            {tournament.qualFormat === 'POINTS' && <PointsInfoTip pointsConfig={tournament.pointsConfig} />}
          </span>
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
          {tournament.name}
        </h1>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-secondary, #94a3b8)', lineHeight: 1.5 }}>
          Stream live, prove it with your Authword, submit scores.
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

      {!isQualsClosed && !canStartRun && !activeSession && (
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
          data-testid="online-quals-not-open"
        >
          <ShieldAlert size={28} color="#fbbf24" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fbbf24', fontWeight: 800 }}>
              Online Qualifying Not Open
            </h4>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
              Online qualifying is not currently open for this tournament. New runs can't be started.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: Streamlined Competitor Intake (No OAuth / No premature DB persistence) */}
      {isRestoring && !activeSession ? (
        <div
          style={{
            background: 'var(--color-bg-surface, #121820)',
            border: '1px solid var(--color-border, #263342)',
            borderRadius: '14px',
            padding: '2.5rem',
            textAlign: 'center',
            color: 'var(--color-text-secondary, #94a3b8)',
          }}
          data-testid="restoring-run"
        >
          Restoring your run...
        </div>
      ) : !activeSession ? (
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
                  disabled={isSubmitting || !canStartRun}
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
                  disabled={isSubmitting || !canStartRun}
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
              disabled={isSubmitting || !canStartRun}
              style={{
                marginTop: '0.5rem',
                background: 'var(--color-gold-bright, #f59e0b)',
                color: '#000000',
                border: 'none',
                borderRadius: '8px',
                padding: '0.85rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: !canStartRun ? 'not-allowed' : 'pointer',
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
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', textAlign: 'center' }}>
              Already started? Enter the same name and Twitch to resume.
            </span>
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
                  <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>
                    {resolvedPlayer?.name || activeSession.playerName || enteredPlayerName}
                  </strong>
                  {(activeSession.submittedTwitchUsername || enteredTwitchHandle) && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '0.15rem' }}>
                      Twitch: <span style={{ color: '#a855f7' }}>@{activeSession.submittedTwitchUsername || cleanTwitchUsername}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {resumeToken && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: draftStatus === 'error' ? '#f87171' : 'var(--color-text-muted, #64748b)',
                  }}
                  data-testid="draft-save-status"
                >
                  {draftStatus === 'saving' && 'Saving...'}
                  {draftStatus === 'saved' && 'Saved'}
                  {draftStatus === 'error' && 'Not saved, retrying'}
                </span>
              )}
              {resumeToken && (
                <button
                  type="button"
                  onClick={handleCopyRunLink}
                  data-testid="copy-run-link-button"
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
                  title="Bookmark or open this link to get back to your run on any device"
                >
                  <Link2 size={13} /> {linkCopied ? 'Copied!' : 'Copy Run Link'}
                </button>
              )}
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
              {/* HUD: Authword (session time is recorded for judges but not shown to competitors) */}
              <AuthwordHudCard authWord={activeSession.authWord} />

              {/* Score and VOD Submission Form */}
              <SubmissionFormCard
                qualFormat={tournament.qualFormat}
                qualAverageCount={tournament.qualAverageCount || 2}
                pointsConfig={tournament.pointsConfig}
                scores={scores}
                onScoresChange={handleScoresChange}
                twitchVodUrl={twitchVodUrl}
                onTwitchVodUrlChange={handleVodUrlChange}
                playerNotes={playerNotes}
                onPlayerNotesChange={handlePlayerNotesChange}
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
      {/* Mounted only while open so every opening (e.g. after switching competitor) starts with
          all checklist boxes unchecked. */}
      {isPreFlightOpen && (
        <PreFlightModal
          isOpen
          tournamentName={tournament.name}
          qualWindowMinutes={windowMinutes}
          qualFormat={tournament.qualFormat}
          qualAverageCount={tournament.qualAverageCount || 2}
          pointsConfig={tournament.pointsConfig}
          twitchUsername={cleanTwitchUsername}
          onConfirm={handleStartRun}
          onCancel={() => setIsPreFlightOpen(false)}
          isStarting={isSubmitting}
        />
      )}

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
              Your run for <strong style={{ color: '#ffffff' }}>{resolvedPlayer?.name || activeSession?.playerName}</strong> (Authword: <strong style={{ color: 'var(--color-gold-bright, #f59e0b)' }}>{activeSession?.authWord}</strong>) stays open.
            </p>

            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.4 }}>
              To come back to it, use your run link or enter the same name and Twitch.
            </p>

            {(draftDirtyRef.current || !resumeToken) && scores.some(s => typeof s === 'number' && s > 0) && (
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.8rem' }}>
                ⚠️ Some scores haven't been saved to the server yet and will be lost.
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
