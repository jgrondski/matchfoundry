import React, { useEffect } from 'react';
import { Tournament, TournamentTier } from '../../tournament/types';
import { BracketVisualizer } from '../../bracket/components/BracketVisualizer';
import { BracketViewMode } from '../../bracket/bracketLayout';
import { TournamentQualTimerHud } from '../../qualifiers/components/TournamentQualTimerHud';
import { cn } from '../../../components/ui';
import { CHROMA_KEY_COLORS } from '../../../theme/palette';

export interface ObsBracketViewProps {
  tournament: Tournament;
  tier: TournamentTier;
  viewMode?: BracketViewMode;
  chroma?: string | null;
}

export const ObsBracketView: React.FC<ObsBracketViewProps> = ({
  tournament,
  tier,
  viewMode = 'fit',
  chroma = null,
}) => {
  // Ensure document body has transparent overlay styling
  useEffect(() => {
    document.body.classList.add('obs-overlay-mode');
    return () => {
      document.body.classList.remove('obs-overlay-mode');
    };
  }, []);

  const chromaBg = chroma
    ? chroma.startsWith('#')
      ? chroma
      : chroma.toLowerCase() === 'green'
      ? CHROMA_KEY_COLORS.green
      : chroma.toLowerCase() === 'magenta'
      ? CHROMA_KEY_COLORS.magenta
      : chroma.toLowerCase() === 'blue'
      ? CHROMA_KEY_COLORS.blue
      : `#${chroma}`
    : 'transparent';

  return (
    <div
      className={cn(
        'obs-bracket-container fixed inset-0 w-screen h-screen flex flex-col',
        viewMode === 'fit' ? 'overflow-hidden' : 'overflow-auto'
      )}
      style={{ background: chromaBg }}
    >
      <div className="absolute top-4 right-4 z-100">
        <TournamentQualTimerHud tournament={tournament} isObsMode={true} readOnly={true} />
      </div>
      <BracketVisualizer
        tournament={tournament}
        tier={tier}
        isObsMode={true}
        canManage={false}
        obsView={viewMode}
        chroma={chroma}
      />
    </div>
  );
};

