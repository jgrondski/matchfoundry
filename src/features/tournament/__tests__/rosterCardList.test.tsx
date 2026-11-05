import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RosterCardList, formatPersonalBest } from '../components/RosterCardList';
import type { PlayerProfile } from '../types';

const players: PlayerProfile[] = [
  { id: 'p1', name: 'Alpha Roster', country: 'US', playstyle: 'Hypertap', personalBest: 1234567 },
  { id: 'p2', name: 'Bravo Roster', country: 'JP', playstyle: 'Rolling', personalBest: 987654 },
  { id: 'p3', name: 'Charlie Roster', personalBest: 0 },
] as PlayerProfile[];

const noop = () => {};

function render() {
  return renderToStaticMarkup(
    <RosterCardList players={players} onOpenPlayer={noop} onEditPlayer={noop} onRemovePlayer={noop} />
  );
}

describe('RosterCardList', () => {
  it('renders one card per player with its name and personal best', () => {
    const html = render();
    expect(html.match(/<li>/g)).toHaveLength(3);
    for (const p of players) {
      expect(html).toContain(p.name);
      expect(html).toContain(formatPersonalBest(p.personalBest));
    }
    expect(html).toContain(formatPersonalBest(1234567));
    expect(html).toContain('—');
  });

  it('gives every card Edit Competitor and Remove Competitor buttons', () => {
    const html = render();
    expect(html.match(/aria-label="Edit Competitor"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Remove Competitor"/g)).toHaveLength(3);
  });
});
