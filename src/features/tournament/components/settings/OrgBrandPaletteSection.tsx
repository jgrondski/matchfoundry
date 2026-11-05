import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ExternalLink, Palette, Send } from 'lucide-react';
import { Organization } from '../../types';
import { labelClass, inputClass } from './types';
import { Button, cn } from '../../../../components/ui';

interface OrgBrandPaletteSectionProps {
  selectedOrg?: Organization;
  organizations: Organization[];
  organizationId: string;
  useOrgBranding: boolean;
  discordWebhookUrl: string;
  webhookTestStatus: { ok: boolean; message: string } | null;
  onOrganizationIdChange: (id: string) => void;
  onUseOrgBrandingChange: (use: boolean) => void;
  onDiscordWebhookUrlChange: (url: string) => void;
  onApplyOrgColorsToTiers: () => void;
  onTestDiscordWebhook: () => void;
}

export const OrgBrandPaletteSection: React.FC<OrgBrandPaletteSectionProps> = ({
  selectedOrg,
  organizations,
  organizationId,
  useOrgBranding,
  discordWebhookUrl,
  webhookTestStatus,
  onOrganizationIdChange,
  onUseOrgBrandingChange,
  onDiscordWebhookUrlChange,
  onApplyOrgColorsToTiers,
  onTestDiscordWebhook,
}) => {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface py-4.5 px-5.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Building2 size={18} color="var(--color-gold-bright)" />
          <h2 className="text-lg font-bold text-fg">
            Host Organization &amp; Branding
          </h2>
        </div>
        {selectedOrg && (
          <Link
            to={`/org/${selectedOrg.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-caption font-semibold text-gold-bright no-underline"
          >
            <span>View {selectedOrg.shortName} Dashboard</span>
            <ExternalLink size={12} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 max-md:grid-cols-1">
        {/* Left Column: Organization Selection & Palette */}
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Parent Organization</label>
            <select
              value={organizationId}
              onChange={e => onOrganizationIdChange(e.target.value)}
              className={inputClass}
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
            <span className="mt-1 block text-xs text-fg-muted">
              All match scores, career metrics, and qualifying leaderboards roll up to this organization.
            </span>
          </div>

          <div className="flex flex-col gap-2.5 rounded-md border border-line-subtle bg-elevated py-3.5 px-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <label className="m-0 flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={useOrgBranding}
                  onChange={e => onUseOrgBrandingChange(e.target.checked)}
                  className="size-4 cursor-pointer accent-gold-bright"
                />
                <span className="text-sm font-semibold text-fg">
                  Inherit Organizational Theme
                </span>
              </label>

              {useOrgBranding && (selectedOrg?.themeColors || selectedOrg?.branding?.themeColors) && (
                <Button
                  onClick={onApplyOrgColorsToTiers}
                  className="shrink-0 gap-1.5 py-1 px-2.5 text-xs"
                  title="Copy Colors"
                >
                  <Palette size={13} color="var(--color-gold-bright)" />
                  Apply
                </Button>
              )}
            </div>

            {useOrgBranding && (selectedOrg?.themeColors || selectedOrg?.branding?.themeColors) && (
              (() => {
                const colors = selectedOrg.themeColors || selectedOrg.branding?.themeColors;
                return (
                  <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                    <span className="text-xs text-fg-secondary">
                      Circuit 5-Color Theme:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Pri', color: colors?.primaryColor },
                        { label: 'Sec', color: colors?.secondaryColor },
                        { label: 'Card', color: colors?.cardColor },
                        { label: 'Text', color: colors?.textColor },
                        { label: 'Bg', color: colors?.backgroundColor },
                      ].map(swatch => (
                        <div key={swatch.label} className="flex items-center gap-1.5 rounded-xs border border-white/8 bg-black/30 py-1 px-2">
                          <span className="size-3 rounded-2xs border border-white/20" style={{ background: swatch.color }} />
                          <span className="font-mono text-2xs text-fg-muted">{swatch.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}

            {!useOrgBranding && (
              <p className="m-0 text-xs text-fg-muted">
                Custom regional mode: Each tier in this tournament will use its own custom colors and media independent of {selectedOrg?.shortName || 'the organization'}.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Discord Webhooks */}
        <div className="flex flex-col gap-4">
          {/* Discord Webhook Field */}
          <div className="flex flex-col gap-2 rounded-md border border-line-subtle bg-elevated p-4">
            <div className="flex items-center justify-between">
              <label className={cn(labelClass, 'm-0 flex items-center gap-1.5')}>
                <span>Discord Webhook URL</span>
              </label>
            </div>

            <div className="flex gap-2 max-md:flex-col max-md:items-stretch">
              <input
                type="text"
                inputMode="url"
                value={discordWebhookUrl}
                onChange={e => onDiscordWebhookUrlChange(e.target.value)}
                placeholder={selectedOrg?.discordWebhookUrl || selectedOrg?.hasDiscordWebhook ? `Fallback: ${selectedOrg.shortName} Webhook` : 'https://discord.com/api/webhooks/...'}
                className={cn(inputClass, 'flex-1')}
              />
              <Button
                onClick={onTestDiscordWebhook}
                className="gap-1.5 whitespace-nowrap py-1.5 px-3 text-caption"
                title="Test Webhook"
              >
                <Send size={13} />
                Test
              </Button>
            </div>

            <span className="text-xs text-fg-muted">
              {discordWebhookUrl.trim()
                ? 'Active tournament-specific webhook override.'
                : selectedOrg?.discordWebhookUrl || selectedOrg?.hasDiscordWebhook
                ? `Inherited from ${selectedOrg.name}'s webhook.`
                : 'No webhook configured.'}
            </span>

            {webhookTestStatus && (
              <div className={cn('text-xs font-semibold', webhookTestStatus.ok ? 'text-green-bright' : 'text-red-bright')}>
                {webhookTestStatus.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
