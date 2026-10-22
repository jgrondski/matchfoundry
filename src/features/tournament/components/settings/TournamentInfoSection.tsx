import React from 'react';
import { Shield, AlertTriangle, ShieldCheck, Sliders } from 'lucide-react';
import { QualFormat, QualMode, PointsThreshold, DEFAULT_POINTS_THRESHOLDS, SeedingMethod } from '../../types';
import { ClearableNumberInput } from '../../../../components/ClearableNumberInput';
import { labelStyle, inputStyle } from './types';

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
    <section
      style={{
        background: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={18} color="var(--color-gold-bright)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Tournament Details
          </h2>
        </div>

        {/* Tournament Mode Status Indicator in Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isLocked ? (
            <span className="badge badge-gold" style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }} title="Qualifiers active. Brackets dynamically seed.">
              <AlertTriangle size={12} /> Qualifiers Mode
            </span>
          ) : (
            <span className="badge badge-green" style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }} title="Brackets locked. Live match scoring active.">
              <ShieldCheck size={12} /> Match Play Mode
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        <div>
          <label style={labelStyle}>Tournament Name</label>
          <input
            type="text"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>URL Slug</label>
          <input
            type="text"
            value={slug}
            onChange={e => onSlugChange(e.target.value)}
            required
            style={inputStyle}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            Public routing: /{slug}
          </span>
        </div>

        <div>
          <label style={labelStyle}>Event Date</label>
          <input
            type="text"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            placeholder="e.g. March 21-22, 2026"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Location</label>
          <input
            type="text"
            value={location}
            onChange={e => onLocationChange(e.target.value)}
            placeholder="e.g. Kansas City, MO"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Seeding Method Selector */}
      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.85rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Seeding Method</label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onSeedingMethodChange('QUALIFIERS')}
              className={seedingMethod === 'QUALIFIERS' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.85rem',
                opacity: isLocked ? 0.6 : 1,
                cursor: isLocked ? 'not-allowed' : 'pointer',
              }}
              title={isLocked ? 'Cannot change seeding method during match play' : 'Qualifiers Leaderboard: Players submit scores, leaderboard determines seeds'}
            >
              🏆 Qualifiers Leaderboard
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onSeedingMethodChange('MANUAL')}
              className={seedingMethod === 'MANUAL' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.85rem',
                opacity: isLocked ? 0.6 : 1,
                cursor: isLocked ? 'not-allowed' : 'pointer',
              }}
              title={isLocked ? 'Cannot change seeding method during match play' : 'Direct / Manual Seeding: Enter players manually or paste a list, arrange seeds directly without quals'}
            >
              ✍️ Direct / Manual Seeding (No Quals)
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {seedingMethod === 'QUALIFIERS'
              ? 'Players submit scores during Qualifiers Mode; brackets dynamically populate according to leaderboard standings.'
              : 'Qualifiers are bypassed. Organize seeds manually, paste a pre-ranked list, or randomize draw order in the Seeding manager.'}
          </span>
        </div>
      </div>

      {/* Qualifying Format Controls (Only active in Qualifiers Mode) */}
      {seedingMethod === 'QUALIFIERS' ? (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Mode & Duration Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div>
              <label style={labelStyle}>Qualifying Mode</label>
              <select
                value={qualMode}
                onChange={e => onQualModeChange(e.target.value as QualMode)}
                style={inputStyle}
              >
                <option value="IN_PERSON">In-Person Live Event</option>
                <option value="HYBRID">Hybrid (In-Person &amp; Online)</option>
                <option value="ONLINE">100% Online Tournament</option>
              </select>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                {qualMode === 'IN_PERSON'
                  ? 'Official attempts played live on venue hardware.'
                  : qualMode === 'ONLINE'
                  ? 'Competitors submit runs online via Twitch VOD.'
                  : 'Allows both venue scorekeeping and online VOD submissions.'}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={labelStyle}>Qualifying Duration (Minutes)</label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onQualWindowMinutesChange(mins)}
                      style={{
                        padding: '0.1rem 0.4rem',
                        fontSize: '0.68rem',
                        fontWeight: qualWindowMinutes === mins ? 800 : 500,
                        background: qualWindowMinutes === mins ? 'var(--color-gold)' : 'var(--color-bg-surface-elevated)',
                        color: qualWindowMinutes === mins ? '#000000' : 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
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
                style={inputStyle}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Default start time for the countdown timer. Can be edited at any time.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', width: '100%' }}>
            {/* Format Selection Dropdown */}
            <div style={{ flex: '0 0 240px', minWidth: '200px' }}>
              <label style={labelStyle}>Qualifying Format</label>
              <select
                value={qualFormat}
                onChange={e => {
                  const newFmt = e.target.value as QualFormat;
                  onQualFormatChange(newFmt);
                  if (newFmt === 'POINTS' && (!pointsConfig || pointsConfig.length === 0)) {
                    onPointsConfigChange(DEFAULT_POINTS_THRESHOLDS);
                  }
                }}
                style={inputStyle}
              >
                <option value="HIGH_SCORE"># of Maxes</option>
                <option value="AVERAGE_OF_X">Average of X Attempts</option>
                <option value="POINTS">Points Threshold System</option>
              </select>
            </div>

            {/* Conditional format inline settings on the exact same row */}
            {qualFormat === 'HIGH_SCORE' && (
              <div style={{ flex: 1, minWidth: 0, marginTop: '1.45rem', display: 'flex', alignItems: 'center', height: '38px', color: 'var(--color-text-muted)', fontSize: '0.8rem', background: 'var(--color-bg-surface-elevated)', padding: '0 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                <span>Ranked by number of maxouts; kickers act as the tiebreaker.</span>
              </div>
            )}

            {qualFormat === 'AVERAGE_OF_X' && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div style={{ width: '150px', flexShrink: 0 }}>
                  <label style={labelStyle}>Attempts (X)</label>
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
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0, marginTop: '1.45rem', display: 'flex', alignItems: 'center', height: '38px', fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-surface-elevated)', padding: '0 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                  <span>Ranked by average of top {qualAverageCount || 'X'} qualifying attempts.</span>
                </div>
              </div>
            )}

            {qualFormat === 'POINTS' && (
              <div style={{ flex: 1, minWidth: 0, marginTop: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', height: '38px', background: 'var(--color-bg-surface-elevated)', padding: '0 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-gold-bright)', background: 'rgba(245, 158, 11, 0.15)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}>
                    {pointsConfig.length} {pointsConfig.length === 1 ? 'cutoff' : 'cutoffs'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pointsConfig.length > 0
                      ? [...pointsConfig].sort((a, b) => b.minScore - a.minScore).slice(0, 3).map(p => `${(p.minScore / 1000).toFixed(0)}k → +${p.points}`).join(', ') + (pointsConfig.length > 3 ? ', ...' : '')
                      : 'Attempts award points by highest cutoff reached.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenPointsDrawer}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.76rem', gap: '0.35rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <Sliders size={13} color="var(--color-gold-bright)" />
                  Configure Cutoffs
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.85rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            color: 'var(--color-text-secondary)',
            fontSize: '0.82rem',
          }}>
            <Sliders size={18} color="var(--color-brand)" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Direct Seeding Active: </strong>
              Qualifiers are bypassed. Brackets will be seeded directly from the custom rank order in the <strong>Seeding</strong> manager.
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
