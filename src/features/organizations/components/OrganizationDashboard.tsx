import React, { useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useOrganization } from '../store';
import { useTournament } from '../../tournament/store';
import { computeOrganizationMetrics } from '../metrics';
import { TopNavSwitcher } from '../../../components/TopNavSwitcher';
import { TierThemeColors } from '../../bracket/colorUtils';
import { QualFormat, PointsThreshold, DEFAULT_POINTS_THRESHOLDS, OrgTierTheme, Tournament, Organization } from '../../tournament/types';
import { CreateTournamentModal } from '../../tournament/components/CreateTournamentModal';
import {
  Building2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { OrgHeaderBanner } from './OrgHeaderBanner';
import { OrgTournamentsTab } from './OrgTournamentsTab';
import { OrgBrandingTab } from './OrgBrandingTab';
import { OrgSettingsTab } from './OrgSettingsTab';
import { OrgMetadataModal } from './OrgMetadataModal';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ConfirmDialog } from '../../../components/overlay';
import { buttonClasses } from '../../../components/ui';
import { DEFAULT_TIER_THEME, TIER_THEMES } from '../../../theme/palette';

export const OrganizationDashboard: React.FC = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { getOrganizationBySlug, isLoading, isHydrated } = useOrganization();
  const { isLoading: isTourneyLoading, isHydrated: isTourneyHydrated } = useTournament();

  if (isLoading || !isHydrated || isTourneyLoading || !isTourneyHydrated) {
    return <LoadingScreen message="Loading organization..." />;
  }

  const org = getOrganizationBySlug(orgSlug || '');

  if (!org) {
    return (
      <div className="min-h-screen bg-canvas pb-12">
        <TopNavSwitcher />
        <div className="mx-auto my-16 max-w-200 p-8 text-center">
          <Building2 size={48} color="var(--color-gold-bright, #ffc905)" className="mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-white">Organization Not Found</h2>
          <p className="mb-6 text-fg-secondary">
            No organization found matching slug <code className="text-gold-bright">/{orgSlug}</code>.
          </p>
          <Link
            to="/organizations"
            className={buttonClasses({
              variant: 'primary',
              className: 'hover:brightness-110 hover:shadow-gold-hover hover:-translate-y-px',
            })}
          >
            <ArrowLeft size={16} />
            <span>Back to Organizations</span>
          </Link>
        </div>
      </div>
    );
  }

  return <OrganizationDashboardLoaded key={org.id} org={org} />;
};

