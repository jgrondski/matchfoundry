import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Gamepad2,
  Tv,
  CheckCircle,
  AlertCircle,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { PreFlightModal } from './PreFlightModal';
import { IdentityClaimModal, UnclaimedPlayerOption } from './IdentityClaimModal';
import { AuthwordHudCard } from './AuthwordHudCard';
import { CountdownTimerHud } from './CountdownTimerHud';
import { SubmissionFormCard } from './SubmissionFormCard';
import { StreamCrashModal } from './StreamCrashModal';
import { AwaitingVerificationCard } from './AwaitingVerificationCard';
import type { Tournament, PlayerProfile, IdentityStatus } from '../../tournament/types';
import type { OnlineQualSessionSummary } from '../../../api/qualifiers';

export interface CompetitorPortalViewProps {
  tournament: Tournament;
}

interface TwitchUserProfile {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
}

export const CompetitorPortalView: React.FC<CompetitorPortalViewProps> = ({ tournament }) => {
  const [searchParams] = useSearchParams();

  // Ephemeral State owned by Tier 2 View
  const [twitchUser, setTwitchUser] = useState<TwitchUserProfile | null>(null);
  const [resolvedPlayer, setResolvedPlayer] = useState<PlayerProfile | null>(null);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus | null>(null);
  const [activeSession, setActiveSession] = useState<OnlineQualSessionSummary | null>(null);

  // Modals state
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isCrashModalOpen, setIsCrashModalOpen] = useState(false);

  // Form submission state
  const [scores, setScores] = useState<number[]>([]);
  const [twitchVodUrl, setTwitchVodUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Quick dev/mock handle input state
  const [mockInputHandle, setMockInputHandle] = useState('SharkyDAS');

  // Load existing session when resolvedPlayer is set
  const refreshSession = async (playerId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/session?playerId=${playerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setActiveSession(data);
          if (data.scores?.length > 0) {
            setScores(data.scores);
          }
          if (data.twitchVodUrl) {
            setTwitchVodUrl(data.twitchVodUrl);
          }
        }
      }
    } catch {
      // Ignore network recovery error
    }
  };

  // Resolve Twitch Identity against backend
  const resolveIdentity = async (user: TwitchUserProfile) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/resolve-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitchId: user.id,
          twitchUsername: user.login,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Identity resolution failed');
      }

      const data = await res.json();
      if (data.identityStatus === 'VERIFIED_MATCH' && data.player) {
        setResolvedPlayer(data.player);
        setIdentityStatus('VERIFIED_MATCH');
        await refreshSession(data.player.id);
      } else {
        // Unlinked competitor: open Claim/Register modal
        setIsClaimModalOpen(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resolve identity');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle incoming OAuth callback code in URL
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      // Clean up code from browser address bar
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);

      // Exchange code for Twitch profile
      (async () => {
        try {
          setIsSubmitting(true);
          const res = await fetch('/api/auth/twitch/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.twitchUser) {
            setTwitchUser(data.twitchUser);
            await resolveIdentity(data.twitchUser);
          } else {
            setErrorMessage(data.error || 'Twitch authentication failed');
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Twitch authentication error');
        } finally {
          setIsSubmitting(false);
        }
      })();
    }
  }, [searchParams]);

  // Connect via Mock Twitch (Instant for testing / dev)
  const handleConnectMock = async (customHandle?: string) => {
    const handle = customHandle || mockInputHandle.trim() || 'MockPlayer';
    const mockUser: TwitchUserProfile = {
      id: `tw_${handle.toLowerCase()}`,
      login: handle.toLowerCase(),
      displayName: handle,
      profileImageUrl: `https://avatar.vercel.sh/${handle.toLowerCase()}.png`,
    };
    setTwitchUser(mockUser);
    await resolveIdentity(mockUser);
  };

  // Connect via Twitch OAuth URL
  const handleConnectTwitch = () => {
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = `/api/auth/twitch/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  // Claim Roster Profile action
  const handleClaimRoster = async (playerId: string) => {
    if (!twitchUser) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/claim-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitchId: twitchUser.id,
          twitchUsername: twitchUser.login,
          mode: 'CLAIM_ROSTER',
          playerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim roster profile');

      setResolvedPlayer(data.player);
      setIdentityStatus('CLAIMED_PENDING_REVIEW');
      setIsClaimModalOpen(false);
      await refreshSession(data.player.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Register Walk-In New Competitor action
  const handleRegisterNew = async (newPlayer: { name: string; country: string; playstyle: string }) => {
    if (!twitchUser) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/claim-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitchId: twitchUser.id,
          twitchUsername: twitchUser.login,
          mode: 'NEW_PLAYER',
          newPlayer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register new competitor');

      setResolvedPlayer(data.player);
      setIdentityStatus('PROVISIONAL_NEW');
      setIsClaimModalOpen(false);
      await refreshSession(data.player.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start Official Qual Run (from PreFlight modal)
  const handleStartRun = async () => {
    if (!resolvedPlayer) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: resolvedPlayer.id,
          submittedTwitchId: twitchUser?.id,
          submittedTwitchUsername: twitchUser?.login,
          identityStatus,
        }),
      });
      const session = await res.json();
      if (!res.ok) throw new Error(session.error || 'Failed to start official run');

      setActiveSession(session);
      setIsPreFlightOpen(false);
      setStatusNotice('Official qualifier run launched! Your NES Authword is ready.');
    } catch (err: any) {
      setErrorMessage(err.message);
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
          submittedTwitchId: twitchUser?.id,
          submittedTwitchUsername: twitchUser?.login,
          identityStatus,
        }),
      });
      const session = await res.json();
      if (!res.ok) throw new Error(session.error || 'Submission failed');

      setActiveSession(session);
      setStatusNotice('Official qualifier submitted! Your provisional rank is live on the leaderboard.');
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
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate unclaimed roster players
  const unclaimedPlayers: UnclaimedPlayerOption[] = (tournament.playersPool || [])
    .filter(p => !p.twitchId)
    .map(p => ({
      id: p.id,
      name: p.name,
      country: p.country,
      playstyle: p.playstyle,
    }));

  const windowMinutes = tournament.qualWindowMinutes || 90;
  const isQualsClosed = Boolean(tournament.qualsClosed || tournament.isLocked);

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

      {/* STEP 1: Twitch OAuth Connect */}
      {!twitchUser ? (
        <div
          style={{
            background: 'var(--color-bg-surface, #121820)',
            border: '1px solid var(--color-border, #263342)',
            borderRadius: '14px',
            padding: '2.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}
          data-testid="twitch-connect-card"
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
            }}
          >
            <Tv size={32} />
          </div>

          <div style={{ maxWidth: '520px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.5rem' }}>
              Connect with Twitch to Begin
            </h2>
            <p style={{ margin: 0, color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Twitch authentication links your broadcast channel, automatically matches your tournament registration,
              and allows adjudicators to audit your live Authword timestamp.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '320px' }}>
            <button
              onClick={handleConnectTwitch}
              disabled={isSubmitting || isQualsClosed}
              style={{
                background: '#9146ff',
                color: '#ffffff',
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
                boxShadow: '0 4px 14px rgba(145, 70, 255, 0.4)',
              }}
              data-testid="twitch-oauth-button"
            >
              <Tv size={20} />
              Connect with Twitch
            </button>

            {/* Quick Mock Login for Local / Testing */}
            <div
              style={{
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--color-border, #263342)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Testing / Development Mode
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={mockInputHandle}
                  onChange={e => setMockInputHandle(e.target.value)}
                  placeholder="Handle (e.g. SharkyDAS)"
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    background: 'var(--color-bg-base, #0a0e14)',
                    border: '1px solid var(--color-border, #263342)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                  data-testid="mock-handle-input"
                />
                <button
                  type="button"
                  onClick={() => handleConnectMock()}
                  disabled={isSubmitting || isQualsClosed}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--color-border, #263342)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.85rem',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  data-testid="mock-login-button"
                >
                  Mock Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Authenticated Competitor Workspace */
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
              {twitchUser.profileImageUrl ? (
                <img
                  src={twitchUser.profileImageUrl}
                  alt={twitchUser.displayName}
                  style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                />
              ) : (
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#a855f7',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                  }}
                >
                  {twitchUser.displayName.slice(0, 1)}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                    {resolvedPlayer ? resolvedPlayer.name : twitchUser.displayName}
                  </strong>
                  {identityStatus && (
                    <span
                      style={{
                        background:
                          identityStatus === 'VERIFIED_MATCH'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        border: `1px solid ${
                          identityStatus === 'VERIFIED_MATCH'
                            ? 'rgba(34, 197, 94, 0.4)'
                            : 'rgba(245, 158, 11, 0.4)'
                        }`,
                        color: identityStatus === 'VERIFIED_MATCH' ? '#4ade80' : '#fbbf24',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                      data-testid="identity-status-badge"
                    >
                      {identityStatus === 'VERIFIED_MATCH'
                        ? 'Verified Competitor'
                        : identityStatus === 'CLAIMED_PENDING_REVIEW'
                        ? 'Claimed (Pending Review)'
                        : 'Provisional New'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '0.15rem' }}>
                  Twitch: <span style={{ color: '#a855f7' }}>@{twitchUser.login}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setTwitchUser(null);
                setResolvedPlayer(null);
                setActiveSession(null);
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border, #263342)',
                borderRadius: '6px',
                padding: '0.4rem 0.85rem',
                color: 'var(--color-text-secondary, #94a3b8)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          </div>

          {/* ACTIVE STATE DISPATCH */}
          {!resolvedPlayer ? (
            /* Unresolved Identity Card */
            <div
              style={{
                background: 'var(--color-bg-surface, #121820)',
                border: '1px solid var(--color-border, #263342)',
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <h3 style={{ margin: 0, color: '#ffffff' }}>Claim Your Tournament Profile</h3>
              <p style={{ margin: 0, color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.92rem' }}>
                We could not automatically match <strong>@{twitchUser.login}</strong> with an existing verified profile.
                Choose to claim your roster spot or register as a walk-in competitor.
              </p>
              <button
                onClick={() => setIsClaimModalOpen(true)}
                style={{
                  background: 'var(--color-gold-bright, #f59e0b)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                data-testid="open-claim-modal-button"
              >
                Resolve Competitor Identity
              </button>
            </div>
          ) : !activeSession ? (
            /* Launch Official Qual Hero Card */
            <div
              style={{
                background: 'var(--color-bg-surface, #121820)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '14px',
                padding: '2.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              }}
              data-testid="launch-qual-hero"
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold-bright, #fbbf24)',
                }}
              >
                <Gamepad2 size={30} />
              </div>

              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.5rem' }}>
                  Ready to Begin Official Qualification?
                </h2>
                <p style={{ margin: 0, color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.95rem', maxWidth: '540px', lineHeight: 1.5 }}>
                  Launching your session will issue your <strong>6–8 character NES verification Authword</strong> and
                  start the <strong>{windowMinutes}-minute countdown timer</strong>.
                </p>
              </div>

              <button
                onClick={() => setIsPreFlightOpen(true)}
                disabled={isSubmitting || isQualsClosed}
                style={{
                  background: 'var(--color-gold-bright, #f59e0b)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.85rem 2rem',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  cursor: isQualsClosed ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
                }}
                data-testid="start-preflight-button"
              >
                <Play size={20} fill="#000000" />
                Start Pre-Flight Checklist
              </button>
            </div>
          ) : activeSession.status === 'SUBMITTED' || activeSession.status === 'VERIFIED' ? (
            /* SUBMITTED / VERIFIED State */
            <AwaitingVerificationCard session={activeSession} tournamentSlug={tournament.slug} />
          ) : (
            /* ACTIVE RUN (IN_PROGRESS) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* HUD: Authword and Countdown Timer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
        twitchUsername={twitchUser?.login || ''}
        onConfirm={handleStartRun}
        onCancel={() => setIsPreFlightOpen(false)}
        isStarting={isSubmitting}
      />

      {twitchUser && (
        <IdentityClaimModal
          isOpen={isClaimModalOpen}
          unclaimedPlayers={unclaimedPlayers}
          twitchUser={twitchUser}
          onClaimRoster={handleClaimRoster}
          onRegisterNew={handleRegisterNew}
          onCancel={() => setIsClaimModalOpen(false)}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
        />
      )}

      <StreamCrashModal
        isOpen={isCrashModalOpen}
        onSubmit={handleReportCrash}
        onClose={() => setIsCrashModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
