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
import { ConfirmDialog } from '../../../components/overlay';
import { cn } from '../../../components/ui';

const speedbumpClass = 'mb-8 flex items-center gap-4 rounded-md border border-gold/35 bg-gold/10 p-6';
const outlineButtonClass =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-transparent px-3.5 py-1.5 text-caption font-semibold text-fg-secondary';

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
    <div className="mx-auto max-w-215 px-5 py-8" data-testid="competitor-portal">
      {/* Tournament Qual Header */}
      <div className="mb-8">
        <div className="relative mb-2 flex items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-2.5 py-1 text-caption font-extrabold uppercase tracking-wider text-gold-bright"
            data-testid="qual-format-badge"
          >
            {formatLabel}
            {tournament.qualFormat === 'POINTS' && <PointsInfoTip pointsConfig={tournament.pointsConfig} />}
          </span>
        </div>

        <h1 className="mx-0 mt-0 mb-2 text-4xl font-black tracking-tight text-white">
          {tournament.name}
        </h1>
        <p className="m-0 text-base leading-normal text-fg-secondary">
          Stream live, prove it with your Authword, submit scores.
        </p>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          className="mb-6 flex items-center gap-3 rounded-md border border-red/35 bg-red/10 px-5 py-4 text-red-bright"
          data-testid="portal-error-banner"
        >
          <AlertCircle size={20} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Status Notice Banner */}
      {statusNotice && (
        <div
          className="mb-6 flex items-center gap-3 rounded-md border border-green-500/35 bg-green-500/10 px-5 py-4 text-green-400"
          data-testid="portal-status-notice"
        >
          <CheckCircle size={20} className="shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Qualifiers Closed Speedbump */}
      {isQualsClosed && (
        <div className={speedbumpClass}>
          <ShieldAlert size={28} className="text-gold-bright shrink-0" />
          <div>
            <h4 className="m-0 text-lg font-extrabold text-gold-bright">
              Qualifiers Closed
            </h4>
            <p className="mx-0 mt-1 mb-0 text-sm text-fg-secondary">
              Qualifying is closed or brackets have locked. Submissions are no longer accepted.
            </p>
          </div>
        </div>
      )}

      {!isQualsClosed && !canStartRun && !activeSession && (
        <div
          className={speedbumpClass}
          data-testid="online-quals-not-open"
        >
          <ShieldAlert size={28} className="text-gold-bright shrink-0" />
          <div>
            <h4 className="m-0 text-lg font-extrabold text-gold-bright">
              Online Qualifying Not Open
            </h4>
            <p className="mx-0 mt-1 mb-0 text-sm text-fg-secondary">
              Online qualifying is not currently open for this tournament. New runs can't be started.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: Streamlined Competitor Intake (No OAuth / No premature DB persistence) */}
      {isRestoring && !activeSession ? (
        <div
          className="rounded-lg border border-line bg-surface p-10 text-center text-fg-secondary"
          data-testid="restoring-run"
        >
          Restoring your run...
        </div>
      ) : !activeSession ? (
        <div
          className="flex flex-col items-center gap-6 rounded-lg border border-line bg-surface p-10 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
          data-testid="competitor-checkin-card"
        >
          <div className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-gold-bright">
            <Gamepad2 size={32} />
          </div>

          <div className="max-w-130 text-center">
            <h2 className="mx-0 mt-0 mb-2 text-2xl font-black text-white">
              Competitor Qualification Check-In
            </h2>
            <p className="m-0 text-base leading-relaxed text-fg-secondary">
              Enter your details to receive your NES Authword and launch your run.
            </p>
          </div>

          <form
            onSubmit={handleOpenPreFlight}
            className="flex w-full max-w-105 flex-col gap-4.5"
          >
            {/* Player Name / Alias */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-200">
                Player Name / Alias *
              </label>
              <div className="relative">
                <div className="absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-muted">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={enteredPlayerName}
                  onChange={e => setEnteredPlayerName(e.target.value)}
                  placeholder="e.g. Sharky"
                  disabled={isSubmitting || !canStartRun}
                  required
                  className="w-full rounded-md border border-line bg-canvas py-3 pr-3.5 pl-10.5 text-base text-white"
                  data-testid="player-name-input"
                />
              </div>
            </div>

            {/* Twitch Channel / Handle */}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-200">
                Twitch Channel / Handle *
              </label>
              <div className="relative">
                <div className="absolute top-1/2 left-3.5 -translate-y-1/2 text-purple-500">
                  <Tv size={18} />
                </div>
                <input
                  type="text"
                  value={enteredTwitchHandle}
                  onChange={e => setEnteredTwitchHandle(e.target.value)}
                  placeholder="e.g. ITZsharky1"
                  disabled={isSubmitting || !canStartRun}
                  required
                  className="w-full rounded-md border border-line bg-canvas py-3 pr-3.5 pl-10.5 text-base text-white"
                  data-testid="twitch-handle-input"
                />
              </div>
              <span className="mt-1 block text-caption text-fg-muted">
                Channel name or link (e.g., ITZsharky1). Direct links are automatically parsed.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !canStartRun}
              className={cn(
                'mt-2 flex items-center justify-center gap-2.5 rounded-md border-0 bg-gold-bright px-6 py-3.5 text-base font-extrabold text-black shadow-[0_4px_14px_rgba(245,158,11,0.4)] transition-all duration-150',
                !canStartRun ? 'cursor-not-allowed' : 'cursor-pointer'
              )}
              data-testid="start-preflight-button"
            >
              <Play size={18} className="fill-black" />
              Review Rules &amp; Checklist
            </button>
            <span className="text-center text-caption text-fg-muted">
              Already started? Enter the same name and Twitch to resume.
            </span>
          </form>
        </div>
      ) : (
        /* Authenticated Active Competitor Workspace */
        <div className="flex flex-col gap-6">
          {/* Competitor Identity Bar (only shown during active run before qual is done) */}
          {activeSession.status !== 'SUBMITTED' && activeSession.status !== 'VERIFIED' && (
            <div
              className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-surface px-6 py-4"
              data-testid="competitor-identity-bar"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-10.5 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-lg font-extrabold text-gold-bright">
                  {(resolvedPlayer?.name || activeSession.playerName || enteredPlayerName || 'C').slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <strong className="text-lg text-white">
                    {resolvedPlayer?.name || activeSession.playerName || enteredPlayerName}
                  </strong>
                  {(activeSession.submittedTwitchUsername || enteredTwitchHandle) && (
                    <div className="mt-0.5 text-caption text-fg-secondary">
                      Twitch: <span className="text-purple-500">@{activeSession.submittedTwitchUsername || cleanTwitchUsername}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
              {resumeToken && (
                <span
                  className={cn('text-caption', draftStatus === 'error' ? 'text-red-bright' : 'text-fg-muted')}
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
                  className={outlineButtonClass}
                  title="Bookmark or open this link to get back to your run on any device"
                >
                  <Link2 size={13} /> {linkCopied ? 'Copied!' : 'Copy Run Link'}
                </button>
              )}
              <button
                type="button"
                onClick={handleRequestSwitchCompetitor}
                data-testid="switch-competitor-button"
                className={outlineButtonClass}
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
            <div className="flex flex-col gap-6">
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
      <ConfirmDialog
        open={isSwitchModalOpen}
        tone="warning"
        title="Switch Competitor?"
        body={
          <>
            <p className="leading-normal text-fg-secondary">
              Your run for <strong className="text-white">{resolvedPlayer?.name || activeSession?.playerName}</strong> (Authword: <strong className="text-gold-bright">{activeSession?.authWord}</strong>) stays open.
            </p>
            <p className="leading-snug text-fg-muted">
              To come back to it, use your run link or enter the same name and Twitch.
            </p>
            {(draftDirtyRef.current || !resumeToken) && scores.some(s => typeof s === 'number' && s > 0) && (
              <div className="rounded-sm border border-red/30 bg-red/10 px-3 py-2 text-caption text-red-300">
                ⚠️ Some scores haven't been saved to the server yet and will be lost.
              </div>
            )}
          </>
        }
        cancelLabel="Stay in Run"
        confirmLabel="Switch Competitor"
        onCancel={() => setIsSwitchModalOpen(false)}
        onConfirm={handleConfirmSwitchCompetitor}
      />
    </div>
  );
};
