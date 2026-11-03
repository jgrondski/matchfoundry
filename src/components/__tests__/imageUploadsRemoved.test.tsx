import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PlayerEditModal } from '../../features/players/components/PlayerEditModal';
import { OrgMetadataModal } from '../../features/organizations/components/OrgMetadataModal';
import { OrgBrandPaletteSection } from '../../features/tournament/components/settings/OrgBrandPaletteSection';
import { PlayerProfile } from '../../features/tournament/types';

const customAvatarPlayer: PlayerProfile = {
  id: 'p-1',
  name: 'Custom Avatar Player',
  country: 'US',
  avatarType: 'custom',
  avatarUrl: 'data:image/png;base64,AAAA',
} as PlayerProfile;

describe('Image upload controls are removed', () => {
  it('PlayerEditModal for a new player has no file input and no Upload Photo button', () => {
    const html = renderToStaticMarkup(
      <PlayerEditModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialPlayer={null} existingNames={[]} />
    );
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('Upload Photo');
  });

  // The modal copies initialPlayer into state in a useEffect, which static rendering never runs, so
  // "Reset to Flag" (shown only for avatarType 'custom') cannot appear here. That button is unchanged by ER.10.
  it('PlayerEditModal for a player with a custom avatar has no Change Photo button', () => {
    const html = renderToStaticMarkup(
      <PlayerEditModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialPlayer={customAvatarPlayer}
        existingNames={[]}
      />
    );
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('Change Photo');
  });

  it('OrgMetadataModal has no logo or banner fields', () => {
    const html = renderToStaticMarkup(
      <OrgMetadataModal
        isOpen
        onClose={vi.fn()}
        isDirty={false}
        editName="Org"
        setEditName={vi.fn()}
        editSlug="org"
        setEditSlug={vi.fn()}
        editDescription=""
        setEditDescription={vi.fn()}
        editWebsite=""
        setEditWebsite={vi.fn()}
        deleteError={null}
        onDeleteOrganization={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('Logo URL');
    expect(html).not.toContain('Banner URL');
    expect(html).not.toContain('Browse');
  });

  it('OrgBrandPaletteSection has no tournament logo or banner fields', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OrgBrandPaletteSection
          organizations={[]}
          organizationId=""
          useOrgBranding={false}
          discordWebhookUrl=""
          webhookTestStatus={null}
          onOrganizationIdChange={vi.fn()}
          onUseOrgBrandingChange={vi.fn()}
          onDiscordWebhookUrlChange={vi.fn()}
          onApplyOrgColorsToTiers={vi.fn()}
          onTestDiscordWebhook={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('Tournament Logo URL');
    expect(html).not.toContain('Tournament Banner URL');
  });
});
