import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BarChart3, GitBranch, Trophy } from 'lucide-react';
import { SpectatorBottomNav } from '../SpectatorBottomNav';
import type { SpectatorNavItem } from '../SpectatorLayout';

const items: SpectatorNavItem[] = [
  { id: 'bracket', label: 'Brackets', icon: GitBranch, to: '/cup/gold' },
  { id: 'leaderboard', label: 'Qualifiers', icon: BarChart3, to: '/cup/leaderboard' },
  { id: 'standings', label: 'Standings', icon: Trophy, to: '/cup/standings' },
];

function render(activeView: SpectatorNavItem['id']) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SpectatorBottomNav items={items} activeView={activeView} />
    </MemoryRouter>
  );
}

describe('SpectatorBottomNav', () => {
  it('renders one link per item with its href and label', () => {
    const html = render('leaderboard');
    const links = html.match(/<a [^>]*>.*?<\/a>/g) ?? [];
    expect(links).toHaveLength(3);
    items.forEach((item, i) => {
      expect(links[i]).toContain(`href="${item.to}"`);
      expect(links[i]).toContain(`<span>${item.label}</span>`);
    });
  });

  it('marks only the active item with aria-current="page"', () => {
    const html = render('leaderboard');
    const links = html.match(/<a [^>]*>.*?<\/a>/g) ?? [];
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(links[1]).toContain('aria-current="page"');
    expect(links[0]).not.toContain('aria-current');
    expect(links[2]).not.toContain('aria-current');
  });
});
