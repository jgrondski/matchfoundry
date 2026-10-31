import React from 'react';
import { Shield, AlertTriangle, ShieldCheck, Sliders } from 'lucide-react';
import { QualFormat, QualMode, PointsThreshold, DEFAULT_POINTS_THRESHOLDS, SeedingMethod } from '../../types';
import { ClearableNumberInput } from '../../../../components/ClearableNumberInput';
import { labelClass, inputClass } from './types';
import { Badge, Button, cn } from '../../../../components/ui';

interface TournamentInfoSectionProps {
  name: string;
  slug: string;
  date: string;
  location: string;
  seedingMethod: SeedingMethod;
  qualFormat: QualFormat;
  qualAverageCount?: number;
  avgCountError: string | null;
  pointsConfig: PointsThreshold[];
  qualMode: QualMode;
  qualWindowMinutes: number;
  isLocked: boolean;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onDateChange: (date: string) => void;
  onLocationChange: (loc: string) => void;
  onSeedingMethodChange: (method: SeedingMethod) => void;
  onQualFormatChange: (fmt: QualFormat) => void;
  onQualAverageCountChange: (count: number | undefined) => void;
  onAvgCountErrorChange: (err: string | null) => void;
  onPointsConfigChange: (config: PointsThreshold[]) => void;
  onQualModeChange: (mode: QualMode) => void;
  onQualWindowMinutesChange: (minutes: number) => void;
  onOpenPointsDrawer: () => void;
}

