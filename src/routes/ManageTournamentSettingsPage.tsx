import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { Tournament } from '../features/tournament/types';
import { TournamentLayout } from '../components/TournamentLayout';
import { TournamentAdminForm } from '../features/tournament/components/TournamentAdminForm';
import { Settings } from 'lucide-react';
import { LoadingScreen } from '../components/LoadingScreen';
import { DiscardChangesDialog } from '../components/overlay';

/**
 * Tier 1: Route Gate (Hydration & Data Boundary)
 * - Zero local form state
 * - Zero useEffects
 * - Unconditional hook execution
 */
export const ManageTournamentSettingsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading tournament settings..." />;
  }

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  if (!tournament) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h2>Tournament Not Found</h2>
        <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Tournaments
        </button>
      </div>
    );
  }

  return <TournamentSettingsView key={tournament.id} tournament={tournament} />;
};

/**
 * Tier 2: Keyed Feature View
 * - key={tournament.id} guarantees clean state reset on tournament switch without useEffect
 * - Manages unsaved changes navigation guard and layout
 */
interface TournamentSettingsViewProps {
  tournament: Tournament;
}

const TournamentSettingsView: React.FC<TournamentSettingsViewProps> = ({ tournament }) => {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const handleNavigateAttempt = (url: string) => {
    if (url.includes(`/${tournament.slug}/manage/settings`)) {
      return true;
    }
    if (isDirty) {
      setPendingNavigation(url);
      return false;
    }
    return true;
  };

  const handleStay = () => {
    setPendingNavigation(null);
  };

  const handleConfirmLeave = () => {
    const dest = pendingNavigation;
    setPendingNavigation(null);
    setIsDirty(false);
    if (dest) {
      navigate(dest);
    }
  };

  return (
    <TournamentLayout
      tournament={tournament}
      activeView="settings"
      onNavigate={handleNavigateAttempt}
    >
      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '1100px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--color-gold-bright)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Tournament Administration &amp; Configuration
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.65rem', letterSpacing: '-0.02em', margin: 0 }}>
            <Settings color="var(--color-gold-bright)" size={28} />
            {tournament.name}
          </h1>
        </div>

        <TournamentAdminForm
          key={tournament.id}
          tournament={tournament}
          onDirtyChange={setIsDirty}
          onSaved={(saved) => {
            setIsDirty(false);
            if (saved?.slug && saved.slug !== tournament.slug) {
              navigate(`/${saved.slug}/manage/settings`, { replace: true });
            }
          }}
        />
      </main>

      {/* Unsaved Changes Speedbump Modal */}
      <DiscardChangesDialog open={pendingNavigation !== null} onKeepEditing={handleStay} onDiscard={handleConfirmLeave} />
    </TournamentLayout>
  );
};
