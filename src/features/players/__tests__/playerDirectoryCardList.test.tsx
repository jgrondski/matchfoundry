import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerDirectoryCardList } from '../components/PlayerDirectoryCardList';
import { formatPersonalBest } from '../components/PlayerDirectorySections';
import type { PlayerProfile } from '../../tournament/types';

const NOTE = 'Prefers the left monitor';

const players: PlayerProfile[] = [
  { id: 'd1', name: 'Alpha Directory', country: 'US', playstyle: 'Hypertap', personalBest: 1234567, notes: NOTE },
  { id: 'd2', name: 'Bravo Directory', country: 'JP', playstyle: 'Rolling', personalBest: 987654 },
  { id: 'd3', name: 'Charlie Directory', personalBest: 0 },
] as PlayerProfile[];

const noop = () => {};

function render() {
  return renderToStaticMarkup(
    <PlayerDirectoryCardList players={players} onEditPlayer={noop} onDeletePlayer={noop} />
  );
}

describe('PlayerDirectoryCardList', () => {
  it('renders one card per player with its name and personal best', () => {
    const html = render();
    expect(html.match(/<li>/g)).toHaveLength(3);
    for (const p of players) {
      expect(html).toContain(p.name);
      expect(html).toContain(formatPersonalBest(p.personalBest));
    }
    expect(html).toContain('1,234,567');
    expect(html).toContain('—');
  });

  it('shows the notes line only for the player with notes', () => {
    const html = render();
    expect(html.match(/line-clamp-2/g)).toHaveLength(1);
    expect(html.split(NOTE)).toHaveLength(2);
    const cards = html.split('<li>').slice(1);
    expect(cards[0]).toContain(NOTE);
    expect(cards[1]).not.toContain('line-clamp-2');
    expect(cards[2]).not.toContain('line-clamp-2');
  });

  it('gives every card its edit and delete buttons with aria-labels', () => {
    const html = render();
    expect(html.match(/aria-label="Edit Competitor"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Delete Competitor"/g)).toHaveLength(3);
  });
});
