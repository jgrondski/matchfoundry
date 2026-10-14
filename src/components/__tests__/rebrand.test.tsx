import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TopNavSwitcher } from '../TopNavSwitcher';
import { TournamentSidebar } from '../TournamentSidebar';
import { TournamentSwitcherPage } from '../../routes/TournamentSwitcherPage';
import { AdminLoginPage } from '../../routes/AdminLoginPage';
import { TournamentProvider } from '../../features/tournament/store';
import { OrganizationProvider } from '../../features/organizations/store';
import { AuthProvider } from '../../features/auth/AuthContext';
import { createEmptyTournament } from '../../features/tournament/defaults';
import fs from 'fs';
import path from 'path';

describe('MatchFoundry™ Rebrand & Common-Law Trademark Verification', () => {
  const mockTournaments = [
    createEmptyTournament({
      id: 'tourney-mf',
      name: 'MatchFoundry Open 2026',
      slug: 'mf-2026',
    }),
  ];

  it('verifies index.html page title has MatchFoundry™', () => {
    const htmlPath = path.resolve(__dirname, '../../../index.html');
    const indexHtml = fs.readFileSync(htmlPath, 'utf-8');
    expect(indexHtml).toContain('<title>MatchFoundry™ | Tournament Command Center</title>');
  });

  it('verifies package.json has name "matchfoundry"', () => {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBe('matchfoundry');
  });

  it('renders MatchFoundry™ in TopNavSwitcher logo', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={mockTournaments} initialHydrated={true}>
              <TopNavSwitcher />
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('MATCH');
    expect(html).toContain('FOUNDRY');
    expect(html).toContain('™');
  });

  it('renders MatchFoundry™ in TournamentSidebar logo and title', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/mf-2026/manage/qualifiers']}>
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={mockTournaments} initialHydrated={true}>
              <TournamentSidebar />
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('title="MatchFoundry™ Home"');
    expect(html).toContain('MATCH');
    expect(html).toContain('FOUNDRY');
    expect(html).toContain('™');
  });

  it('renders MatchFoundry™ logo and legal copyright footer in TournamentSwitcherPage', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={mockTournaments} initialHydrated={true}>
              <TournamentSwitcherPage />
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('MATCH');
    expect(html).toContain('FOUNDRY');
    expect(html).toContain('™');
    expect(html).toContain('© 2026 MatchFoundry™. All rights reserved.');
  });

  it('renders MatchFoundry™ Access Control and legal footer in AdminLoginPage', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={mockTournaments} initialHydrated={true}>
              <AdminLoginPage />
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('MatchFoundry™ Access Control');
    expect(html).toContain('© 2026 MatchFoundry™. All rights reserved.');
  });
});