export const TournamentInfoSection: React.FC<TournamentInfoSectionProps> = ({
  name,
  slug,
  date,
  location,
  seedingMethod,
  qualFormat,
  qualAverageCount,
  avgCountError,
  pointsConfig,
  qualMode,
  qualWindowMinutes,
  isLocked,
  onNameChange,
  onSlugChange,
  onDateChange,
  onLocationChange,
  onSeedingMethodChange,
  onQualFormatChange,
  onQualAverageCountChange,
  onAvgCountErrorChange,
  onPointsConfigChange,
  onQualModeChange,
  onQualWindowMinutesChange,
  onOpenPointsDrawer,
}) => {
  return (
    <section className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface py-4 px-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <Shield size={18} color="var(--color-gold-bright)" />
          <h2 className="m-0 text-lg font-bold text-fg">
            Tournament Details
          </h2>
        </div>

        {/* Tournament Mode Status Indicator in Header */}
        <div className="flex items-center gap-2">
          {!isLocked ? (
            <Badge variant="gold" title="Qualifiers active. Brackets dynamically seed.">
              <AlertTriangle size={12} /> Qualifiers Mode
            </Badge>
          ) : (
            <Badge variant="green" title="Brackets locked. Live match scoring active.">
              <ShieldCheck size={12} /> Match Play Mode
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <div>
          <label className={labelClass}>Tournament Name</label>
          <input
            type="text"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>URL Slug</label>
          <input
            type="text"
            value={slug}
            onChange={e => onSlugChange(e.target.value)}
            required
            className={inputClass}
          />
          <span className="text-xs text-fg-muted">
            Public routing: /{slug}
          </span>
        </div>

        <div>
          <label className={labelClass}>Event Date</label>
          <input
            type="text"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            placeholder="e.g. March 21-22, 2026"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Location</label>
          <input
            type="text"
            value={location}
            onChange={e => onLocationChange(e.target.value)}
            placeholder="e.g. Kansas City, MO"
            className={inputClass}
          />
        </div>
      </div>

      {/* Seeding Method Selector */}
      <div className="border-t border-line-subtle pt-3.5">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Seeding Method</label>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={isLocked}
              onClick={() => onSeedingMethodChange('QUALIFIERS')}
              variant={seedingMethod === 'QUALIFIERS' ? 'primary' : 'secondary'}
              className="py-1.5 px-3.5 text-caption"
              title={isLocked ? 'Cannot change seeding method during match play' : 'Qualifiers Leaderboard: Players submit scores, leaderboard determines seeds'}
            >
              🏆 Qualifiers Leaderboard
            </Button>
            <Button
              disabled={isLocked}
              onClick={() => onSeedingMethodChange('MANUAL')}
              variant={seedingMethod === 'MANUAL' ? 'primary' : 'secondary'}
              className="py-1.5 px-3.5 text-caption"
              title={isLocked ? 'Cannot change seeding method during match play' : 'Direct / Manual Seeding: Enter players manually or paste a list, arrange seeds directly without quals'}
            >
              ✍️ Direct / Manual Seeding (No Quals)
            </Button>
          </div>
          <span className="text-xs text-fg-muted">
            {seedingMethod === 'QUALIFIERS'
              ? 'Brackets dynamically populate according to leaderboard standings.'
              : 'Qualifiers are bypassed. Organize seeds manually, paste a pre-ranked list, or randomize draw order in the Seeding manager.'}
          </span>
        </div>
      </div>

      {/* Qualifying Format Controls (Only active in Qualifiers Mode) */}
      {seedingMethod === 'QUALIFIERS' ? (
        <div className="flex flex-col gap-3.5 border-t border-line-subtle pt-3.5">
          {/* Mode & Duration Row */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            <div>
              <label className={labelClass}>Qualifying Mode</label>
              <select
                value={qualMode}
                onChange={e => onQualModeChange(e.target.value as QualMode)}
                className={inputClass}
              >
                <option value="IN_PERSON">In-Person Live Event</option>
                <option value="HYBRID">Hybrid (In-Person &amp; Online)</option>
                <option value="ONLINE">100% Online Tournament</option>
              </select>
              <span className="text-xs text-fg-muted">
                {qualMode === 'IN_PERSON'
                  ? 'Official attempts played live on venue hardware.'
                  : qualMode === 'ONLINE'
                  ? 'Competitors submit runs online via Twitch VOD.'
                  : 'Allows both venue scorekeeping and online VOD submissions.'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={labelClass}>Qualifying Duration (Minutes)</label>
                <div className="flex gap-1">
                  {[60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onQualWindowMinutesChange(mins)}
                      className={cn(
                        'cursor-pointer rounded-xs border border-line py-0.5 px-1.5 text-2xs',
                        qualWindowMinutes === mins
                          ? 'bg-gold font-extrabold text-black'
                          : 'bg-elevated font-medium text-fg-secondary'
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={1440}
                value={qualWindowMinutes}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  onQualWindowMinutesChange(isNaN(val) || val < 1 ? 1 : val);
                }}
                className={inputClass}
              />
              <span className="text-xs text-fg-muted">
                Default start time for the countdown timer. Can be edited at any time.
              </span>
            </div>
          </div>

          <div className="flex w-full items-start gap-4">
            {/* Format Selection Dropdown */}
            <div className="min-w-50 flex-[0_0_240px]">
              <label className={labelClass}>Qualifying Format</label>
              <select
                value={qualFormat}
                onChange={e => {
                  const newFmt = e.target.value as QualFormat;
                  onQualFormatChange(newFmt);
                  if (newFmt === 'POINTS' && (!pointsConfig || pointsConfig.length === 0)) {
                    onPointsConfigChange(DEFAULT_POINTS_THRESHOLDS);
                  }
                }}
                className={inputClass}
              >
                <option value="HIGH_SCORE"># of Maxes</option>
                <option value="AVERAGE_OF_X">Average of X Attempts</option>
                <option value="POINTS">Points Threshold System</option>
              </select>
            </div>

            {/* Conditional format inline settings on the exact same row */}
            {qualFormat === 'HIGH_SCORE' && (
              <div className="mt-6 flex h-9.5 min-w-0 flex-1 items-center rounded-sm border border-line-subtle bg-elevated py-0 px-3.5 text-caption text-fg-muted">
                <span>Ranked by number of maxouts; kickers act as the tiebreaker.</span>
              </div>
            )}

            {qualFormat === 'AVERAGE_OF_X' && (
              <div className="flex min-w-0 flex-1 items-start gap-3.5">
                <div className="w-37.5 shrink-0">
                  <label className={labelClass}>Attempts (X)</label>
                  <ClearableNumberInput
                    min={1}
                    max={10}
                    value={qualAverageCount}
                    onChange={val => {
                      onQualAverageCountChange(val);
                      if (avgCountError) onAvgCountErrorChange(null);
                    }}
                    error={avgCountError}
                    onErrorChange={onAvgCountErrorChange}
                    className={inputClass}
                  />
                </div>
                <div className="mt-6 flex h-9.5 min-w-0 flex-1 items-center rounded-sm border border-line-subtle bg-elevated py-0 px-3.5 text-caption text-fg-muted">
                  <span>Ranked by average of top {qualAverageCount || 'X'} qualifying attempts.</span>
                </div>
              </div>
            )}

            {qualFormat === 'POINTS' && (
              <div className="mt-6 flex h-9.5 min-w-0 flex-1 items-center justify-between gap-3 rounded-sm border border-line-subtle bg-elevated py-0 px-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="whitespace-nowrap rounded-full bg-gold/15 py-0.5 px-2 text-xs font-bold text-gold-bright">
                    {pointsConfig.length} {pointsConfig.length === 1 ? 'cutoff' : 'cutoffs'}
                  </span>
                  <span className="truncate text-caption text-fg-muted">
                    {pointsConfig.length > 0
                      ? [...pointsConfig].sort((a, b) => b.minScore - a.minScore).slice(0, 3).map(p => `${(p.minScore / 1000).toFixed(0)}k → +${p.points}`).join(', ') + (pointsConfig.length > 3 ? ', ...' : '')
                      : 'Attempts award points by highest cutoff reached.'}
                  </span>
                </div>
                <Button
                  onClick={onOpenPointsDrawer}
                  className="shrink-0 gap-1.5 whitespace-nowrap py-1 px-2.5 text-xs"
                >
                  <Sliders size={13} color="var(--color-gold-bright)" />
                  Configure Cutoffs
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-line-subtle pt-3.5">
          <div className="flex items-center gap-2.5 rounded-md border border-indigo-500/25 bg-indigo-500/8 py-3 px-4 text-caption text-fg-secondary">
            <Sliders size={18} color="var(--color-brand)" className="shrink-0" />
            <div>
              <strong className="text-fg">Direct Seeding Active</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
