import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ExternalLink, Palette, Send } from 'lucide-react';
import { Organization } from '../../types';
import { labelStyle, inputStyle } from './types';

interface OrgBrandPaletteSectionProps {
  selectedOrg?: Organization;
  organizations: Organization[];
  organizationId: string;
  useOrgBranding: boolean;
  discordWebhookUrl: string;
  logoUrl: string;
  bannerUrl: string;
  webhookTestStatus: { ok: boolean; message: string } | null;
  onOrganizationIdChange: (id: string) => void;
  onUseOrgBrandingChange: (use: boolean) => void;
  onDiscordWebhookUrlChange: (url: string) => void;
  onLogoUrlChange: (url: string) => void;
  onBannerUrlChange: (url: string) => void;
  onApplyOrgColorsToTiers: () => void;
  onTestDiscordWebhook: () => void;
}

export const OrgBrandPaletteSection: React.FC<OrgBrandPaletteSectionProps> = ({
  selectedOrg,
  organizations,
  organizationId,
  useOrgBranding,
  discordWebhookUrl,
  logoUrl,
  bannerUrl,
  webhookTestStatus,
  onOrganizationIdChange,
  onUseOrgBrandingChange,
  onDiscordWebhookUrlChange,
  onLogoUrlChange,
  onBannerUrlChange,
  onApplyOrgColorsToTiers,
  onTestDiscordWebhook,
}) => {
  return (
    <section
      style={{
        background: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: '1.15rem 1.35rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={18} color="var(--color-gold-bright)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Host Organization &amp; Branding
          </h2>
        </div>
        {selectedOrg && (
          <Link
            to={`/org/${selectedOrg.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.78rem',
              color: 'var(--color-gold-bright)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 600,
            }}
          >
            <span>View {selectedOrg.shortName} Dashboard</span>
            <ExternalLink size={12} />
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Left Column: Organization Selection & Palette */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Parent Organization Circuit</label>
            <select
              value={organizationId}
              onChange={e => onOrganizationIdChange(e.target.value)}
              style={inputStyle}
            >
              {organizations.length === 0 ? (
                <option value="">None (Independent Tournament)</option>
              ) : (
                organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.shortName || org.slug})
                  </option>
                ))
              )}
            </select>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
              All match scores, career metrics, and qualifying leaderboards roll up to this organization.
            </span>
          </div>

          <div style={{ background: 'var(--color-bg-surface-elevated)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={useOrgBranding}
                  onChange={e => onUseOrgBrandingChange(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-gold-bright)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Inherit Organizational Theme
                </span>
              </label>

              {useOrgBranding && (selectedOrg?.themeColors || selectedOrg?.branding?.themeColors) && (
                <button
                  type="button"
                  onClick={onApplyOrgColorsToTiers}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', gap: '0.35rem', flexShrink: 0 }}
                  title="Copy these 5 colors to all tiers in this tournament"
                >
                  <Palette size={13} color="var(--color-gold-bright)" />
                  Apply
                </button>
              )}
            </div>

            {useOrgBranding && (selectedOrg?.themeColors || selectedOrg?.branding?.themeColors) && (
              (() => {
                const colors = selectedOrg.themeColors || selectedOrg.branding?.themeColors;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', paddingTop: '0.15rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                      Circuit 5-Color Theme:
                    </span>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Pri', color: colors?.primaryColor },
                        { label: 'Sec', color: colors?.secondaryColor },
                        { label: 'Card', color: colors?.cardColor },
                        { label: 'Text', color: colors?.textColor },
                        { label: 'Bg', color: colors?.backgroundColor },
                      ].map(swatch => (
                        <div key={swatch.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: swatch.color, border: '1px solid rgba(255,255,255,0.2)' }} />
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{swatch.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}

            {!useOrgBranding && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Custom regional mode: Each tier in this tournament will use its own custom colors and media independent of {selectedOrg?.shortName || 'the organization'}.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Logo/Banner Overrides & Discord Webhooks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Tournament Logo URL</label>
              <input
                type="text"
                value={logoUrl}
                onChange={e => onLogoUrlChange(e.target.value)}
                placeholder={selectedOrg?.branding?.logoUrl || 'https://.../logo.png'}
                style={inputStyle}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                {logoUrl ? 'Custom tournament logo' : `Default: ${selectedOrg?.shortName || 'Org'} logo`}
              </span>
            </div>
            <div>
              <label style={labelStyle}>Tournament Banner URL</label>
              <input
                type="text"
                value={bannerUrl}
                onChange={e => onBannerUrlChange(e.target.value)}
                placeholder={selectedOrg?.branding?.bannerUrl || 'https://.../banner.png'}
                style={inputStyle}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                {bannerUrl ? 'Custom tournament banner' : `Default: ${selectedOrg?.shortName || 'Org'} banner`}
              </span>
            </div>
          </div>

          {/* Discord Webhook Field */}
          <div style={{ background: 'var(--color-bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ ...labelStyle, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>Discord Webhook URL</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={discordWebhookUrl}
                onChange={e => onDiscordWebhookUrlChange(e.target.value)}
                placeholder={selectedOrg?.discordWebhookUrl || selectedOrg?.hasDiscordWebhook ? `Fallback: ${selectedOrg.shortName} Webhook` : 'https://discord.com/api/webhooks/...'}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={onTestDiscordWebhook}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap', gap: '0.35rem' }}
                title="Send a test message to this webhook (or the organization's fallback)"
              >
                <Send size={13} />
                Test
              </button>
            </div>

            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              {discordWebhookUrl.trim()
                ? 'Active tournament-specific webhook override.'
                : selectedOrg?.discordWebhookUrl || selectedOrg?.hasDiscordWebhook
                ? `Inherited from ${selectedOrg.name}'s webhook.`
                : 'No webhook configured. Qual announcements disabled.'}
            </span>

            {webhookTestStatus && (
              <div style={{ fontSize: '0.75rem', color: webhookTestStatus.ok ? '#34d399' : '#f87171', fontWeight: 600 }}>
                {webhookTestStatus.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
