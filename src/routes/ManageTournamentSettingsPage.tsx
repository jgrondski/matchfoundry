import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { Tournament } from '../features/tournament/types';
import { TournamentLayout } from '../components/TournamentLayout';
import { TournamentAdminForm } from '../features/tournament/components/TournamentAdminForm';
import { Settings } from 'lucide-react';
import { LoadingScreen } from '../components/LoadingScreen';
import { Button } from '../components/ui';
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
      <div className="p-12 text-center text-fg-secondary">
        <h2 className="text-2xl font-bold">Tournament Not Found</h2>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          Back to Tournaments
        </Button>
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
      <main className="mx-auto flex w-full max-w-275 flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-caption font-bold tracking-widest text-gold-bright uppercase">
              Tournament Administration &amp; Configuration
            </span>
          </div>
          <h1 className="m-0 flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-white">
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
