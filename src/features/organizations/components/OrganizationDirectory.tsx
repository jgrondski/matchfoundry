import React, { useState } from 'react';
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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-base)', padding: '0 0 4rem' }}>
      <TopNavSwitcher />

      <div style={{ maxWidth: '1180px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxSizing: 'border-box' }}>
        {/* Header Hero */}
        <header style={{ textAlign: 'center', padding: '1.5rem 1rem 0' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md, 8px)',
                background: 'linear-gradient(135deg, var(--color-gold-bright, #ffc905), #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={20} color="#090d16" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--color-text-primary, #ffffff)' }}>
              ORGANIZATION <span style={{ color: 'var(--color-gold-bright, #ffc905)' }}>DIRECTORY</span>
            </span>
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
            Organizations
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary, #94a3b8)', maxWidth: '650px', margin: '0 auto 1.5rem' }}>
            Manage your organization's themes and tournaments.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.5rem', fontSize: '0.95rem', boxShadow: '0 4px 14px rgba(255, 201, 5, 0.35)' }}
            >
              <Plus size={18} />
              Create New Organization
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '540px',
            }}
          >
            <Search
              size={18}
              color="var(--color-text-muted, #64748b)"
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search organizations by name, description, or slug..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.75rem',
                background: 'var(--color-bg-surface, #161922)',
                border: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
                borderRadius: 'var(--radius-full, 9999px)',
                color: 'var(--color-text-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Organizations Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredOrgs.map(org => {
            const orgTournaments = tournaments.filter(t => t.organizationId === org.id);
            const colors = org.themeColors || {
              primaryColor: org.brandColor || '#ffc905',
              secondaryColor: '#705b33',
              cardColor: '#1b1c1d',
              textColor: '#94A3B8',
              backgroundColor: '#020203',
            };

            return (
              <div
                key={org.id}
                style={{
                  background: 'var(--color-bg-surface, #161922)',
                  border: '1px solid var(--color-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: 'var(--radius-lg, 12px)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                }}
              >
                {/* Banner / Header (Clickable to Org Dashboard) */}
                <Link
                  to={`/org/${org.slug}`}
                  style={{ textDecoration: 'none', display: 'block', position: 'relative' }}
                >
                  <div
                    style={{
                      height: '90px',
                      position: 'relative',
                      background: org.bannerUrl
                        ? `url(${org.bannerUrl}) center/cover no-repeat`
                        : `linear-gradient(135deg, ${colors.secondaryColor || '#1e293b'}, ${colors.primaryColor || '#ffc905'}33)`,
                      borderBottom: `2px solid ${colors.primaryColor || '#ffc905'}`,
                    }}
                  >
                    {/* Logo Avatar */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '-20px',
                        left: '1.25rem',
                        width: '54px',
                        height: '54px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: colors.cardColor || '#161922',
                        border: `2px solid ${colors.primaryColor || '#ffc905'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                        overflow: 'hidden',
                      }}
                    >
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Building2 size={26} color={colors.primaryColor || '#ffc905'} />
                      )}
                    </div>

                    {/* Slug Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 'var(--radius-full, 9999px)',
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: colors.primaryColor || '#ffc905',
                        fontWeight: 700,
                      }}
                    >
                      /{org.slug}
                    </div>
                  </div>
                </Link>

                {/* Card Body */}
                <div style={{ padding: '1.75rem 1.25rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <Link
                        to={`/org/${org.slug}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary, #ffffff)', margin: 0 }}>
                          {org.name}
                        </h3>
                      </Link>
                      {org.website && (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Visit official website"
                          style={{ color: 'var(--color-text-muted, #64748b)', transition: 'color 0.15s ease' }}
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                    {org.description && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #94a3b8)', margin: '0.4rem 0 0', lineHeight: 1.45 }}>
                        {org.description}
                      </p>
                    )}
                  </div>

                  {/* Recent Tournaments Preview */}
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Recent Tournaments ({orgTournaments.length})
                    </div>
                    {orgTournaments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {orgTournaments.slice(0, 3).map(t => (
                          <Link
                            key={t.id}
                            to={`/${t.slug}/leaderboard`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.4rem 0.65rem',
                              background: 'var(--color-bg-base, #0c0d12)',
                              borderRadius: 'var(--radius-sm, 6px)',
                              fontSize: '0.8rem',
                              color: 'var(--color-text-secondary, #94a3b8)',
                              textDecoration: 'none',
                              border: '1px solid rgba(255,255,255,0.04)',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.4rem',
                                borderRadius: 'var(--radius-full, 9999px)',
                                background: t.isLocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: t.isLocked ? '#4ade80' : 'var(--color-gold-bright, #ffc905)',
                                flexShrink: 0,
                              }}
                            >
                              {t.isLocked ? 'Match Play' : 'Quals'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                        No tournaments hosted yet.
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', display: 'flex', alignItems: 'center' }}>
                    <Link
                      to={`/org/${org.slug}`}
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '0.55rem', fontSize: '0.85rem', justifyContent: 'center', gap: '0.4rem' }}
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
        {isCreateModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'var(--color-bg-surface-elevated, #161922)',
                border: '1px solid var(--color-border, rgba(255, 255, 255, 0.12))',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '1.75rem',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={20} color="var(--color-gold-bright, #ffc905)" />
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary, #ffffff)', margin: 0 }}>
                    Create New Organization
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted, #64748b)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Classic Tetris World Championship"
                    value={orgName}
                    onChange={e => handleNameChange(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ctwc"
                    value={orgSlug}
                    onChange={e => setOrgSlug(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.9rem', fontFamily: 'var(--font-mono, monospace)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                    Description
                  </label>
                  <textarea
                    placeholder="Brief overview of the league or organization..."
                    value={orgDescription}
                    onChange={e => setOrgDescription(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                      Official Website
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={orgWebsite}
                      onChange={e => setOrgWebsite(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                      Logo URL or Local File
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        placeholder="https://... or /assets/..."
                        value={orgLogoUrl}
                        onChange={e => setOrgLogoUrl(e.target.value)}
                        style={{ flex: 1, padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                      />
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--color-bg-surface, #161922)',
                          border: '1px solid var(--color-border, rgba(255,255,255,0.15))',
                          borderRadius: 'var(--radius-md, 8px)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary, #94a3b8)',
                          whiteSpace: 'nowrap',
                        }}
                        title="Choose local image file"
                      >
                        Browse
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleFileUpload(e, setOrgLogoUrl)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                      Banner URL or Local File
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        placeholder="https://... or /assets/..."
                        value={orgBannerUrl}
                        onChange={e => setOrgBannerUrl(e.target.value)}
                        style={{ flex: 1, padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                      />
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--color-bg-surface, #161922)',
                          border: '1px solid var(--color-border, rgba(255,255,255,0.15))',
                          borderRadius: 'var(--radius-md, 8px)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary, #94a3b8)',
                          whiteSpace: 'nowrap',
                        }}
                        title="Choose local image file"
                      >
                        Browse
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleFileUpload(e, setOrgBannerUrl)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                      Discord Webhook URL (Groundwork)
                    </label>
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={discordWebhookUrl}
                      onChange={e => setDiscordWebhookUrl(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Default Rules */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                      Default Qual Format
                    </label>
                    <select
                      value={defaultQualFormat}
                      onChange={e => setDefaultQualFormat(e.target.value as QualFormat)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                    >
                      <option value="AVERAGE_OF_X">Average of X Attempts</option>
                      <option value="HIGH_SCORE"># of Maxes</option>
                      <option value="POINTS">Points Threshold</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                      Avg Count (X)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={defaultAvgCount}
                      onChange={e => setDefaultAvgCount(parseInt(e.target.value, 10) || 2)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                      Default Best Of
                    </label>
                    <select
                      value={defaultBestOf}
                      onChange={e => setDefaultBestOf(parseInt(e.target.value, 10) || 5)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base, #0c0d12)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 8px)', color: '#ffffff', fontSize: '0.85rem' }}
                    >
                      <option value={3}>Best of 3</option>
                      <option value={5}>Best of 5</option>
                      <option value={7}>Best of 7</option>
                    </select>
                  </div>
                </div>

                {/* 5 Bracket Colors Section */}
                <div style={{ border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))', borderRadius: 'var(--radius-md, 8px)', padding: '0.85rem', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                    <Palette size={16} color="var(--color-gold-bright, #ffc905)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary, #ffffff)' }}>
                      Default 5-Color Bracket Theme Palette
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '0.2rem' }}>Primary</span>
                      <input type="color" value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); setBrandColor(e.target.value); }} style={{ width: '100%', height: '32px', borderRadius: '4px', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '0.2rem' }}>Secondary</span>
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '4px', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '0.2rem' }}>Card Bg</span>
                      <input type="color" value={cardColor} onChange={e => setCardColor(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '4px', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '0.2rem' }}>Text</span>
                      <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '4px', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-text-muted, #64748b)', marginBottom: '0.2rem' }}>Canvas Bg</span>
                      <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '4px', cursor: 'pointer' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    {isSubmitting && (
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#ffffff',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    )}
                    <span>{isSubmitting ? 'Saving...' : 'Save Organization'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}



      </div>
    </div>
  );
};
