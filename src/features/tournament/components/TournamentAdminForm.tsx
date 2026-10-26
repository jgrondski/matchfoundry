import React, { useState, useMemo, useEffect } from 'react';
import { Tournament, TournamentTier, QualFormat, QualMode, PointsThreshold, DEFAULT_POINTS_THRESHOLDS, SeedingMethod } from '../types';
import { useTournament } from '../store';
import { createDefaultTier } from '../defaults';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { useOrganization } from '../../organizations/store';
import { generateTraditionalBracket, generateFlatBracket, generateDoubleEliminationBracket, getValidFlatWidths } from '../../bracket/math';
import { getDefaultTierColors, TierThemeColors } from '../../bracket/colorUtils';
import { generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { pruneInvalidRoundOverrides } from '../roundOverrides';
import { VerifyBracketModal } from './VerifyBracketModal';
import { PointsThresholdsDrawer } from './PointsThresholdsDrawer';

import { TournamentInfoSection } from './settings/TournamentInfoSection';
import { OrgBrandPaletteSection } from './settings/OrgBrandPaletteSection';
import { TierManagementSection } from './settings/TierManagementSection';
import { DataSimulationSection } from './settings/DataSimulationSection';
import { TournamentSecuritySection } from './settings/TournamentSecuritySection';
import { AdminFormModals } from './settings/AdminFormModals';
import { usePinAuth } from '../../auth/AuthContext';

interface TournamentAdminFormProps {
  tournament: Tournament;
  onSaved?: (savedTournament?: Tournament) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export const TournamentAdminForm: React.FC<TournamentAdminFormProps> = ({
  tournament,
  onSaved,
  onDirtyChange,
}) => {
  const {
    updateTournament,
    clearMatchScores,
    clearQualifierScores,
    clearAllTournamentData,
    seedQualifiers,
    simulateFullTournament,
    unlockBrackets,
    setOnlineQualsOpen,
  } = useTournament();
  const { isSystemAdmin } = usePinAuth();

  const { organizations, getOrganizationById } = useOrganization();

  // Tournament Fields State
  const [name, setName] = useState(tournament.name);
  const [slug, setSlug] = useState(tournament.slug);
  const [organizationId, setOrganizationId] = useState<string>(
    tournament.organizationId || organizations[0]?.id || ''
  );
  const [useOrgBranding, setUseOrgBranding] = useState<boolean>(
    tournament.useOrgBranding ?? true
  );
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>(
    tournament.discordWebhookUrl || ''
  );
  const [logoUrl, setLogoUrl] = useState<string>(
    tournament.logoUrl || ''
  );
  const [bannerUrl, setBannerUrl] = useState<string>(
    tournament.bannerUrl || ''
  );
  const [webhookTestStatus, setWebhookTestStatus] = useState<string | null>(null);

  const selectedOrg = getOrganizationById(organizationId);

  const [date, setDate] = useState(tournament.date);
  const [location, setLocation] = useState(tournament.location || '');
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>(tournament.seedingMethod || 'QUALIFIERS');
  const [qualFormat, setQualFormat] = useState<QualFormat>(tournament.qualFormat || 'AVERAGE_OF_X');
  const [qualAverageCount, setQualAverageCount] = useState<number | undefined>(tournament.qualAverageCount || 2);
  const [avgCountError, setAvgCountError] = useState<string | null>(null);
  const [pointsConfig, setPointsConfig] = useState<PointsThreshold[]>(
    tournament.pointsConfig && tournament.pointsConfig.length > 0
      ? tournament.pointsConfig
      : DEFAULT_POINTS_THRESHOLDS
  );
  const [qualMode, setQualMode] = useState<QualMode>(tournament.qualMode || 'HYBRID');
  const [qualWindowMinutes, setQualWindowMinutes] = useState<number>(tournament.qualWindowMinutes || 90);
  const [isPointsDrawerOpen, setIsPointsDrawerOpen] = useState(false);
  const [isSettingsVerifyModalOpen, setIsSettingsVerifyModalOpen] = useState(false);
  const [settingsUnlockError, setSettingsUnlockError] = useState<string | null>(null);

  const handleApplyOrgColorsToTiers = () => {
    const orgPalette = selectedOrg?.themeColors || selectedOrg?.branding?.themeColors;
    if (!orgPalette) return;
    const tierThemesList = selectedOrg?.tierThemes || [];

    setTiers(prev =>
      prev.map((t, idx) => {
        const palette =
          idx > 0 && tierThemesList[idx - 1]?.themeColors
            ? tierThemesList[idx - 1].themeColors
            : orgPalette;
        return {
          ...t,
          primaryColor: palette.primaryColor,
          secondaryColor: palette.secondaryColor,
          cardColor: palette.cardColor,
          textColor: palette.textColor,
          backgroundColor: palette.backgroundColor,
        };
      })
    );
  };

  const handleTestDiscordWebhook = () => {
    const targetUrl = discordWebhookUrl.trim() || selectedOrg?.discordWebhookUrl?.trim();
    if (!targetUrl) {
      setWebhookTestStatus('No webhook URL configured (either tournament or organization)');
      setTimeout(() => setWebhookTestStatus(null), 3000);
      return;
    }
    setWebhookTestStatus('Ping simulated: Discord webhook target resolved successfully!');
    setTimeout(() => setWebhookTestStatus(null), 4000);
  };

  // Tiers State
  const [tiers, setTiers] = useState<TournamentTier[]>(tournament.tiers || []);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tierToDelete, setTierToDelete] = useState<{ index: number; tier: TournamentTier } | null>(null);
  const [dataActionToConfirm, setDataActionToConfirm] = useState<'MATCHES' | 'QUALS' | 'ALL' | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const [openThemes, setOpenThemes] = useState<Record<string, boolean>>({});

  const toggleThemeCollapse = (tierId: string) => {
    setOpenThemes(prev => ({
      ...prev,
      [tierId]: !prev[tierId],
    }));
  };

  useEffect(() => {
    if (!simFeedback) return;
    const timer = setTimeout(() => setSimFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [simFeedback]);

  const qualifierCount = (tournament.qualifierSubmissions?.length || 0) + (tournament.qualifiers?.length || 0);
  const recordedMatchCount = Object.values(tournament.matchScores || {}).filter(
    m => m.isComplete || m.player1Wins > 0 || m.player2Wins > 0 ||
      m.games?.some(g => g.player1Points !== null || g.player2Points !== null)
  ).length;

  // Helper to normalize colors for dirty comparison
  const normColor = (
    tier: TournamentTier,
    field: keyof TierThemeColors
  ): string => {
    const val = tier[field];
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim().toLowerCase();
    }
    const defaults = getDefaultTierColors(tier);
    return (defaults[field] || '#c2410c').toLowerCase();
  };

  // Track dirty state
  const isDirty = useMemo(() => {
    if (name.trim() !== (tournament.name || '').trim()) return true;
    if (slug.trim() !== (tournament.slug || '').trim()) return true;
    if ((organizationId || '') !== (tournament.organizationId || '')) return true;
    if (useOrgBranding !== (tournament.useOrgBranding ?? true)) return true;
    if ((discordWebhookUrl || '').trim() !== (tournament.discordWebhookUrl || '').trim()) return true;
    if ((logoUrl || '').trim() !== (tournament.logoUrl || '').trim()) return true;
    if ((bannerUrl || '').trim() !== (tournament.bannerUrl || '').trim()) return true;
    if (date.trim() !== (tournament.date || '').trim()) return true;
    if (location.trim() !== (tournament.location || '').trim()) return true;
    if (seedingMethod !== (tournament.seedingMethod || 'QUALIFIERS')) return true;
    if (qualFormat !== tournament.qualFormat) return true;
    if (qualAverageCount !== (tournament.qualAverageCount || 2)) return true;
    if (qualMode !== (tournament.qualMode || 'HYBRID')) return true;
    if (qualWindowMinutes !== (tournament.qualWindowMinutes || 90)) return true;

    // Points config
    if (qualFormat === 'POINTS') {
      const initialPoints =
        tournament.pointsConfig && tournament.pointsConfig.length > 0
          ? tournament.pointsConfig
          : DEFAULT_POINTS_THRESHOLDS;
      if (JSON.stringify(pointsConfig) !== JSON.stringify(initialPoints)) return true;
    } else if (tournament.pointsConfig && tournament.pointsConfig.length > 0) {
      if (JSON.stringify(pointsConfig) !== JSON.stringify(tournament.pointsConfig)) return true;
    }

    // Tiers
    const initialTiers = tournament.tiers || [];
    if (tiers.length !== initialTiers.length) return true;
    for (let i = 0; i < tiers.length; i++) {
      const a = tiers[i];
      const b = initialTiers[i];
      if (!b) return true;
      const isSameTier =
        a.id === b.id ||
        (Boolean(a.slug && b.slug) && a.slug.trim() === b.slug.trim());
      if (!isSameTier) return true;
      if (
        (a.slug || '').trim() !== (b.slug || '').trim() ||
        (a.name || '').trim() !== (b.name || '').trim() ||
        a.priority !== b.priority ||
        a.bracketType !== b.bracketType ||
        (a.eliminationType || 'SINGLE') !== (b.eliminationType || 'SINGLE') ||
        a.playerCount !== b.playerCount ||
        a.bestOf !== b.bestOf ||
        (a.flatWidth || 0) !== (b.flatWidth || 0) ||
        normColor(a, 'primaryColor') !== normColor(b, 'primaryColor') ||
        normColor(a, 'secondaryColor') !== normColor(b, 'secondaryColor') ||
        normColor(a, 'cardColor') !== normColor(b, 'cardColor') ||
        normColor(a, 'textColor') !== normColor(b, 'textColor') ||
        normColor(a, 'backgroundColor') !== normColor(b, 'backgroundColor') ||
        normColor(a, 'lowerBracketColor') !== normColor(b, 'lowerBracketColor') ||
        (a.textSize || 'normal') !== (b.textSize || 'normal') ||
        JSON.stringify(a.roundBestOfOverrides || {}) !== JSON.stringify(b.roundBestOfOverrides || {})
      ) {
        return true;
      }
    }

    return false;
  }, [
    name,
    slug,
    date,
    location,
    seedingMethod,
    qualFormat,
    qualAverageCount,
    pointsConfig,
    tiers,
    tournament,
    organizationId,
    useOrgBranding,
    discordWebhookUrl,
    logoUrl,
    bannerUrl,
    qualMode,
    qualWindowMinutes,
  ]);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Hook browser window beforeunload warning if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Re-sync fields when tournament changes if form is clean
  useEffect(() => {
    if (!isDirty) {
      setName(tournament.name || '');
      setSlug(tournament.slug || '');
      setOrganizationId(tournament.organizationId || '');
      setUseOrgBranding(tournament.useOrgBranding ?? true);
      setDiscordWebhookUrl(tournament.discordWebhookUrl || '');
      setLogoUrl(tournament.logoUrl || '');
      setBannerUrl(tournament.bannerUrl || '');
      setDate(tournament.date || '');
      setLocation(tournament.location || '');
      setSeedingMethod(tournament.seedingMethod || 'QUALIFIERS');
      setQualFormat(tournament.qualFormat || 'AVERAGE_OF_X');
      setQualAverageCount(tournament.qualAverageCount || 2);
      setQualMode(tournament.qualMode || 'HYBRID');
      setQualWindowMinutes(tournament.qualWindowMinutes || 90);
      setAvgCountError(null);
      setPointsConfig(
        tournament.pointsConfig && tournament.pointsConfig.length > 0
          ? tournament.pointsConfig
          : DEFAULT_POINTS_THRESHOLDS
      );
      setTiers(tournament.tiers || []);
    }
  }, [tournament, isDirty]);

  const handleDiscardChanges = () => {
    setName(tournament.name || '');
    setSlug(tournament.slug || '');
    setOrganizationId(tournament.organizationId || '');
    setUseOrgBranding(tournament.useOrgBranding ?? true);
    setDiscordWebhookUrl(tournament.discordWebhookUrl || '');
    setLogoUrl(tournament.logoUrl || '');
    setBannerUrl(tournament.bannerUrl || '');
    setDate(tournament.date || '');
    setLocation(tournament.location || '');
    setSeedingMethod(tournament.seedingMethod || 'QUALIFIERS');
    setQualFormat(tournament.qualFormat || 'AVERAGE_OF_X');
    setQualAverageCount(tournament.qualAverageCount || 2);
    setQualMode(tournament.qualMode || 'HYBRID');
    setQualWindowMinutes(tournament.qualWindowMinutes || 90);
    setAvgCountError(null);
    setPointsConfig(
      tournament.pointsConfig && tournament.pointsConfig.length > 0
        ? tournament.pointsConfig
        : DEFAULT_POINTS_THRESHOLDS
    );
    setTiers(tournament.tiers || []);
    setSettingsUnlockError(null);
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    const isAutoSlug =
      slug ===
      tournament.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    if (isAutoSlug || !slug) {
      setSlug(
        newName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      );
    }
  };

  const addThreshold = () => {
    const nextScore = pointsConfig.length > 0 ? pointsConfig[pointsConfig.length - 1].minScore + 100000 : 500000;
    const nextPoints = pointsConfig.length > 0 ? pointsConfig[pointsConfig.length - 1].points + 5 : 5;
    setPointsConfig([...pointsConfig, { minScore: nextScore, points: nextPoints }]);
  };

  const updateThreshold = (index: number, field: 'minScore' | 'points', value: number) => {
    const next = [...pointsConfig];
    next[index] = {
      ...next[index],
      [field]: Math.max(0, value),
    };
    setPointsConfig(next);
  };

  const removeThreshold = (index: number) => {
    setPointsConfig(pointsConfig.filter((_, i) => i !== index));
  };

  const addTier = () => {
    const nextPriority = tiers.length + 1;
    const newTier = createDefaultTier(nextPriority);
    const nextTiers = [...tiers, newTier];
    const draftTiers = generateDraftBracketsForTournament({ ...tournament, tiers: nextTiers });
    setTiers(draftTiers);
    setOpenThemes(prev => ({
      ...prev,
      [newTier.id]: true,
    }));
  };

  const updateTier = (index: number, updates: Partial<TournamentTier>) => {
    setTiers(prev => {
      const next = [...prev];
      let target = { ...next[index], ...updates };
      if (updates.name && !updates.slug) {
        target.slug = updates.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      }
      const structuralChange =
        updates.playerCount !== undefined ||
        updates.bracketType !== undefined ||
        updates.eliminationType !== undefined ||
        updates.bracketRouting !== undefined ||
        updates.flatWidth !== undefined ||
        updates.finalsCutoff !== undefined;

      if (structuralChange) {
        if (target.eliminationType === 'DOUBLE') {
          if (target.bracketRouting === 'FLAT_STAGED') {
            if (target.flatWidth !== 4 && target.flatWidth !== 8) {
              target.flatWidth = 4;
            }
          } else if (target.bracketRouting === 'ACCELERATED_HYBRID') {
            if (target.finalsCutoff !== 8 && target.finalsCutoff !== 16) {
              target.finalsCutoff = 16;
            }
          }
        } else if (target.bracketType === 'FLAT') {
          const validWidths = getValidFlatWidths(target.playerCount);
          if (!validWidths.includes(target.flatWidth || 0)) {
            target.flatWidth = validWidths[validWidths.length - 1] ?? 2;
          }
        }
        target = pruneInvalidRoundOverrides(target);
      }
      next[index] = target;

      if (!tournament.isLocked && structuralChange) {
        return generateDraftBracketsForTournament({ ...tournament, tiers: next });
      }
      return next;
    });
  };

  const moveTier = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === tiers.length - 1) return;

    setTiers(prev => {
      const next = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = next[index];
      next[index] = next[swapIndex];
      next[swapIndex] = temp;
      const reordered = next.map((t, idx) => ({ ...t, priority: idx + 1 }));
      if (!tournament.isLocked) {
        return generateDraftBracketsForTournament({ ...tournament, tiers: reordered });
      }
      return reordered;
    });
  };

  const deleteTier = (index: number) => {
    const tier = tiers[index];
    if (tier) {
      setOpenThemes(prev => {
        const next = { ...prev };
        delete next[tier.id];
        return next;
      });
    }
    setTiers(prev => {
      const next = prev.filter((_, i) => i !== index).map((t, idx) => ({ ...t, priority: idx + 1 }));
      if (!tournament.isLocked) {
        return generateDraftBracketsForTournament({ ...tournament, tiers: next });
      }
      return next;
    });
  };

  const saveCurrentConfig = async (): Promise<boolean> => {
    let updatedTiers: TournamentTier[];
    if (tournament.isLocked) {
      // In locked match play mode, preserve existing active bracket matches, results, and player progression
      updatedTiers = tiers.map(tier => ({
        ...tier,
        bracket: tier.bracket,
      }));
    } else {
      const baseTiers = tiers.map(tier => {
        const dummyPlayers = Array.from({ length: tier.playerCount }, (_, i) => ({
          id: `dummy_${i + 1}`,
          name: `Seed ${i + 1}`,
          seed: i + 1,
        }));

        const newBracket =
          tier.eliminationType === 'DOUBLE'
            ? generateDoubleEliminationBracket(dummyPlayers, {
                tierId: tier.id,
                bracketRouting: tier.bracketRouting,
                flatWidth: tier.flatWidth,
                finalsCutoff: tier.finalsCutoff,
                bestOf: tier.bestOf,
                roundBestOfOverrides: tier.roundBestOfOverrides,
              })
            : tier.bracketType === 'FLAT'
            ? generateFlatBracket(dummyPlayers, tier.flatWidth || 4, {
                tierId: tier.id,
                bestOf: tier.bestOf,
                roundBestOfOverrides: tier.roundBestOfOverrides,
              })
            : generateTraditionalBracket(dummyPlayers, {
                tierId: tier.id,
                bestOf: tier.bestOf,
                roundBestOfOverrides: tier.roundBestOfOverrides,
              });

        return {
          ...tier,
          bracket: newBracket,
        };
      });

      updatedTiers = generateDraftBracketsForTournament({ ...tournament, tiers: baseTiers });
    }

    let parsedAvg = 2;
    if (qualFormat === 'AVERAGE_OF_X') {
      if (qualAverageCount === undefined || isNaN(qualAverageCount) || qualAverageCount < 1) {
        setAvgCountError('Please enter a valid attempt count (minimum 1)');
        return false;
      }
      parsedAvg = qualAverageCount;
    }

    setIsSaving(true);
    try {
      const saved = await updateTournament(tournament.id, {
        name,
        slug,
        organizationId,
        useOrgBranding,
        discordWebhookUrl,
        logoUrl,
        bannerUrl,
        date,
        location,
        seedingMethod,
        qualFormat,
        qualAverageCount: parsedAvg,
        pointsConfig,
        qualMode,
        qualWindowMinutes,
        tiers: updatedTiers,
      });

      if (saved) {
        // Immediately sync local form state with saved tournament returned from database
        setName(saved.name || '');
        setSlug(saved.slug || '');
        setOrganizationId(saved.organizationId || '');
        setUseOrgBranding(saved.useOrgBranding ?? true);
        setDiscordWebhookUrl(saved.discordWebhookUrl || '');
        setLogoUrl(saved.logoUrl || '');
        setBannerUrl(saved.bannerUrl || '');
        setDate(saved.date || '');
        setLocation(saved.location || '');
        setSeedingMethod(saved.seedingMethod || 'QUALIFIERS');
        setQualFormat(saved.qualFormat || 'AVERAGE_OF_X');
        setQualAverageCount(saved.qualAverageCount || 2);
        setQualMode(saved.qualMode || 'HYBRID');
        setQualWindowMinutes(saved.qualWindowMinutes || 90);
        setAvgCountError(null);
        setPointsConfig(
          saved.pointsConfig && saved.pointsConfig.length > 0
            ? saved.pointsConfig
            : DEFAULT_POINTS_THRESHOLDS
        );
        setTiers(saved.tiers || []);

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        onDirtyChange?.(false);
        onSaved?.(saved);
        console.log('[TournamentAdminForm] Saved configuration successfully:', saved);
        return true;
      } else {
        console.error('[TournamentAdminForm] Failed to save configuration: server returned no data');
        return false;
      }
    } catch (err) {
      console.error('[TournamentAdminForm] Error saving configuration:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qualFormat === 'AVERAGE_OF_X') {
      if (qualAverageCount === undefined || isNaN(qualAverageCount) || qualAverageCount < 1 || qualAverageCount > 10) {
        setAvgCountError('Attempt count must be an integer between 1 and 10');
        return;
      }
    }
    await saveCurrentConfig();
  };

  const handleSeedQualifiers = async () => {
    await saveCurrentConfig();
    seedQualifiers(tournament.id);
    setSimFeedback(
      seedingMethod === 'MANUAL'
        ? 'Competitors and manual seeds generated successfully!'
        : 'Realistic competitors and qualifier attempts seeded successfully!'
    );
  };

  const handleSimulate = async () => {
    await saveCurrentConfig();
    simulateFullTournament(tournament.id);
    setSimFeedback(
      seedingMethod === 'MANUAL'
        ? 'Full tournament simulated: manual seeds, locked brackets, and complete match outcomes!'
        : 'Full tournament simulated: qualifiers, locked seeds, and complete match outcomes!'
    );
  };

  // Derive cutoffs
  let currentStart = 1;
  const tierThresholdBadges = tiers.map(t => {
    const start = currentStart;
    const end = currentStart + t.playerCount - 1;
    currentStart = end + 1;
    return { start, end };
  });

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner & Save Indicator */}
      {saveSuccess && (
        <div
          style={{
            background: 'var(--color-green-bg)',
            border: '1px solid var(--color-green)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={20} />
          Tournament configuration &amp; tiers saved successfully!
        </div>
      )}

      {/* Tournament Phase & Bracket Lock Banner */}
      <div
        style={{
          background: tournament.isLocked
            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)'
            : 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.18) 100%)',
          border: tournament.isLocked ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '0.6rem 1.15rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: tournament.isLocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tournament.isLocked ? '#34d399' : 'var(--color-gold-bright)',
              flexShrink: 0,
            }}
          >
            {tournament.isLocked ? <ShieldCheck size={16} /> : <Lock size={16} />}
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tournament.isLocked ? '#34d399' : 'var(--color-gold-bright)', marginRight: '0.5rem' }}>
              {tournament.isLocked ? 'MATCH PLAY MODE (LOCKED)' : 'QUALIFIERS MODE (DRAFT PREVIEW)'}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              {tournament.isLocked
                ? 'Bracket seeds are frozen and match play is live.'
                : 'Bracket seeds update dynamically with qualifiers.'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {settingsUnlockError && (
            <span style={{ color: 'var(--color-red)', fontSize: '0.75rem', fontWeight: 600 }}>
              {settingsUnlockError}
            </span>
          )}
          {tournament.isLocked ? (
            <button
              type="button"
              onClick={async () => {
                const res = await unlockBrackets(tournament.id);
                if (!res.success && res.error) {
                  setSettingsUnlockError(res.error);
                } else {
                  setSettingsUnlockError(null);
                }
              }}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              title="Revert tournament to Qualifiers Mode"
            >
              <Unlock size={14} />
              Unlock Brackets
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSettingsVerifyModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              <Lock size={14} />
              Lock Brackets and Begin Match Play
            </button>
          )}
        </div>
      </div>

      {/* Online Qualifying open/close (saved immediately via its own endpoint, not the form Save) */}
      {!tournament.isLocked && (tournament.qualMode || 'HYBRID') !== 'IN_PERSON' && (
        <div
          style={{
            background: 'var(--color-bg-surface)',
            border: tournament.onlineQualsOpen ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
          data-testid="online-quals-toggle-bar"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Globe size={18} color={tournament.onlineQualsOpen ? '#34d399' : 'var(--color-text-muted)'} style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tournament.onlineQualsOpen ? '#34d399' : 'var(--color-text-primary)', marginRight: '0.5rem' }}>
                {tournament.onlineQualsOpen ? 'ONLINE QUALIFYING OPEN' : 'ONLINE QUALIFYING CLOSED'}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                {tournament.onlineQualsOpen
                  ? 'Listed on the front page; competitors can start online runs.'
                  : 'Hidden from the front page; online runs cannot be started.'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void setOnlineQualsOpen(tournament.id, !tournament.onlineQualsOpen);
            }}
            className={tournament.onlineQualsOpen ? 'btn btn-secondary' : 'btn btn-primary'}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          >
            {tournament.onlineQualsOpen ? 'Close Online Quals' : 'Open Online Quals'}
          </button>
        </div>
      )}

      {/* Section 1: Tournament Information */}
      <TournamentInfoSection
        name={name}
        slug={slug}
        date={date}
        location={location}
        seedingMethod={seedingMethod}
        qualFormat={qualFormat}
        qualAverageCount={qualAverageCount}
        avgCountError={avgCountError}
        pointsConfig={pointsConfig}
        qualMode={qualMode}
        qualWindowMinutes={qualWindowMinutes}
        isLocked={tournament.isLocked}
        onNameChange={handleNameChange}
        onSlugChange={setSlug}
        onDateChange={setDate}
        onLocationChange={setLocation}
        onSeedingMethodChange={setSeedingMethod}
        onQualFormatChange={setQualFormat}
        onQualAverageCountChange={setQualAverageCount}
        onAvgCountErrorChange={setAvgCountError}
        onPointsConfigChange={setPointsConfig}
        onQualModeChange={setQualMode}
        onQualWindowMinutesChange={setQualWindowMinutes}
        onOpenPointsDrawer={() => setIsPointsDrawerOpen(true)}
      />

      {/* Section 2: Organization & Brand Palette */}
      <OrgBrandPaletteSection
        selectedOrg={selectedOrg}
        organizations={organizations}
        organizationId={organizationId}
        useOrgBranding={useOrgBranding}
        discordWebhookUrl={discordWebhookUrl}
        logoUrl={logoUrl}
        bannerUrl={bannerUrl}
        webhookTestStatus={webhookTestStatus}
        onOrganizationIdChange={setOrganizationId}
        onUseOrgBrandingChange={setUseOrgBranding}
        onDiscordWebhookUrlChange={setDiscordWebhookUrl}
        onLogoUrlChange={setLogoUrl}
        onBannerUrlChange={setBannerUrl}
        onApplyOrgColorsToTiers={handleApplyOrgColorsToTiers}
        onTestDiscordWebhook={handleTestDiscordWebhook}
      />

      {/* Section 3: Tier Management */}
      <TierManagementSection
        tiers={tiers}
        openThemes={openThemes}
        tierThresholdBadges={tierThresholdBadges}
        onToggleThemeCollapse={toggleThemeCollapse}
        onAddTier={addTier}
        onUpdateTier={updateTier}
        onMoveTier={moveTier}
        onRequestDeleteTier={(idx, tier) => setTierToDelete({ index: idx, tier })}
      />

      {/* Section 4: Access Security & PIN Management */}
      <TournamentSecuritySection
        tournamentId={tournament.id}
        tournamentSlug={tournament.slug}
      />

      {/* Section 5: Data Management & Simulation (Strictly System Admin Only per AGENTS.md Section 10) */}
      {isSystemAdmin && (
        <DataSimulationSection
          seedingMethod={seedingMethod}
          manualSeedsCount={tournament.manualSeeds?.length || 0}
          qualifierCount={qualifierCount}
          recordedMatchCount={recordedMatchCount}
          hasTiers={tiers.length > 0}
          simFeedback={simFeedback}
          onSeedQualifiers={handleSeedQualifiers}
          onSimulate={handleSimulate}
          onRequestDataAction={action => setDataActionToConfirm(action)}
        />
      )}

      {/* Save Button Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '1rem',
          position: 'sticky',
          bottom: '1rem',
          background: 'var(--color-bg-surface-elevated)',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: '0.85rem',
            color: isDirty ? 'var(--color-gold-bright)' : 'var(--color-text-muted)',
            fontWeight: 600,
            marginRight: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          {isDirty ? (
            <>
              <AlertTriangle size={16} /> Unsaved changes
            </>
          ) : (
            <>
              <CheckCircle2 size={16} color="var(--color-green)" /> All changes saved
            </>
          )}
        </span>

        <button
          type="button"
          onClick={handleDiscardChanges}
          disabled={!isDirty}
          className="btn btn-secondary"
          style={{
            padding: '0.65rem 1.25rem',
            fontSize: '0.9rem',
            opacity: !isDirty ? 0.4 : 1,
            cursor: !isDirty ? 'not-allowed' : 'pointer',
          }}
          title={!isDirty ? 'No changes to discard' : 'Revert unsaved changes'}
        >
          Discard Changes
        </button>

        <button
          type="submit"
          disabled={!isDirty || isSaving}
          className="btn btn-primary"
          style={{
            padding: '0.65rem 1.75rem',
            fontSize: '0.95rem',
            boxShadow: isDirty ? 'var(--shadow-gold)' : 'none',
            opacity: !isDirty || isSaving ? 0.45 : 1,
            cursor: !isDirty || isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Modals */}
      <AdminFormModals
        seedingMethod={seedingMethod}
        tierToDelete={tierToDelete}
        tiersCount={tiers.length}
        onConfirmDeleteTier={idx => {
          deleteTier(idx);
          setTierToDelete(null);
        }}
        onCancelDeleteTier={() => setTierToDelete(null)}
        dataActionToConfirm={dataActionToConfirm}
        qualifierCount={seedingMethod === 'MANUAL' ? (tournament.manualSeeds?.length || 0) : qualifierCount}
        recordedMatchCount={recordedMatchCount}
        isExecutingAction={isExecutingAction}
        onConfirmDataAction={async () => {
          setIsExecutingAction(true);
          try {
            if (dataActionToConfirm === 'MATCHES') {
              await clearMatchScores(tournament.id);
              setSimFeedback('Match scores cleared.');
            } else if (dataActionToConfirm === 'QUALS') {
              if (recordedMatchCount > 0) {
                setSimFeedback('Cannot clear qualifiers while match scores exist. Execute "Clear Matches" first.');
                setDataActionToConfirm(null);
                return;
              }
              await clearQualifierScores(tournament.id);
              setSimFeedback(seedingMethod === 'MANUAL' ? 'Registered seeds cleared.' : 'Qualifier scores cleared.');
            } else if (dataActionToConfirm === 'ALL') {
              await clearAllTournamentData(tournament.id);
              setSimFeedback('All tournament data cleared.');
            }
          } finally {
            setIsExecutingAction(false);
            setDataActionToConfirm(null);
          }
        }}
        onCancelDataAction={() => setDataActionToConfirm(null)}
      />

      {/* Points Thresholds Drawer */}
      <PointsThresholdsDrawer
        isOpen={isPointsDrawerOpen}
        onClose={() => setIsPointsDrawerOpen(false)}
        pointsConfig={pointsConfig}
        onAddThreshold={addThreshold}
        onUpdateThreshold={updateThreshold}
        onRemoveThreshold={removeThreshold}
      />

      {isSettingsVerifyModalOpen && (
        <VerifyBracketModal
          isOpen={isSettingsVerifyModalOpen}
          onClose={() => setIsSettingsVerifyModalOpen(false)}
          tournament={tournament}
        />
      )}
    </form>
  );
};
