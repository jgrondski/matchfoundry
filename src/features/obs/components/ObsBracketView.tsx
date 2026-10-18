import React, { useEffect } from 'react';
import { Tournament, TournamentTier } from '../../tournament/types';
import { BracketVisualizer } from '../../bracket/components/BracketVisualizer';
import { BracketViewMode } from '../../bracket/bracketLayout';
import { TournamentQualTimerHud } from '../../qualifiers/components/TournamentQualTimerHud';

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
      ? '#00ff00'
      : chroma.toLowerCase() === 'magenta'
      ? '#ff00ff'
      : chroma.toLowerCase() === 'blue'
      ? '#0000ff'
      : `#${chroma}`
    : 'transparent';

  return (
    <div
      className="obs-bracket-container"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: chromaBg,
        overflow: viewMode === 'fit' ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 100 }}>
        <TournamentQualTimerHud tournament={tournament} isObsMode={true} />
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