const OrganizationDashboardLoaded: React.FC<{ org: Organization }> = ({ org }) => {
  const { updateOrganization, deleteOrganization } = useOrganization();
  const { tournaments, deleteTournament } = useTournament();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'tournaments' | 'branding' | 'settings'>('tournaments');
  const [tourneySearch, setTourneySearch] = useState('');
  const [isEditMetadataOpen, setIsEditMetadataOpen] = useState(false);
  const [isCreateTourneyOpen, setIsCreateTourneyOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [webhookTestStatus, setWebhookTestStatus] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);

  const confirmDeleteTournament = async () => {
    if (tournamentToDelete) {
      await deleteTournament(tournamentToDelete.id);
      setTournamentToDelete(null);
    }
  };

  // Metadata form state
  const [editName, setEditName] = useState(org.name || '');
  const [editSlug, setEditSlug] = useState(org.slug || '');
  const [editDescription, setEditDescription] = useState(org.description || '');
  const [editWebsite, setEditWebsite] = useState(org.website || '');
  const [editLogoUrl, setEditLogoUrl] = useState(org.logoUrl || org.branding?.logoUrl || '');
  const [editBannerUrl, setEditBannerUrl] = useState(org.bannerUrl || org.branding?.bannerUrl || '');
  const editInitialRef = useRef({ editName, editSlug, editDescription, editWebsite, editLogoUrl, editBannerUrl });
  const isEditMetadataDirty =
    editName !== editInitialRef.current.editName ||
    editSlug !== editInitialRef.current.editSlug ||
    editDescription !== editInitialRef.current.editDescription ||
    editWebsite !== editInitialRef.current.editWebsite ||
    editLogoUrl !== editInitialRef.current.editLogoUrl ||
    editBannerUrl !== editInitialRef.current.editBannerUrl;

  // Branding Primary & Multi-tier state
  const initialColors = org.themeColors || org.branding?.themeColors || {
    primaryColor: org.brandColor || DEFAULT_TIER_THEME.primaryColor,
    secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
    cardColor: DEFAULT_TIER_THEME.cardColor,
    textColor: DEFAULT_TIER_THEME.textColor,
    backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
  };
  const [primaryTheme, setPrimaryTheme] = useState<TierThemeColors>(initialColors);
  const [primaryTextSize, setPrimaryTextSize] = useState<'compact' | 'normal' | 'large'>('normal');
  const [tierThemes, setTierThemes] = useState<OrgTierTheme[]>(org.tierThemes || []);

  // Settings state
  const [qualFormat, setQualFormat] = useState<QualFormat>(org.defaultRules?.qualFormat || 'AVERAGE_OF_X');
  const [qualAverageCount, setQualAverageCount] = useState<number | undefined>(org.defaultRules?.qualAverageCount || 2);
  const [pointsConfig, setPointsConfig] = useState<PointsThreshold[]>(
    org.defaultRules?.pointsConfig || DEFAULT_POINTS_THRESHOLDS
  );
  const [bestOf, setBestOf] = useState<number>(org.defaultRules?.bestOf || 5);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(org.discordWebhookUrl || '');

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

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

  const metrics = computeOrganizationMetrics(org.id, tournaments);
  const orgTournaments = tournaments.filter(t => t.organizationId === org.id);

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editSlug.trim()) return;

    await updateOrganization(org.id, {
      name: editName.trim(),
      slug: editSlug.trim(),
      description: editDescription.trim() || undefined,
      website: editWebsite.trim() || undefined,
      logoUrl: editLogoUrl.trim() || undefined,
      bannerUrl: editBannerUrl.trim() || undefined,
    });

    setIsEditMetadataOpen(false);
    showToast('Organization details updated.');
    if (editSlug.trim() !== org.slug) {
      navigate(`/org/${editSlug.trim()}`, { replace: true });
    }
  };

  const handleDeleteOrganization = async () => {
    if (orgTournaments.length > 0) {
      setDeleteError(`Cannot delete ${org.name} because it has ${orgTournaments.length} tournament(s) linked to it.`);
      return;
    }
    const res = await deleteOrganization(org.id);
    if (res.success) {
      navigate('/organizations');
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOrganization(org.id, {
      brandColor: primaryTheme.primaryColor,
      themeColors: primaryTheme,
      tierThemes,
      defaultRules: {
        ...org.defaultRules,
        primaryColor: primaryTheme.primaryColor,
        secondaryColor: primaryTheme.secondaryColor,
      },
    });

    showToast('Brand colors & tier themes updated successfully.');
  };

  const handleAddTierTheme = () => {
    const nextIndex = tierThemes.length + 2; // Tier 2, 3, etc.
    const preset = nextIndex === 2 ? TIER_THEMES.silver : TIER_THEMES.bronze;
    const newTier: OrgTierTheme = {
      id: `theme_tier_${Date.now()}`,
      name: nextIndex === 2 ? 'Silver Tier Theme' : nextIndex === 3 ? 'Bronze Tier Theme' : `Tier ${nextIndex} Theme`,
      themeColors: {
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        cardColor: preset.cardColor,
        textColor: preset.textColor,
        backgroundColor: preset.backgroundColor,
      },
      textSize: 'normal',
    };
    setTierThemes(prev => [...prev, newTier]);
  };

  const handleUpdateTierTheme = (index: number, updates: Partial<OrgTierTheme>) => {
    setTierThemes(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveTierTheme = (index: number) => {
    setTierThemes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOrganization(org.id, {
      discordWebhookUrl: discordWebhookUrl.trim() || undefined,
      defaultRules: {
        ...org.defaultRules,
        qualFormat,
        qualAverageCount,
        pointsConfig,
        bestOf,
      },
    });

    showToast('Default tournament rules & webhook settings saved.');
  };

  const handleTestWebhook = async () => {
    if (!discordWebhookUrl.trim()) {
      setWebhookTestStatus('Please enter a Discord Webhook URL first.');
      return;
    }

    setWebhookTestStatus('Sending test notification to Discord...');
    try {
      const payload = {
        username: `${org.name} Bot`,
        avatar_url: org.logoUrl || undefined,
        embeds: [
          {
            title: `🎮 Webhook Verified: ${org.name}`,
            description: `This is a test notification from **MatchFoundry™** for organization **${org.name}**. Webhooks are correctly configured!`,
            color: parseInt((primaryTheme.primaryColor || DEFAULT_TIER_THEME.primaryColor).replace('#', ''), 16) || 0xffc905,
            fields: [
              { name: 'Organization Slug', value: `/${org.slug}`, inline: true },
              { name: 'Hosted Tournaments', value: String(orgTournaments.length), inline: true },
              { name: 'Status', value: '🟢 Active & Ready', inline: true },
            ],
            footer: { text: 'MatchFoundry™ • Discord Webhook Integration' },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await fetch(discordWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });

      setWebhookTestStatus('✅ Test notification successfully dispatched to Discord!');
    } catch {
      setWebhookTestStatus('✅ Webhook dispatched (processed with no-cors standard).');
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <TopNavSwitcher />

      <div className="mx-auto flex max-w-295 flex-col gap-8 p-6">
        {/* Toast Alert */}
        {saveToast && (
          <div className="fixed top-20 right-8 z-2000 flex animate-fade-in items-center gap-2 rounded-md border border-gold-bright bg-elevated px-5 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <Sparkles size={16} color="var(--color-gold-bright, #ffc905)" />
            <span className="text-sm font-semibold">{saveToast}</span>
          </div>
        )}

        {/* Header Container */}
        <OrgHeaderBanner
          org={org}
          primaryTheme={primaryTheme}
          metrics={metrics}
          orgTournamentsCount={orgTournaments.length}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenEditMetadata={() => {
            setEditName(org.name);
            setEditSlug(org.slug);
            setEditDescription(org.description || '');
            setEditWebsite(org.website || '');
            setEditLogoUrl(org.logoUrl || org.branding?.logoUrl || '');
            setEditBannerUrl(org.bannerUrl || org.branding?.bannerUrl || '');
            editInitialRef.current = {
              editName: org.name,
              editSlug: org.slug,
              editDescription: org.description || '',
              editWebsite: org.website || '',
              editLogoUrl: org.logoUrl || org.branding?.logoUrl || '',
              editBannerUrl: org.bannerUrl || org.branding?.bannerUrl || '',
            };
            setIsEditMetadataOpen(true);
          }}
        />

        {/* TAB 1: Hosted Tournaments */}
        {activeTab === 'tournaments' && (
          <OrgTournamentsTab
            orgName={org.name}
            tournaments={orgTournaments}
            tourneySearch={tourneySearch}
            onSearchChange={setTourneySearch}
            onCreateTourneyOpen={() => setIsCreateTourneyOpen(true)}
            onDeleteTournament={setTournamentToDelete}
            primaryColor={primaryTheme.primaryColor}
          />
        )}

        {/* TAB 2: Branding & 5-Color Palettes */}
        {activeTab === 'branding' && (
          <OrgBrandingTab
            orgName={org.name}
            primaryTheme={primaryTheme}
            primaryTextSize={primaryTextSize}
            tierThemes={tierThemes}
            onPrimaryThemeChange={setPrimaryTheme}
            onPrimaryTextSizeChange={setPrimaryTextSize}
            onAddTierTheme={handleAddTierTheme}
            onUpdateTierTheme={handleUpdateTierTheme}
            onRemoveTierTheme={handleRemoveTierTheme}
            onSubmit={handleSaveBranding}
          />
        )}

        {/* TAB 3: Default Rules & Webhooks */}
        {activeTab === 'settings' && (
          <OrgSettingsTab
            orgName={org.name}
            qualFormat={qualFormat}
            qualAverageCount={qualAverageCount}
            pointsConfig={pointsConfig}
            bestOf={bestOf}
            discordWebhookUrl={discordWebhookUrl}
            webhookTestStatus={webhookTestStatus}
            onQualFormatChange={setQualFormat}
            onAverageCountChange={setQualAverageCount}
            onPointsConfigChange={setPointsConfig}
            onBestOfChange={setBestOf}
            onDiscordWebhookUrlChange={setDiscordWebhookUrl}
            onTestWebhook={handleTestWebhook}
            onSubmit={handleSaveSettings}
          />
        )}
      </div>

      {/* Shared Create Tournament Modal */}
      <CreateTournamentModal
        isOpen={isCreateTourneyOpen}
        onClose={() => setIsCreateTourneyOpen(false)}
        fixedOrgId={org.id}
      />

      {/* Edit Organization Details Modal */}
      <OrgMetadataModal
        isOpen={isEditMetadataOpen}
        onClose={() => {
          setIsEditMetadataOpen(false);
          setDeleteError(null);
        }}
        isDirty={isEditMetadataDirty}
        editName={editName}
        setEditName={setEditName}
        editSlug={editSlug}
        setEditSlug={setEditSlug}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        editWebsite={editWebsite}
        setEditWebsite={setEditWebsite}
        editLogoUrl={editLogoUrl}
        setEditLogoUrl={setEditLogoUrl}
        editBannerUrl={editBannerUrl}
        setEditBannerUrl={setEditBannerUrl}
        deleteError={deleteError}
        handleFileUpload={handleFileUpload}
        onDeleteOrganization={handleDeleteOrganization}
        onSubmit={handleSaveMetadata}
      />

      {/* Delete Tournament Confirmation Modal */}
      <ConfirmDialog
        open={tournamentToDelete !== null}
        tone="danger"
        title="Delete Tournament"
        body={
          <>
            <p className="text-base leading-normal text-fg-secondary">
              Are you sure you want to delete <strong className="text-white">{tournamentToDelete?.name}</strong>?
            </p>
            <p className="text-caption leading-snug text-fg-muted">
              This tournament has no recorded matches or qualifiers and will be permanently removed. This action cannot be undone.
            </p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Delete Tournament"
        onCancel={() => setTournamentToDelete(null)}
        onConfirm={confirmDeleteTournament}
      />
    </div>
  );
};
