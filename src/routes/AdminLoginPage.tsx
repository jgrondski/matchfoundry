import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { usePinAuth } from '../features/auth/AuthContext';
import { useTournament } from '../features/tournament/store';
import { KeyRound, ShieldAlert, ArrowLeft, Eye, EyeOff, Check, LogOut, Info } from 'lucide-react';
import { Button, buttonClasses, cn } from '../components/ui';

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 font-sans">
      <div className="flex w-full max-w-107.5 flex-col gap-5 rounded-md border border-line bg-surface p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 self-start text-caption text-fg-muted no-underline transition-colors duration-150"
        >
          <ArrowLeft size={14} />
          <span>Back to All Tournaments</span>
        </Link>

        {/* Top Header */}
        <div className="flex items-center gap-3.5">
          <div className="flex size-10.5 items-center justify-center rounded-md bg-linear-135 from-gold-bright to-gold text-black shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
            <KeyRound size={22} />
          </div>
          <div>
            <h1 className="m-0 text-xl font-extrabold text-white">
              Staff & Admin Login
            </h1>
            <p className="mx-0 mt-0.5 mb-0 text-caption text-fg-muted">
              MatchFoundry™ Access Control
            </p>
          </div>
        </div>

        {/* Existing Session Alert if active */}
        {session && (
          <div
            className={cn(
              'flex flex-col gap-2.5 rounded-md border px-4 py-3.5',
              isSystemAdmin ? 'border-sky-400/35 bg-sky-400/10' : 'border-gold/35 bg-gold/10'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className={cn('text-caption font-bold', isSystemAdmin ? 'text-sky-400' : 'text-gold-bright')}>
                  Active Session:{' '}
                  {isSystemAdmin
                    ? '🛡️ System Admin (All Access)'
                    : session.tournamentSlugs && session.tournamentSlugs.length > 1
                    ? `🏆 Tournament Admin (${session.tournamentSlugs.length} Tournaments: ${session.tournamentSlugs.join(', ')})`
                    : `🏆 Tournament Admin (${session.tournamentSlug || 'Scoped'})`}
                </div>
                <div className="text-xs text-fg-muted">
                  {isSystemAdmin
                    ? 'You have global access across all tournaments.'
                    : session.tournamentSlugs && session.tournamentSlugs.length > 1
                    ? 'You are authenticated for multiple tournaments. Enter credentials below to switch.'
                    : 'You are authenticated for this tournament. Enter credentials below to switch.'}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={handleLogout}
                className="flex shrink-0 items-center gap-1 px-2.5 py-1 text-xs"
              >
                <LogOut size={12} /> Log Out
              </Button>
            </div>
            {!isSystemAdmin && session.tournamentSlug && (
              <div className="mt-1 flex gap-2">
                <Link
                  to={`/${session.tournamentSlug}/manage/qualifiers`}
                  className={buttonClasses({
                    variant: 'primary',
                    className: 'px-3 py-1.5 text-xs hover:-translate-y-px hover:shadow-gold-hover hover:brightness-110',
                  })}
                >
                  Go to {session.tournamentSlug} Workspace →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Reason / Context Alert */}
        {needSystem && (
          <div className="flex items-center gap-2 rounded-md border border-gold/35 bg-gold/12 px-3.5 py-2.5 text-caption text-gold-bright">
            <Info size={16} className="shrink-0" />
            <span>System Admin Key required to access this administrative section.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red/40 bg-red/15 px-4 py-3 text-sm text-red-bright">
            <ShieldAlert size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-md border border-green/40 bg-green/15 px-4 py-3 text-sm text-green-bright">
            <Check size={18} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Tournament Scope Selector */}
          <div>
            <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
              Tournament Scope (Optional for System Admin)
            </label>
            <select
              value={selectedTourneySlug}
              onChange={e => setSelectedTourneySlug(e.target.value)}
              className="w-full rounded-md border border-line bg-canvas px-3 py-2.5 text-sm text-white outline-none"
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
            <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
              Security Key / PIN
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value)}
                autoFocus
                placeholder="Enter PIN or Key"
                className="w-full rounded-md border border-line bg-canvas py-2.5 pr-10 pl-3 text-base tracking-widest text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute top-1/2 right-2.5 flex -translate-y-1/2 cursor-pointer border-0 bg-transparent p-1 text-fg-muted"
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
            className={cn(
              'rounded-md border-0 bg-gold-bright p-3 text-base font-bold text-black transition-opacity duration-150',
              isSubmitting || !pin.trim() ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'
            )}
          >
            {isSubmitting ? 'Authenticating...' : 'Unlock Administration'}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-2 text-center">
          <Link
            to={selectedTourneySlug ? `/${selectedTourneySlug}/brackets` : '/'}
            className="inline-flex items-center gap-1.5 text-caption text-fg-muted no-underline"
          >
            <ArrowLeft size={14} />
            <span>Return to Public Tournament View</span>
          </Link>
        </div>
      </div>

      {/* Footer / Common-Law Trademark Notice */}
      <footer className="mt-8 text-center text-xs text-fg-muted">
        <p className="m-0">© 2026 MatchFoundry™. All rights reserved.</p>
      </footer>
    </div>
  );
};
