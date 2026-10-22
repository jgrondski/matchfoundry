import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PlayerDirectoryStats,
  PlayerDirectoryFilterBar,
  PlayerDirectoryTable,
  PlayerDirectoryRow,
} from '../components/PlayerDirectorySections';
import { PlayerProfile } from '../../tournament/types';

describe('PlayerDirectorySections Component Decomposition', () => {
  const samplePlayers: PlayerProfile[] = [
    {
      id: 'p1',
      name: 'Blue Scuti',
      country: 'US',
      playstyle: 'Rolling',
      personalBest: 1350000,
    },
    {
      id: 'p2',
      name: 'Fractal',
      country: 'US',
      playstyle: 'Hypertap',
      personalBest: 1250000,
    },
    {
      id: 'p3',
      name: 'Jonas',
      country: 'US',
      playstyle: 'DAS',
      personalBest: 999999,
    },
  ];

  describe('PlayerDirectoryStats', () => {
    it('computes and renders summary analytics correctly', () => {
      const html = renderToStaticMarkup(<PlayerDirectoryStats globalPlayers={samplePlayers} />);
      expect(html).toContain('Total Global Competitors');
      expect(html).toContain('3');
      expect(html).toContain('Rolling: 1');
      expect(html).toContain('DAS: 1');
      expect(html).toContain('Hypertap: 1');
      expect(html).toContain('Highest Personal Best');
      expect(html).toContain('1,350,000');
      expect(html).toContain('Held by Blue Scuti');
      expect(html).toContain('Average Personal Best');
    });

    it('handles empty players array gracefully', () => {
      const html = renderToStaticMarkup(<PlayerDirectoryStats globalPlayers={[]} />);
      expect(html).toContain('Total Global Competitors');
      expect(html).toContain('0');
      expect(html).toContain('—');
      expect(html).toContain('No personal bests recorded');
    });
  });

  describe('PlayerDirectoryFilterBar', () => {
    it('renders search input, filter pills, and dropdowns', () => {
      const html = renderToStaticMarkup(
        <PlayerDirectoryFilterBar
          onSearchChange={vi.fn()}
          playstyleFilter="ALL"
          onPlaystyleChange={vi.fn()}
          orgFilter="ALL"
          onOrgFilterChange={vi.fn()}
          sortBy="PB_DESC"
          onSortChange={vi.fn()}
          organizations={[{ id: 'org_ctwc', name: 'Classic Tetris World Championship', slug: 'ctwc', createdAt: Date.now() }]}
        />
      );

      expect(html).toContain('placeholder="Search competitor name, country, notes..."');
      expect(html).toContain('All Styles');
      expect(html).toContain('Rolling');
      expect(html).toContain('DAS');
      expect(html).toContain('Hypertap');
      expect(html).toContain('Classic Tetris World Championship');
      expect(html).toContain('Sort: PB High to Low');
    });
  });

  describe('PlayerDirectoryRow', () => {
    it('renders competitor name, country flag, playstyle, and PB without duplicate avatar', () => {
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <PlayerDirectoryRow
              player={samplePlayers[0]}
              index={0}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
            />
          </tbody>
        </table>
      );

      expect(html).toContain('Blue Scuti');
      expect(html).toContain('Roll');
      expect(html).toContain('1,350,000');
      expect(html).toContain('MAXOUT');
      expect(html).toContain('US');
      // Must contain action buttons
      expect(html).toContain('title="Edit competitor profile"');
      expect(html).toContain('title="Delete competitor from catalog"');
    });
  });

  describe('PlayerDirectoryTable', () => {
    it('renders all player rows when players exist', () => {
      const html = renderToStaticMarkup(
        <PlayerDirectoryTable
          filteredPlayers={samplePlayers}
          totalPlayersCount={3}
          onEditPlayer={vi.fn()}
          onDeletePlayer={vi.fn()}
          onOpenGenerateModal={vi.fn()}
          onOpenAddModal={vi.fn()}
        />
      );

      expect(html).toContain('Blue Scuti');
      expect(html).toContain('Fractal');
      expect(html).toContain('Jonas');
      expect(html).toContain('#</th>');
      expect(html).toContain('Competitor</th>');
    });

    it('renders empty filter state when filtered players is empty but total > 0', () => {
      const html = renderToStaticMarkup(
        <PlayerDirectoryTable
          filteredPlayers={[]}
          totalPlayersCount={3}
          onEditPlayer={vi.fn()}
          onDeletePlayer={vi.fn()}
          onOpenGenerateModal={vi.fn()}
          onOpenAddModal={vi.fn()}
        />
      );

      expect(html).toContain('No Competitors Match Your Filter');
      expect(html).not.toContain('Generate Fake Players');
    });

    it('renders empty directory state with action buttons when catalog has 0 players', () => {
      const html = renderToStaticMarkup(
        <PlayerDirectoryTable
          filteredPlayers={[]}
          totalPlayersCount={0}
          onEditPlayer={vi.fn()}
          onDeletePlayer={vi.fn()}
          onOpenGenerateModal={vi.fn()}
          onOpenAddModal={vi.fn()}
        />
      );

      expect(html).toContain('Global Player Directory is Empty');
      expect(html).toContain('Generate Fake Players');
      expect(html).toContain('Add Competitor');
    });
  });
});
