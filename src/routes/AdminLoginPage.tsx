import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { usePinAuth } from '../features/auth/AuthContext';
import { useTournament } from '../features/tournament/store';
import { KeyRound, ShieldAlert, ArrowLeft, Eye, EyeOff, Check, LogOut, Info } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '';
  const initialTourneySlug = searchParams.get('slug') || searchParams.get('tournament') || '';
  const needSystem = searchParams.get('needSystem') === 'true';

  const { login, logout, isSystemAdmin, session, canManage } = usePinAuth();
  const { tournaments } = useTournament();

  const [selectedTourneySlug, setSelectedTourneySlug] = useState(initialTourneySlug);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A post-login redirect must not fire after the user has already navigated away.
  useEffect(() => () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
  }, []);

  const availableTournaments = tournaments.filter(
    t => !(session?.role === 'TOURNAMENT_ADMIN' && (canManage(t.slug) || canManage(t.id)))
  );

  // Auto redirect ONLY if arriving with a specific redirectUrl and already authorized
  useEffect(() => {
    if (!redirectUrl) return;
    if (isSystemAdmin) {
      navigate(redirectUrl, { replace: true });
    } else if (selectedTourneySlug && canManage(selectedTourneySlug) && !needSystem) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isSystemAdmin, selectedTourneySlug, canManage, navigate, redirectUrl, needSystem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter a PIN');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await login(pin, selectedTourneySlug || undefined);
      if (!res.success) {
        setError(res.error || 'Invalid PIN');
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg('Authentication successful!');
      // A manage redirect for a different tournament than the one logged into would bounce back here.
      const redirectSlug = redirectUrl.split('/')[1] || '';
      const redirectFitsLogin =
        !selectedTourneySlug || !redirectUrl.includes('/manage') || redirectSlug === selectedTourneySlug;
      redirectTimerRef.current = setTimeout(() => {
        if (redirectUrl && redirectFitsLogin) {
          navigate(redirectUrl, { replace: true });
        } else if (selectedTourneySlug) {
          navigate(`/${selectedTourneySlug}/manage/qualifiers`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    setSuccessMsg('Logged out successfully');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-base, #0d1117)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'var(--color-bg-surface, #161b22)',
          border: '1px solid var(--color-border, #30363d)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Back Link */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--color-text-muted, #8b949e)',
            fontSize: '0.8rem',
            textDecoration: 'none',
            alignSelf: 'flex-start',
            transition: 'color 0.15s ease',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to All Tournaments</span>
        </Link>

        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--color-gold-bright, #ffd700), #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            <KeyRound size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
              Staff & Admin Login
            </h1>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #8b949e)' }}>
              MatchFoundry™ Access Control
            </p>
          </div>
        </div>

        {/* Existing Session Alert if active */}
        {session && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              padding: '0.85rem 1rem',
              backgroundColor: isSystemAdmin ? 'rgba(56, 189, 248, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: isSystemAdmin ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSystemAdmin ? '#38bdf8' : 'var(--color-gold-bright)' }}>
                  Active Session:{' '}
                  {isSystemAdmin
                    ? '🛡️ System Admin (All Access)'
                    : session.tournamentSlugs && session.tournamentSlugs.length > 1
                    ? `🏆 Tournament Admin (${session.tournamentSlugs.length} Tournaments: ${session.tournamentSlugs.join(', ')})`
                    : `🏆 Tournament Admin (${session.tournamentSlug || 'Scoped'})`}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                  {isSystemAdmin
                    ? 'You have global access across all tournaments.'
                    : session.tournamentSlugs && session.tournamentSlugs.length > 1
                    ? 'You are authenticated for multiple tournaments. Enter credentials below to switch.'
                    : 'You are authenticated for this tournament. Enter credentials below to switch.'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}
              >
                <LogOut size={12} /> Log Out
              </button>
            </div>
            {!isSystemAdmin && session.tournamentSlug && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                <Link
                  to={`/${session.tournamentSlug}/manage/qualifiers`}
                  className="btn btn-primary"
                  style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
                >
                  Go to {session.tournamentSlug} Workspace →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Reason / Context Alert */}
        {needSystem && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '8px',
              color: 'var(--color-gold-bright)',
              fontSize: '0.82rem',
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>System Admin Key required to access this administrative section.</span>
          </div>
        )}

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '8px',
              color: '#34d399',
              fontSize: '0.85rem',
            }}
          >
            <Check size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Tournament Scope Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary, #c9d1d9)',
                marginBottom: '0.4rem',
              }}
            >
              Tournament Scope (Optional for System Admin)
            </label>
            <select
              value={selectedTourneySlug}
              onChange={e => setSelectedTourneySlug(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
                backgroundColor: 'var(--color-bg-base, #0d1117)',
                border: '1px solid var(--color-border, #30363d)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              <option value="">Global / System Admin (All Tournaments)</option>
              {availableTournaments.map(t => (
                <option key={t.id} value={t.slug}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>

          {/* PIN Input */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary, #c9d1d9)',
                marginBottom: '0.4rem',
              }}
            >
              Security Key / PIN
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value)}
                autoFocus
                placeholder="Enter PIN or Key"
                style={{
                  width: '100%',
                  padding: '0.65rem 2.5rem 0.65rem 0.75rem',
                  backgroundColor: 'var(--color-bg-base, #0d1117)',
                  border: '1px solid var(--color-border, #30363d)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  letterSpacing: '0.08em',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted, #8b949e)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
                tabIndex={-1}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !pin.trim()}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--color-gold-bright, #ffd700)',
              color: '#000000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: isSubmitting || !pin.trim() ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !pin.trim() ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {isSubmitting ? 'Authenticating...' : 'Unlock Administration'}
          </button>
        </form>

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <Link
            to={selectedTourneySlug ? `/${selectedTourneySlug}/brackets` : '/'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted, #8b949e)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} />
            <span>Return to Public Tournament View</span>
          </Link>
        </div>
      </div>

      {/* Footer / Common-Law Trademark Notice */}
      <footer style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' }}>
        <p style={{ margin: 0 }}>© 2026 MatchFoundry™. All rights reserved.</p>
      </footer>
    </div>
  );
};
