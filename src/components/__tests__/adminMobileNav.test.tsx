import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AdminMobileTopBar } from '../AdminMobileTopBar';
import { AdminBottomNav, AdminBottomNavProps } from '../AdminBottomNav';
import { getPublicViewUrl } from '../TournamentSidebar';

function renderTopBar(publicUrl?: string) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <AdminMobileTopBar title="CTWC 2026 World Championship" publicUrl={publicUrl} />
    </MemoryRouter>
  );
}

function renderBottomNav(props: Partial<AdminBottomNavProps> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <AdminBottomNav
        slug="cup"
        pendingReviewCount={0}
        menuOpen={false}
        onToggleMenu={() => {}}
        onNavigate={() => {}}
        {...props}
      />
    </MemoryRouter>
  );
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
}

describe('AdminMobileTopBar', () => {
  it('renders the back link, the title and the Public link when publicUrl is set', () => {
    const html = renderTopBar('/cup/gold');
    expect(html).toMatch(/<a [^>]*aria-label="All tournaments"[^>]*href="\/"|<a [^>]*href="\/"[^>]*aria-label="All tournaments"/);
    expect(html).toContain('CTWC 2026 World Championship');
    expect(hrefs(html)).toEqual(['/', '/cup/gold']);
    expect(html).toContain('Public');
  });

  it('omits the Public link when publicUrl is not set', () => {
    const html = renderTopBar();
    expect(hrefs(html)).toEqual(['/']);
    expect(html).not.toContain('Public');
  });
});

describe('AdminBottomNav', () => {
  it('renders the four shortcut targets with a tier and a closed Menu button', () => {
    const html = renderBottomNav({ currentTierSlug: 'gold' });
    expect(hrefs(html)).toEqual([
      '/cup/manage/judge?tier=gold',
      '/cup/manage/qualifiers',
      '/cup/manage/review',
      '/cup/manage/bracket/gold',
    ]);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="admin-menu-sheet"');
    expect(html).toContain('>Menu<');
    expect(html).toContain('>Quals<');
  });

  it('renders the shortcut targets without a tier', () => {
    expect(hrefs(renderBottomNav())).toEqual([
      '/cup/manage/judge',
      '/cup/manage/qualifiers',
      '/cup/manage/review',
      '/cup/manage/bracket',
    ]);
  });

  it('shows Close and aria-expanded="true" when the menu is open', () => {
    const html = renderBottomNav({ menuOpen: true });
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('>Close<');
    expect(html).not.toContain('>Menu<');
  });

  it('marks only the active shortcut with aria-current="page"', () => {
    const html = renderBottomNav({ activeView: 'review' });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a [^>]*aria-current="page"[^>]*href="\/cup\/manage\/review"/);
  });

  it('renders the pending review count and its label', () => {
    const html = renderBottomNav({ pendingReviewCount: 3 });
    expect(html).toContain('aria-label="Review, 3 pending"');
    expect(html).toMatch(/>3<\/span>/);
  });

  it('omits the count when nothing is pending', () => {
    expect(renderBottomNav()).not.toContain('pending');
  });

  it('labels the qualifiers shortcut Seeding for manual seeding', () => {
    const html = renderBottomNav({ seedingMethod: 'MANUAL' });
    expect(html).toContain('>Seeding<');
    expect(html).not.toContain('>Quals<');
  });

  it('renders only the Menu button without a slug', () => {
    const html = renderBottomNav({ slug: undefined });
    expect(hrefs(html)).toEqual([]);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('>Menu<');
  });
});

describe('getPublicViewUrl', () => {
  it('links to the tier bracket when a tier is known', () => {
    expect(getPublicViewUrl('cup', 'gold')).toBe('/cup/gold');
  });

  it('links to the brackets page when there is no tier', () => {
    expect(getPublicViewUrl('cup', undefined)).toBe('/cup/brackets');
  });

  it('links to the tournament list without a slug', () => {
    expect(getPublicViewUrl(undefined, 'gold')).toBe('/');
  });
});
