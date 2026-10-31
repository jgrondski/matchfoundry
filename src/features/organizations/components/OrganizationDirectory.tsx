import React, { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrganization } from '../store';
import { useTournament } from '../../tournament/store';
import { TierThemeColors } from '../../bracket/colorUtils';
import { TopNavSwitcher } from '../../../components/TopNavSwitcher';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  X,
  Palette,
  ArrowRight,
} from 'lucide-react';
import { QualFormat } from '../../tournament/types';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton, buttonClasses, cn } from '../../../components/ui';

const labelClass = 'mb-1.5 block text-caption font-semibold text-fg-secondary';
const fieldClass = 'rounded-md border border-line bg-canvas px-3.5 py-2.5 text-sm text-white';
const browseClass =
  'inline-flex cursor-pointer items-center whitespace-nowrap rounded-md border border-line bg-surface px-3 py-2 text-xs text-fg-secondary';
const swatchLabelClass = 'mb-1 block text-2xs text-fg-muted';
const swatchInputClass = 'h-8 w-full cursor-pointer rounded-xs';

export const OrganizationDirectory: React.FC = () => {
  const { organizations, createOrganization, isLoading, isHydrated } = useOrganization();
  const { tournaments } = useTournament();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for new Organization
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [orgBannerUrl, setOrgBannerUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#ffc905');
  const [primaryColor, setPrimaryColor] = useState('#ffc905');
  const [secondaryColor, setSecondaryColor] = useState('#705b33');
  const [cardColor, setCardColor] = useState('#1b1c1d');
  const [textColor, setTextColor] = useState('#94A3B8');
  const [backgroundColor, setBackgroundColor] = useState('#020203');
  const [defaultQualFormat, setDefaultQualFormat] = useState<QualFormat>('AVERAGE_OF_X');
  const [defaultAvgCount, setDefaultAvgCount] = useState(2);
  const [defaultBestOf, setDefaultBestOf] = useState(5);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const createTitleId = useId();
  const isCreateFormDirty =
    orgName !== '' ||
    orgSlug !== '' ||
    orgDescription !== '' ||
    orgWebsite !== '' ||
    orgLogoUrl !== '' ||
    orgBannerUrl !== '' ||
    brandColor !== '#ffc905' ||
    primaryColor !== '#ffc905' ||
    secondaryColor !== '#705b33' ||
    cardColor !== '#1b1c1d' ||
    textColor !== '#94A3B8' ||
    backgroundColor !== '#020203' ||
    defaultQualFormat !== 'AVERAGE_OF_X' ||
    defaultAvgCount !== 2 ||
    defaultBestOf !== 5 ||
    discordWebhookUrl !== '';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setter(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNameChange = (name: string) => {
    setOrgName(name);
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    setOrgSlug(slug);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !orgSlug.trim()) return;
    setIsSubmitting(true);

    try {
      const themeColors: TierThemeColors = {
        primaryColor,
        secondaryColor,
        cardColor,
        textColor,
        backgroundColor,
      };

      const created = await createOrganization({
        name: orgName.trim(),
        slug: orgSlug.trim(),
        description: orgDescription.trim() || undefined,
        website: orgWebsite.trim() || undefined,
        logoUrl: orgLogoUrl.trim() || undefined,
        bannerUrl: orgBannerUrl.trim() || undefined,
        brandColor,
        themeColors,
        discordWebhookUrl: discordWebhookUrl.trim() || undefined,
        defaultRules: {
          qualFormat: defaultQualFormat,
          qualAverageCount: defaultAvgCount,
          qualWindowMinutes: 120,
          bestOf: defaultBestOf,
          primaryColor,
          secondaryColor,
        },
      });

      setIsCreateModalOpen(false);
      navigate(`/org/${created.slug}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const q = searchTerm.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.slug.toLowerCase().includes(q) ||
      (org.description || '').toLowerCase().includes(q)
    );
  });

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading organizations..." />;
  }

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <TopNavSwitcher />

      <div className="mx-auto flex w-full max-w-295 flex-col gap-8 px-6 py-8">
        {/* Header Hero */}
        <header className="px-4 pb-0 pt-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <div className="flex size-9.5 items-center justify-center rounded-md bg-linear-135 from-gold-bright to-amber-600">
              <Building2 size={20} color="#090d16" />
            </div>
            <span className="text-2xl font-extrabold text-fg">
              ORGANIZATION <span className="text-gold-bright">DIRECTORY</span>
            </span>
          </div>
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-white">
            Organizations
          </h1>
          <p className="mx-auto mb-6 mt-0 max-w-162.5 text-base text-fg-secondary">
            Manage your organization's themes and tournaments.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-2.5 text-base shadow-[0_4px_14px_rgba(255,201,5,0.35)]"
            >
              <Plus size={18} />
              Create New Organization
            </Button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-135">
            <Search
              size={18}
              color="var(--color-text-muted, #64748b)"
              className="absolute left-4 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder="Search organizations by name, description, or slug..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-full border border-line bg-surface py-3 pl-11 pr-4 text-sm text-fg outline-none"
            />
          </div>
        </div>

        {/* Organizations Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
          {filteredOrgs.map(org => {
            const orgTournaments = tournaments.filter(t => t.organizationId === org.id);
            const colors = org.themeColors || {
              primaryColor: org.brandColor || '#ffc905',
              secondaryColor: '#705b33',
              cardColor: '#1b1c1d',
              textColor: '#94A3B8',
              backgroundColor: '#020203',
            };
            const orgPrimary = colors.primaryColor || '#ffc905';
            const orgSecondary = colors.secondaryColor || '#1e293b';
            const orgCard = colors.cardColor || '#161922';

            return (
              <div
                key={org.id}
                className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-[transform,border-color] duration-150"
              >
                {/* Banner / Header (Clickable to Org Dashboard) */}
                <Link to={`/org/${org.slug}`} className="relative block no-underline">
                  <div
                    className="relative h-22.5"
                    style={{
                      background: org.bannerUrl
                        ? `url(${org.bannerUrl}) center/cover no-repeat`
                        : `linear-gradient(135deg, ${orgSecondary}, ${orgPrimary}33)`,
                      borderBottom: `2px solid ${orgPrimary}`,
                    }}
                  >
                    {/* Logo Avatar */}
                    <div
                      className="absolute -bottom-5 left-5 flex size-13.5 items-center justify-center overflow-hidden rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                      style={{
                        background: orgCard,
                        border: `2px solid ${orgPrimary}`,
                      }}
                    >
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} className="size-full object-contain" />
                      ) : (
                        <Building2 size={26} color={orgPrimary} />
                      )}
                    </div>

                    {/* Slug Badge */}
                    <div
                      className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-xs font-bold backdrop-blur-xs"
                      style={{ color: orgPrimary }}
                    >
                      /{org.slug}
                    </div>
                  </div>
                </Link>

                {/* Card Body */}
                <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-7">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/org/${org.slug}`} className="text-inherit no-underline">
                        <h3 className="m-0 text-lg font-extrabold text-fg">
                          {org.name}
                        </h3>
                      </Link>
                      {org.website && (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Visit official website"
                          className="text-fg-muted transition-colors duration-150"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                    {org.description && (
                      <p className="mx-0 mb-0 mt-1.5 text-sm leading-normal text-fg-secondary">
                        {org.description}
                      </p>
                    )}
                  </div>

                  {/* Recent Tournaments Preview */}
                  <div>
                    <div className="mb-1.5 text-xs font-bold uppercase text-fg-muted">
                      Recent Tournaments ({orgTournaments.length})
                    </div>
                    {orgTournaments.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {orgTournaments.slice(0, 3).map(t => (
                          <Link
                            key={t.id}
                            to={`/${t.slug}/leaderboard`}
                            className="flex items-center justify-between rounded-sm border border-white/4 bg-canvas px-2.5 py-1.5 text-caption text-fg-secondary no-underline"
                          >
                            <span className="truncate">
                              {t.name}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-bold',
                                t.isLocked ? 'bg-green-500/15 text-green-400' : 'bg-gold/15 text-gold-bright'
                              )}
                            >
                              {t.isLocked ? 'Match Play' : 'Quals'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="py-1.5 text-caption italic text-fg-muted">
                        No tournaments hosted yet.
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-auto flex items-center pt-3">
                    <Link
                      to={`/org/${org.slug}`}
                      className={buttonClasses({
                        variant: 'secondary',
                        className: 'w-full justify-center gap-1.5 p-2 text-sm hover:border-fg-secondary hover:bg-highlight',
                      })}
                    >
                      <span>Manage Organization</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Organization Modal */}
        <Overlay
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          dirty={isCreateFormDirty}
          busy={isSubmitting}
          aria-labelledby={createTitleId}
          panelClassName="max-h-[90vh] max-w-140 overflow-y-auto rounded-lg border border-line bg-elevated p-7 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
        >
          {({ requestClose }) => (
            <>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={20} color="var(--color-gold-bright, #ffc905)" />
                  <h2 id={createTitleId} className="m-0 text-xl font-extrabold text-fg">
                    Create New Organization
                  </h2>
                </div>
                <IconButton aria-label="Close" onClick={requestClose}>
                  <X size={18} />
                </IconButton>
              </div>

              <form onSubmit={handleCreateOrg} className="flex flex-col gap-4">
                <div>
                  <label className={labelClass}>
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Classic Tetris World Championship"
                    value={orgName}
                    onChange={e => handleNameChange(e.target.value)}
                    className={cn(fieldClass, 'w-full')}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ctwc"
                    value={orgSlug}
                    onChange={e => setOrgSlug(e.target.value)}
                    className={cn(fieldClass, 'w-full font-mono')}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Description
                  </label>
                  <textarea
                    placeholder="Brief overview of the league or organization..."
                    value={orgDescription}
                    onChange={e => setOrgDescription(e.target.value)}
                    rows={2}
                    className={cn(fieldClass, 'w-full')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      Official Website
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={orgWebsite}
                      onChange={e => setOrgWebsite(e.target.value)}
                      className={cn(fieldClass, 'w-full')}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Logo URL or Local File
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="https://... or /assets/..."
                        value={orgLogoUrl}
                        onChange={e => setOrgLogoUrl(e.target.value)}
                        className={cn(fieldClass, 'flex-1')}
                      />
                      <label className={browseClass} title="Choose local image file">
                        Browse
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleFileUpload(e, setOrgLogoUrl)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      Banner URL or Local File
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="https://... or /assets/..."
                        value={orgBannerUrl}
                        onChange={e => setOrgBannerUrl(e.target.value)}
                        className={cn(fieldClass, 'flex-1')}
                      />
                      <label className={browseClass} title="Choose local image file">
                        Browse
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleFileUpload(e, setOrgBannerUrl)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>
                      Discord Webhook URL (Groundwork)
                    </label>
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={discordWebhookUrl}
                      onChange={e => setDiscordWebhookUrl(e.target.value)}
                      className={cn(fieldClass, 'w-full')}
                    />
                  </div>
                </div>

                {/* Default Rules */}
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
                  <div>
                    <label className={labelClass}>
                      Default Qual Format
                    </label>
                    <select
                      value={defaultQualFormat}
                      onChange={e => setDefaultQualFormat(e.target.value as QualFormat)}
                      className={cn(fieldClass, 'w-full')}
                    >
                      <option value="AVERAGE_OF_X">Average of X Attempts</option>
                      <option value="HIGH_SCORE"># of Maxes</option>
                      <option value="POINTS">Points Threshold</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      Avg Count (X)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={defaultAvgCount}
                      onChange={e => setDefaultAvgCount(parseInt(e.target.value, 10) || 2)}
                      className={cn(fieldClass, 'w-full')}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Default Best Of
                    </label>
                    <select
                      value={defaultBestOf}
                      onChange={e => setDefaultBestOf(parseInt(e.target.value, 10) || 5)}
                      className={cn(fieldClass, 'w-full')}
                    >
                      <option value={3}>Best of 3</option>
                      <option value={5}>Best of 5</option>
                      <option value={7}>Best of 7</option>
                    </select>
                  </div>
                </div>

                {/* 5 Bracket Colors Section */}
                <div className="rounded-md border border-line-subtle bg-black/20 p-3.5">
                  <div className="mb-2.5 flex items-center gap-1.5">
                    <Palette size={16} color="var(--color-gold-bright, #ffc905)" />
                    <span className="text-caption font-bold text-fg">
                      Default 5-Color Bracket Theme Palette
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <span className={swatchLabelClass}>Primary</span>
                      <input type="color" value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); setBrandColor(e.target.value); }} className={swatchInputClass} />
                    </div>
                    <div>
                      <span className={swatchLabelClass}>Secondary</span>
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className={swatchInputClass} />
                    </div>
                    <div>
                      <span className={swatchLabelClass}>Card Bg</span>
                      <input type="color" value={cardColor} onChange={e => setCardColor(e.target.value)} className={swatchInputClass} />
                    </div>
                    <div>
                      <span className={swatchLabelClass}>Text</span>
                      <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className={swatchInputClass} />
                    </div>
                    <div>
                      <span className={swatchLabelClass}>Canvas Bg</span>
                      <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className={swatchInputClass} />
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex justify-end gap-3">
                  <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting && (
                      <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    )}
                    <span>{isSubmitting ? 'Saving...' : 'Save Organization'}</span>
                  </Button>
                </div>
              </form>
            </>
          )}
        </Overlay>



      </div>
    </div>
  );
};
