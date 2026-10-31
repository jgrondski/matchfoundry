import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { TournamentLayout } from '../components/TournamentLayout';
import { getDefaultTierColors, colorWithAlpha } from '../features/bracket/colorUtils';
import {
  Video,
  Copy,
  Check,
  ExternalLink,
  Monitor,
  Split,
  Maximize2,
  Trophy,
  BarChart3,
  Sparkles,
  GitBranch,
  Shield,
  Zap,
  LayoutGrid,
} from 'lucide-react';
import { Button, cn } from '../components/ui';
import { CHROMA_KEY_COLORS, THEME_FALLBACK } from '../theme/palette';

export const OBSHubPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getTournamentBySlug } = useTournament();

  const [selectedChroma, setSelectedChroma] = useState<'none' | 'green' | 'magenta' | 'blue'>('none');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  if (!tournament) {
    return (
      <div className="p-12 text-center text-fg-secondary">
        <h2 className="text-2xl font-bold">Tournament Not Found</h2>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          Back to Tournaments
        </Button>
      </div>
    );
  }

  const chromaParam = selectedChroma !== 'none' ? `&chroma=${selectedChroma}` : '';

  const copyUrl = (path: string, key: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const openPopout = (path: string) => {
    window.open(path, '_blank', 'width=1280,height=720,menubar=no,toolbar=no,location=no');
  };

  return (
    <TournamentLayout tournament={tournament} activeView="obs">
      <main className="mx-auto flex w-full max-w-300 flex-1 flex-col gap-9 px-6 py-8">
        {/* Hub Header */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-caption font-extrabold tracking-widest text-gold-bright uppercase">
                Broadcast &amp; OBS Studio Hub
              </span>
            </div>
            <h1 className="m-0 flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-white">
              <Video color="var(--color-gold-bright)" size={28} />
              {tournament.name}
            </h1>
            <p className="mx-0 mt-1.5 mb-0 max-w-170 text-sm text-fg-muted">
              Clean, transparent browser sources tailored for OBS Studio, vMix, and Twitch streams. Click to copy or test in a popout window.
            </p>
          </div>

          {/* Chroma Preset Selector */}
          <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface px-4 py-2.5">
            <div className="text-xs font-bold tracking-wide text-fg-muted uppercase">
              Chroma Background
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'none' as const, label: 'Transparent', color: 'transparent' },
                { id: 'green' as const, label: 'Green', color: CHROMA_KEY_COLORS.green },
                { id: 'magenta' as const, label: 'Magenta', color: CHROMA_KEY_COLORS.magenta },
                { id: 'blue' as const, label: 'Blue', color: CHROMA_KEY_COLORS.blue },
              ].map(opt => {
                const isSelected = selectedChroma === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedChroma(opt.id)}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs',
                      isSelected
                        ? 'border-gold bg-gold-soft font-bold text-gold-bright'
                        : 'border-line bg-canvas font-medium text-fg-secondary'
                    )}
                  >
                    {opt.color !== 'transparent' && (
                      <span className="size-2 rounded-full border border-white/40" style={{ background: opt.color }} />
                    )}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 1: Tournament-Wide Overlays (Original Neutral Palette) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <Sparkles size={16} color="var(--color-gold-bright)" />
            <h2 className="m-0 text-base font-bold text-fg">
              Tournament-Wide Broadcast Overlays
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4.5 min-[681px]:grid-cols-2 min-[1041px]:grid-cols-3">
            {/* Leaderboard Overlay */}
            {(() => {
              const url = `/${tournament.slug}/leaderboard?obs=true${chromaParam}`;
              const key = 'leaderboard-overlay';
              const isCopied = copiedKey === key;
              return (
                <div className={neutralCardClass}>
                  {/* Title Row */}
                  <div className="flex items-center gap-2.5">
                    <Trophy size={18} color="var(--color-gold-bright)" className="shrink-0" />
                    <h3 className="m-0 text-base leading-snug font-bold text-white">
                      Qualifying Leaderboard
                    </h3>
                  </div>

                  {/* Bottom Row: Chip on Left, Actions on Right */}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                    <span className="rounded-sm border border-gold/35 bg-gold/15 px-2 py-1 text-2xs font-bold whitespace-nowrap text-gold-bright">
                      Live Table
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={() => copyUrl(url, key)}
                        className="gap-1.5 px-3 py-1.5 text-xs"
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? 'Copied URL!' : 'Copy URL'}</span>
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => openPopout(url)}
                        className="px-2.5 py-1.5 text-xs"
                        title="Open popout window"
                      >
                        <ExternalLink size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Standings Overlay */}
            {(() => {
              const url = `/${tournament.slug}/standings?obs=true${chromaParam}`;
              const key = 'standings-overlay';
              const isCopied = copiedKey === key;
              return (
                <div className={neutralCardClass}>
                  {/* Title Row */}
                  <div className="flex items-center gap-2.5">
                    <BarChart3 size={18} className="text-sky-400 shrink-0" />
                    <h3 className="m-0 text-base leading-snug font-bold text-white">
                      Tournament Standings
                    </h3>
                  </div>

                  {/* Bottom Row: Chip on Left, Actions on Right */}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                    <span className="rounded-sm border border-sky-400/35 bg-sky-400/15 px-2 py-1 text-2xs font-bold whitespace-nowrap text-sky-400">
                      Final Results
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={() => copyUrl(url, key)}
                        className="gap-1.5 px-3 py-1.5 text-xs"
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? 'Copied URL!' : 'Copy URL'}</span>
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => openPopout(url)}
                        className="px-2.5 py-1.5 text-xs"
                        title="Open popout window"
                      >
                        <ExternalLink size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Section 2: Bracket Tier Overlays (Themed by Tier Palette) */}
        <div className="flex flex-col gap-7">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <Video size={16} color="var(--color-gold-bright)" />
            <h2 className="m-0 text-base font-bold text-fg">
              Bracket Overlays by Tier
            </h2>
          </div>

          {tournament.tiers.map(tier => {
            const tierPalette = getDefaultTierColors(tier);
            const primaryColor = tier.primaryColor || tierPalette.primaryColor || THEME_FALLBACK.primaryColor;
            const cardBg = tier.cardColor || tierPalette.cardColor || THEME_FALLBACK.obsCardColor;
            const isAcceleratedHybrid = tier.bracket?.bracketRouting === 'ACCELERATED_HYBRID';
            const finalsCutoff = tier.bracket?.finalsCutoff || 16;

            const cards = isAcceleratedHybrid
              ? [
                  {
                    keySuffix: 'champ-fit',
                    title: `Top ${finalsCutoff} Championship Finals`,
                    badge: '1080p Fit',
                    icon: Trophy,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?stage=championship&view=fit${chromaParam}`,
                  },
                  {
                    keySuffix: 'qual-fit',
                    title: 'Early Rounds Grid (3 Pods)',
                    badge: '1080p Fit',
                    icon: LayoutGrid,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?stage=qualifiers&view=fit${chromaParam}`,
                  },
                  {
                    keySuffix: 'accel-fit',
                    title: 'Pod 1: Accelerated Round',
                    badge: `Seeds 1–${finalsCutoff}`,
                    icon: Zap,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?stage=accel&view=fit${chromaParam}`,
                  },
                  {
                    keySuffix: 'upper-fit',
                    title: 'Pod 2: Upper Qualifying Bracket',
                    badge: '4 Columns',
                    icon: GitBranch,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?stage=upper&view=fit${chromaParam}`,
                  },
                  {
                    keySuffix: 'lower-fit',
                    title: 'Pod 3: Lower Play-In Bracket',
                    badge: 'Consolidated',
                    icon: Shield,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?stage=lower&view=fit${chromaParam}`,
                  },
                  {
                    keySuffix: 'combined-fit',
                    title: 'Full Tournament Stacked',
                    badge: '1080p Fit',
                    icon: Monitor,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?stage=combined&view=fit${chromaParam}`,
                  },
                  {
                    keySuffix: 'combined-standard',
                    title: 'Full Tournament Standard',
                    badge: 'Full Res',
                    icon: Maximize2,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?stage=combined&view=standard${chromaParam}`,
                  },
                ]
              : [
                  {
                    keySuffix: 'fit',
                    title: '1080p Auto-Fit Bracket',
                    badge: 'Recommended',
                    icon: Monitor,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?view=fit${chromaParam}`,
                  },
                  {
                    keySuffix: 'split',
                    title: 'Split Wings (Center Finals)',
                    badge: 'Bilateral',
                    icon: Split,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?view=split${chromaParam}`,
                  },
                  {
                    keySuffix: 'standard',
                    title: 'Standard Full Resolution',
                    badge: 'Full Tree',
                    icon: Maximize2,
                    url: `/${tournament.slug}/obs/bracket/${tier.slug}?view=standard${chromaParam}`,
                  },
                ];

            return (
              <div
                key={tier.id}
                className="flex flex-col gap-3.5 rounded-lg bg-white/2 px-5 py-4.5"
                style={{ border: `1px solid ${colorWithAlpha(primaryColor, 0.22)}` }}
              >
                {/* Tier Title Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{
                        background: primaryColor,
                        boxShadow: `0 0 10px ${colorWithAlpha(primaryColor, 0.65)}`,
                      }}
                    />
                    <h3 className="m-0 text-base font-extrabold text-white">
                      <span style={{ color: primaryColor }}>{tier.name}</span>
                      <span className="ml-2 text-caption font-medium text-fg-muted">
                        ({tier.playerCount} Players • Best of {tier.bestOf})
                      </span>
                    </h3>
                  </div>

                  <span
                    className="rounded-full px-2.5 py-1 text-2xs font-bold"
                    style={{
                      background: colorWithAlpha(primaryColor, 0.12),
                      color: primaryColor,
                      border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                    }}
                  >
                    {isAcceleratedHybrid ? `Accelerated Hybrid (${cards.length} Views)` : `${tier.eliminationType === 'DOUBLE' ? 'Double Elimination' : 'Single Elimination'}`}
                  </span>
                </div>

                {/* Cards Grid: strictly maximum 3 cards per row */}
                <div className="grid grid-cols-1 gap-4.5 min-[681px]:grid-cols-2 min-[1041px]:grid-cols-3">
                  {cards.map(c => {
                    const key = `${tier.id}-${c.keySuffix}`;
                    const isCopied = copiedKey === key;
                    const Icon = c.icon;
                    return (
                      <div
                        key={c.keySuffix}
                        className="flex min-h-28.75 flex-col gap-3 rounded-md px-5 py-4.5 shadow-[0_3px_10px_rgba(0,0,0,0.35)] transition-[border-color,transform] duration-150"
                        style={{
                          background: `linear-gradient(135deg, ${colorWithAlpha(cardBg, 0.95)} 0%, ${colorWithAlpha(primaryColor, 0.08)} 100%)`,
                          border: `1px solid ${colorWithAlpha(primaryColor, 0.3)}`,
                          borderLeft: `4px solid ${primaryColor}`,
                        }}
                      >
                        {/* Title Row with Icon */}
                        <div className="flex items-start gap-2.5">
                          <Icon size={17} color={primaryColor} className="mt-0.5 shrink-0" />
                          <h4 className="m-0 text-base leading-snug font-bold whitespace-normal text-white">
                            {c.title}
                          </h4>
                        </div>

                        {/* Bottom Row: Chip on Left, Action Buttons on Right */}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span
                            className="rounded-sm px-2 py-1 text-3xs font-bold whitespace-nowrap"
                            style={{
                              background: colorWithAlpha(primaryColor, 0.14),
                              color: primaryColor,
                              border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                            }}
                          >
                            {c.badge}
                          </span>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              onClick={() => copyUrl(c.url, key)}
                              className="gap-1.5 px-3 py-1.5 text-xs"
                            >
                              {isCopied ? <Check size={13} /> : <Copy size={13} />}
                              <span>{isCopied ? 'Copied URL!' : 'Copy URL'}</span>
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => openPopout(c.url)}
                              className="px-2.5 py-1.5 text-xs"
                              title="Open popout window"
                            >
                              <ExternalLink size={13} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </TournamentLayout>
  );
};

const neutralCardClass = 'flex min-h-28.75 flex-col gap-3 rounded-md border border-line bg-surface px-5 py-4.5 shadow-sm';
