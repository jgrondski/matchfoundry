import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Palette, ChevronDown } from 'lucide-react';
import { TournamentTier, BracketRouting } from '../../types';
import { getDefaultTierColors, colorWithAlpha } from '../../../bracket/colorUtils';
import { getValidFlatWidths, getDoubleEliminationConfigError } from '../../../bracket/math';
import { BestOfSelect } from '../../../bracket/components/BestOfSelect';
import { BracketThemeEditor } from '../../../bracket/components/BracketThemeEditor';
import { RoundOverridesEditor } from '../RoundOverridesEditor';
import { ClearableNumberInput } from '../../../../components/ClearableNumberInput';
import { labelStyle, inputStyle } from './types';

interface TierManagementSectionProps {
  tiers: TournamentTier[];
  openThemes: Record<string, boolean>;
  tierThresholdBadges: Array<{ start: number; end: number }>;
  onToggleThemeCollapse: (tierId: string) => void;
  onAddTier: () => void;
  onUpdateTier: (index: number, updates: Partial<TournamentTier>) => void;
  onMoveTier: (index: number, direction: 'up' | 'down') => void;
  onRequestDeleteTier: (index: number, tier: TournamentTier) => void;
}

export const TierManagementSection: React.FC<TierManagementSectionProps> = ({
  tiers,
  openThemes,
  tierThresholdBadges,
  onToggleThemeCollapse,
  onAddTier,
  onUpdateTier,
  onMoveTier,
  onRequestDeleteTier,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.65rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Bracket Tiers
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            Organize 1 to N tiered brackets (Gold, Silver, Bronze) with automatic cutoff ranges and customized themes.
          </p>
        </div>
      </div>

      {/* Tiers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {tiers.length === 0 ? (
          <div
            style={{
              padding: '2.5rem 1rem',
              background: 'var(--color-bg-base)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-border)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <p style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>
              No bracket tiers configured for this tournament.
            </p>
            <button
              type="button"
              onClick={onAddTier}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} /> Add First Bracket Tier
            </button>
          </div>
        ) : (
          tiers.map((tier, idx) => {
            const badge = tierThresholdBadges[idx];
            const defaults = getDefaultTierColors(tier);
            const priColor = tier.primaryColor || defaults.primaryColor || '#ffc905';
            const secColor = tier.secondaryColor || defaults.secondaryColor || '#705b33';
            const cardBg = tier.cardColor || defaults.cardColor || '#1b1c1d';
            const txtColor = tier.textColor || defaults.textColor || '#94A3B8';

            return (
              <div
                key={tier.id}
                style={{
                  background: `linear-gradient(135deg, var(--color-bg-surface-elevated) 0%, ${colorWithAlpha(priColor, 0.05)} 100%)`,
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${colorWithAlpha(priColor, 0.28)}`,
                  borderLeft: `5px solid ${priColor}`,
                  padding: '0.95rem 1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header: Priority, Name, Swatch Pill, Cutoff Badge & Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: priColor,
                        boxShadow: `0 0 10px ${colorWithAlpha(priColor, 0.65)}`,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.98rem',
                        color: priColor,
                      }}
                    >
                      {tier.name}
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-surface-highlight)',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      Priority #{tier.priority}
                    </span>

                    {/* Auto-derived cutoff badge */}
                    {badge && (
                      <span
                        style={{
                          padding: '0.18rem 0.6rem',
                          borderRadius: 'var(--radius-full)',
                          background: colorWithAlpha(priColor, 0.14),
                          border: `1px solid ${colorWithAlpha(priColor, 0.35)}`,
                          color: priColor,
                          fontWeight: 700,
                          fontSize: '0.74rem',
                        }}
                      >
                        Cutoff: Ranks {badge.start} – {badge.end}
                      </span>
                    )}

                    {/* Header Theme Preview Swatches */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.15rem 0.45rem',
                        background: 'var(--color-bg-base)',
                        borderRadius: 'var(--radius-full)',
                        border: `1px solid ${colorWithAlpha(priColor, 0.25)}`,
                      }}
                      title={`Theme: Primary (${priColor}), Secondary (${secColor}), Card (${cardBg}), Text (${txtColor})`}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: priColor, border: '1px solid rgba(0,0,0,0.4)' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: secColor, border: '1px solid rgba(0,0,0,0.4)' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cardBg, border: '1px solid rgba(255,255,255,0.2)' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: txtColor, border: '1px solid rgba(0,0,0,0.4)' }} />
                    </div>
                  </div>

                  {/* Move up / down / delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => onMoveTier(idx, 'up')}
                      disabled={idx === 0}
                      className="btn btn-secondary"
                      style={{ padding: '0.22rem 0.45rem', opacity: idx === 0 ? 0.3 : 1 }}
                      title="Move tier up in priority"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveTier(idx, 'down')}
                      disabled={idx === tiers.length - 1}
                      className="btn btn-secondary"
                      style={{ padding: '0.22rem 0.45rem', opacity: idx === tiers.length - 1 ? 0.3 : 1 }}
                      title="Move tier down in priority"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDeleteTier(idx, tier)}
                      className="btn btn-danger"
                      style={{ padding: '0.22rem 0.45rem' }}
                      title="Delete bracket tier"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Form Fields Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', alignItems: 'end' }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ ...labelStyle, height: '1.6rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Tier Name</label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={e => onUpdateTier(idx, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ ...labelStyle, height: '1.6rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>URL Slug</label>
                    <input
                      type="text"
                      value={tier.slug}
                      onChange={e => onUpdateTier(idx, { slug: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ ...labelStyle, height: '1.6rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Elimination Style</label>
                    <select
                      value={tier.eliminationType || 'SINGLE'}
                      onChange={e => onUpdateTier(idx, { eliminationType: e.target.value as 'SINGLE' | 'DOUBLE' })}
                      style={inputStyle}
                    >
                      <option value="SINGLE">Single Elimination</option>
                      <option value="DOUBLE">Double Elimination</option>
                    </select>
                  </div>

                  {tier.eliminationType === 'DOUBLE' ? (
                    <div style={{ minWidth: 0 }}>
                      <label style={{ ...labelStyle, height: '1.6rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Bracket Routing</label>
                      <select
                        value={tier.bracketRouting || 'TRADITIONAL_TREE'}
                        onChange={e => {
                          const routing = e.target.value as BracketRouting;
                          onUpdateTier(idx, {
                            bracketRouting: routing,
                            flatWidth: routing === 'FLAT_STAGED' ? (tier.flatWidth || 4) : undefined,
                            finalsCutoff: routing === 'ACCELERATED_HYBRID' ? (tier.finalsCutoff || 16) : undefined,
                          });
                        }}
                        style={inputStyle}
                      >
                        <option value="TRADITIONAL_TREE">Traditional Tree</option>
                        <option value="FLAT_STAGED">Flat Staged</option>
                        <option value="ACCELERATED_HYBRID">Accelerated Hybrid</option>
                      </select>
                    </div>
                  ) : (
                    <div style={{ minWidth: 0 }}>
                      <label style={{ ...labelStyle, height: '1.6rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Bracket Routing</label>
                      <select
                        value={tier.bracketType}
                        onChange={e => onUpdateTier(idx, { bracketType: e.target.value as 'TRADITIONAL' | 'FLAT' })}
                        style={inputStyle}
                      >
                        <option value="TRADITIONAL">Traditional Bracket</option>
                        <option value="FLAT">Flat Bracket</option>
                      </select>
                    </div>
                  )}

                  {tier.eliminationType === 'DOUBLE' && tier.bracketRouting === 'FLAT_STAGED' && (
                    <div style={{ minWidth: 0 }}>
                      <label
                        style={{
                          ...labelStyle,
                          height: '1.6rem',
                          display: 'flex',
                          alignItems: 'flex-end',
                          marginBottom: '0.35rem',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}
                        title="Flat Width (Matches Per Round)"
                      >
                        Flat Width
                      </label>
                      <select
                        value={tier.flatWidth || 4}
                        onChange={e => onUpdateTier(idx, { flatWidth: parseInt(e.target.value, 10) })}
                        style={{
                          ...inputStyle,
                          borderColor: getDoubleEliminationConfigError(tier.playerCount, tier) ? '#ef4444' : undefined,
                        }}
                      >
                        <option value={4}>4 Wide</option>
                        <option value={8}>8 Wide</option>
                      </select>
                      {getDoubleEliminationConfigError(tier.playerCount, tier) && (
                        <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem' }}>
                          {getDoubleEliminationConfigError(tier.playerCount, tier)}
                        </div>
                      )}
                    </div>
                  )}

                  {tier.eliminationType === 'DOUBLE' && tier.bracketRouting === 'ACCELERATED_HYBRID' && (
                    <div style={{ minWidth: 0 }}>
                      <label
                        style={{
                          ...labelStyle,
                          height: '1.6rem',
                          display: 'flex',
                          alignItems: 'flex-end',
                          marginBottom: '0.35rem',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}
                        title="Finals Cutoff"
                      >
                        Finals Cutoff
                      </label>
                      <select
                        value={tier.finalsCutoff || 16}
                        onChange={e => onUpdateTier(idx, { finalsCutoff: parseInt(e.target.value, 10) })}
                        style={inputStyle}
                      >
                        <option value={8}>Top 8</option>
                        <option value={16}>Top 16</option>
                      </select>
                      {getDoubleEliminationConfigError(tier.playerCount, tier) && (
                        <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem' }}>
                          {getDoubleEliminationConfigError(tier.playerCount, tier)}
                        </div>
                      )}
                    </div>
                  )}

                  {tier.eliminationType !== 'DOUBLE' && tier.bracketType === 'FLAT' && (
                    <div style={{ minWidth: 0 }}>
                      <label
                        style={{
                          ...labelStyle,
                          height: '1.6rem',
                          display: 'flex',
                          alignItems: 'flex-end',
                          marginBottom: '0.35rem',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}
                        title="Flat Width (Matches Per Round)"
                      >
                        Flat Width (Per Round)
                      </label>
                      <select
                        value={tier.flatWidth || getValidFlatWidths(tier.playerCount)[0] || 2}
                        onChange={e => onUpdateTier(idx, { flatWidth: parseInt(e.target.value, 10) })}
                        style={inputStyle}
                      >
                        {getValidFlatWidths(tier.playerCount).map(w => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <label style={{ ...labelStyle, height: '1.6rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Participant Count</label>
                    <ClearableNumberInput
                      min={2}
                      max={64}
                      value={tier.playerCount}
                      onChange={val => onUpdateTier(idx, { playerCount: val ?? 2 })}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ ...labelStyle, height: '1.6rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Best-of Default</label>
                    <BestOfSelect
                      value={tier.bestOf}
                      onChange={val => onUpdateTier(idx, { bestOf: val })}
                    />
                  </div>
                </div>

                {/* Round-Specific Best-of Overrides */}
                <RoundOverridesEditor
                  tier={tier}
                  onChange={newOverrides => onUpdateTier(idx, { roundBestOfOverrides: newOverrides })}
                  inputStyle={inputStyle}
                />

                {/* Bracket Palette & Theming Accordion */}
                {(() => {
                  const defaults = getDefaultTierColors(tier);
                  const priColor = tier.primaryColor || defaults.primaryColor;
                  const secColor = tier.secondaryColor || defaults.secondaryColor;
                  const cardBg = tier.cardColor || defaults.cardColor;
                  const txtColor = tier.textColor || defaults.textColor;
                  const canvasBg = tier.backgroundColor || defaults.backgroundColor;
                  const lowerColor = tier.lowerBracketColor || defaults.lowerBracketColor || '#c2410c';
                  const isThemeOpen = Boolean(openThemes[tier.id]);

                  return (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-surface)',
                        border: `1px solid ${isThemeOpen ? colorWithAlpha(priColor, 0.4) : 'var(--color-border-subtle)'}`,
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Accordion Header Toggle */}
                      <button
                        type="button"
                        onClick={() => onToggleThemeCollapse(tier.id)}
                        style={{
                          width: '100%',
                          padding: '0.65rem 1rem',
                          background: isThemeOpen ? 'var(--color-bg-surface)' : 'var(--color-bg-surface-elevated)',
                          border: 'none',
                          borderBottom: isThemeOpen ? `1px solid ${colorWithAlpha(priColor, 0.25)}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          textAlign: 'left',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = isThemeOpen ? 'var(--color-bg-surface)' : 'var(--color-bg-surface-elevated)';
                        }}
                        aria-expanded={isThemeOpen}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Palette size={15} color={priColor} />
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                              Bracket Theme &amp; Palette
                            </span>
                          </div>

                          {/* Palette Color Swatches Preview */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.15rem 0.5rem',
                              background: 'var(--color-bg-base)',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--color-border-subtle)',
                            }}
                            title={`Current theme: Primary (${priColor}), Secondary (${secColor}), Card (${cardBg}), Text (${txtColor}), Canvas (${canvasBg}), Lower Bracket (${lowerColor})`}
                          >
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: priColor, border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0 }} />
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: secColor, border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0 }} />
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: cardBg, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: txtColor, border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0 }} />
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: canvasBg, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: lowerColor, border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                              {tier.textSize ? `${tier.textSize}` : 'normal'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {isThemeOpen ? 'Click to collapse' : 'Click to customize colors & text size'}
                          </span>
                          <ChevronDown
                            size={16}
                            color="var(--color-text-muted)"
                            style={{
                              transform: isThemeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                            }}
                          />
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isThemeOpen && (
                        <div
                          style={{
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem',
                            animation: 'fadeIn 0.15s ease-out',
                          }}
                        >
                          <BracketThemeEditor
                            themeColors={{
                              primaryColor: priColor,
                              secondaryColor: secColor,
                              cardColor: cardBg,
                              textColor: txtColor,
                              backgroundColor: canvasBg,
                              lowerBracketColor: lowerColor,
                            }}
                            textSize={
                              tier.textSize === 'compact' || tier.textSize === 'small'
                                ? 'compact'
                                : tier.textSize === 'large' || tier.textSize === 'xlarge'
                                ? 'large'
                                : 'normal'
                            }
                            bestOf={tier.bestOf || 5}
                            onThemeChange={colors => {
                              onUpdateTier(idx, {
                                primaryColor: colors.primaryColor,
                                secondaryColor: colors.secondaryColor,
                                cardColor: colors.cardColor,
                                textColor: colors.textColor,
                                backgroundColor: colors.backgroundColor,
                                lowerBracketColor: colors.lowerBracketColor,
                              });
                            }}
                            onTextSizeChange={size => {
                              onUpdateTier(idx, { textSize: size });
                            }}
                            onReset={() => {
                              const def = getDefaultTierColors({ id: tier.id, slug: tier.slug, priority: tier.priority || (idx + 1) });
                              onUpdateTier(idx, {
                                primaryColor: def.primaryColor,
                                secondaryColor: def.secondaryColor,
                                cardColor: def.cardColor,
                                textColor: def.textColor,
                                backgroundColor: def.backgroundColor,
                                lowerBracketColor: def.lowerBracketColor,
                                textSize: 'normal',
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}

        {tiers.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '0.25rem' }}>
            <button
              type="button"
              onClick={onAddTier}
              className="btn btn-primary"
              style={{
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Plus size={16} /> Add Tier
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
