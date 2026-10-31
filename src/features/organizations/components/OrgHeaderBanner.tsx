import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Trophy, Users, Gamepad2, Palette, Settings, ExternalLink, ArrowLeft, Edit2, Layers } from 'lucide-react';
import { Button, cn } from '../../../components/ui';
import { Organization } from '../../tournament/types';
import { TierThemeColors } from '../../bracket/colorUtils';
import { OrganizationMetrics } from '../types';

interface OrgHeaderBannerProps {
  org: Organization;
  primaryTheme: TierThemeColors;
  metrics: OrganizationMetrics;
  orgTournamentsCount: number;
  activeTab: 'tournaments' | 'branding' | 'settings';
  onSelectTab: (tab: 'tournaments' | 'branding' | 'settings') => void;
  onOpenEditMetadata: () => void;
}

export const OrgHeaderBanner: React.FC<OrgHeaderBannerProps> = ({
  org,
  primaryTheme,
  metrics,
  orgTournamentsCount,
  activeTab,
  onSelectTab,
  onOpenEditMetadata,
}) => {
  const primaryColor = primaryTheme.primaryColor || '#ffc905';
  const secondaryColor = primaryTheme.secondaryColor || '#1e293b';
  const cardColor = primaryTheme.cardColor || '#161922';

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_6px_24px_rgba(0,0,0,0.3)]">
      {/* Unimpeded Top Banner */}
      <div
        className="relative h-37.5 border-b-2"
        style={{
          background: org.bannerUrl || org.branding?.bannerUrl
            ? `url(${org.bannerUrl || org.branding?.bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${secondaryColor}, ${primaryColor}33)`,
          borderBottomColor: primaryColor,
        }}
      >
        <div className="absolute top-4 left-4">
          <Link
            to="/organizations"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-semibold text-white no-underline backdrop-blur-xs"
          >
            <ArrowLeft size={13} />
            <span>All Organizations</span>
          </Link>
        </div>
      </div>

      {/* Org Details Cleanly Below Banner */}
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Avatar + Title + Slug */}
          <div className="flex items-center gap-5">
            <div
              className="flex size-17 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
              style={{
                background: cardColor,
                borderColor: primaryColor,
              }}
            >
              {org.logoUrl || org.branding?.logoUrl ? (
                <img src={org.logoUrl || org.branding?.logoUrl} alt={org.name} className="size-full object-contain" />
              ) : (
                <Building2 size={34} color={primaryColor} />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="m-0 text-3xl font-extrabold tracking-tight text-white">
                  {org.name}
                </h1>
                <span
                  className="rounded-full bg-white/8 px-2.5 py-1 font-mono text-xs font-bold"
                  style={{ color: primaryColor }}
                >
                  /{org.slug}
                </span>
              </div>
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-caption text-fg-secondary no-underline"
                >
                  <span>{org.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenEditMetadata}
            >
              <Edit2 size={14} />
              <span>Edit Details</span>
            </Button>
          </div>
        </div>

        {org.description && (
          <p className="m-0 text-base leading-normal text-fg-secondary">
            {org.description}
          </p>
        )}

        {/* 4 Stat Overview Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 pt-2">
          {[
            { label: 'Tournaments Hosted', value: metrics.totalTournaments, icon: Trophy },
            { label: 'Total Competitors', value: metrics.totalCompetitors, icon: Users },
            { label: 'Matches Played', value: metrics.totalMatches, icon: Gamepad2 },
            { label: 'Qualifier Attempts', value: metrics.totalSubmissions, icon: Layers },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-md border border-white/5 bg-black/30 px-4 py-3"
              >
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-white/6"
                  style={{ color: primaryColor }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-white">
                    {stat.value}
                  </div>
                  <div className="text-xs font-semibold uppercase text-fg-muted">
                    {stat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-t border-line bg-elevated">
        {[
          { id: 'tournaments', label: `Tournaments (${orgTournamentsCount})`, icon: Trophy },
          { id: 'branding', label: 'Branding & Palettes', icon: Palette },
          { id: 'settings', label: 'Default Rules & Webhooks', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id as 'tournaments' | 'branding' | 'settings')}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center gap-2 border-0 border-b-[3px] px-4 py-3.5 text-sm transition-all duration-150',
                isActive ? 'bg-surface font-bold text-white' : 'border-b-transparent bg-transparent font-medium text-fg-secondary'
              )}
              style={isActive ? { borderBottomColor: primaryColor } : undefined}
            >
              <Icon size={16} color={isActive ? primaryColor : 'currentColor'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
