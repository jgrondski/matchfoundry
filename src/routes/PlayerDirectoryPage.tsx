import React from 'react';
import { PlayerDirectory } from '../features/players/components/PlayerDirectory';
import { TopNavSwitcher } from '../components/TopNavSwitcher';

export const PlayerDirectoryPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-canvas px-0 pt-0 pb-16">
      <TopNavSwitcher />
      <main className="mx-auto w-full max-w-295 px-6 py-8">
        <PlayerDirectory />
      </main>
    </div>
  );
};
