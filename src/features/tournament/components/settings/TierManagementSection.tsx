import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Palette, ChevronDown } from 'lucide-react';
import { TournamentTier, BracketRouting } from '../../types';
import { getDefaultTierColors, colorWithAlpha } from '../../../bracket/colorUtils';
import { getValidFlatWidths, getDoubleEliminationConfigError } from '../../../bracket/math';
import { BestOfSelect } from '../../../bracket/components/BestOfSelect';
import { BracketThemeEditor } from '../../../bracket/components/BracketThemeEditor';
import { RoundOverridesEditor } from '../RoundOverridesEditor';
import { ClearableNumberInput } from '../../../../components/ClearableNumberInput';
import { labelClass, inputClass } from './types';
import { Button, cn } from '../../../../components/ui';

const tierLabelClass = cn(labelClass, 'mb-1.5 flex h-6.5 items-end');
const tierLabelTruncateClass = cn(tierLabelClass, 'truncate');

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
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface py-4.5 px-5.5">
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div>
          <h2 className="text-lg font-bold text-fg">
            Bracket Tiers
          </h2>
          <p className="text-caption text-fg-muted">
            Organize 1 to N tiered brackets (Gold, Silver, Bronze) with automatic cutoff ranges and customized themes.
          </p>
        </div>
      </div>

      {/* Tiers List */}
      <div className="flex flex-col gap-3.5">
        {tiers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-line bg-canvas py-10 px-4 text-center">
            <p className="text-base text-fg-secondary">
              No bracket tiers configured for this tournament.
            </p>
            <Button variant="primary" onClick={onAddTier}>
              <Plus size={16} /> Add First Bracket Tier
            </Button>
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
                className="flex flex-col gap-3.5 rounded-md py-4 px-4.5 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, var(--color-bg-surface-elevated) 0%, ${colorWithAlpha(priColor, 0.05)} 100%)`,
                  border: `1px solid ${colorWithAlpha(priColor, 0.28)}`,
                  borderLeft: `5px solid ${priColor}`,
                }}
              >
                {/* Header: Priority, Name, Swatch Pill, Cutoff Badge & Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{
                        background: priColor,
                        boxShadow: `0 0 10px ${colorWithAlpha(priColor, 0.65)}`,
                      }}
                    />
                    <span className="text-base font-extrabold" style={{ color: priColor }}>
                      {tier.name}
                    </span>
                    <span className="rounded-sm bg-highlight py-0.5 px-2 text-xs font-bold text-fg-secondary">
                      Priority #{tier.priority}
                    </span>

                    {/* Auto-derived cutoff badge */}
                    {badge && (
                      <span
                        className="rounded-full py-0.5 px-2.5 text-xs font-bold"
                        style={{
                          background: colorWithAlpha(priColor, 0.14),
                          border: `1px solid ${colorWithAlpha(priColor, 0.35)}`,
                          color: priColor,
                        }}
                      >
                        Cutoff: Ranks {badge.start} – {badge.end}
                      </span>
                    )}

                    {/* Header Theme Preview Swatches */}
                    <div
                      className="inline-flex items-center gap-1 rounded-full bg-canvas py-0.5 px-2"
                      style={{ border: `1px solid ${colorWithAlpha(priColor, 0.25)}` }}
                      title={`Theme: Primary (${priColor}), Secondary (${secColor}), Card (${cardBg}), Text (${txtColor})`}
                    >
                      <span className="size-2 rounded-full border border-black/40" style={{ background: priColor }} />
                      <span className="size-2 rounded-full border border-black/40" style={{ background: secColor }} />
                      <span className="size-2 rounded-full border border-white/20" style={{ background: cardBg }} />
                      <span className="size-2 rounded-full border border-black/40" style={{ background: txtColor }} />
                    </div>
                  </div>

                  {/* Move up / down / delete */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      onClick={() => onMoveTier(idx, 'up')}
                      disabled={idx === 0}
                      className="py-1 px-2"
                      title="Move tier up in priority"
                    >
                      <ArrowUp size={13} />
                    </Button>
                    <Button
                      onClick={() => onMoveTier(idx, 'down')}
                      disabled={idx === tiers.length - 1}
                      className="py-1 px-2"
                      title="Move tier down in priority"
                    >
                      <ArrowDown size={13} />
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => onRequestDeleteTier(idx, tier)}
                      className="py-1 px-2"
                      title="Delete bracket tier"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] items-end gap-2.5">
                  <div className="min-w-0">
                    <label className={tierLabelClass}>Tier Name</label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={e => onUpdateTier(idx, { name: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={tierLabelClass}>URL Slug</label>
                    <input
                      type="text"
                      value={tier.slug}
                      onChange={e => onUpdateTier(idx, { slug: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={tierLabelClass}>Elimination Style</label>
                    <select
                      value={tier.eliminationType || 'SINGLE'}
                      onChange={e => onUpdateTier(idx, { eliminationType: e.target.value as 'SINGLE' | 'DOUBLE' })}
                      className={inputClass}
                    >
                      <option value="SINGLE">Single Elimination</option>
                      <option value="DOUBLE">Double Elimination</option>
                    </select>
                  </div>

                  {tier.eliminationType === 'DOUBLE' ? (
                    <div className="min-w-0">
                      <label className={tierLabelClass}>Bracket Routing</label>
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
                        className={inputClass}
                      >
                        <option value="TRADITIONAL_TREE">Traditional Tree</option>
                        <option value="FLAT_STAGED">Flat Staged</option>
                        <option value="ACCELERATED_HYBRID">Accelerated Hybrid</option>
                      </select>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <label className={tierLabelClass}>Bracket Routing</label>
                      <select
                        value={tier.bracketType}
                        onChange={e => onUpdateTier(idx, { bracketType: e.target.value as 'TRADITIONAL' | 'FLAT' })}
                        className={inputClass}
                      >
                        <option value="TRADITIONAL">Traditional Bracket</option>
                        <option value="FLAT">Flat Bracket</option>
                      </select>
                    </div>
                  )}

                  {tier.eliminationType === 'DOUBLE' && tier.bracketRouting === 'FLAT_STAGED' && (
                    <div className="min-w-0">
                      <label className={tierLabelTruncateClass} title="Flat Width (Matches Per Round)">
                        Flat Width
                      </label>
                      <select
                        value={tier.flatWidth || 4}
                        onChange={e => onUpdateTier(idx, { flatWidth: parseInt(e.target.value, 10) })}
                        className={cn(inputClass, getDoubleEliminationConfigError(tier.playerCount, tier) && 'border-red')}
                      >
                        <option value={4}>4 Wide</option>
                        <option value={8}>8 Wide</option>
                      </select>
                      {getDoubleEliminationConfigError(tier.playerCount, tier) && (
                        <div className="mt-1 text-xs text-red">
                          {getDoubleEliminationConfigError(tier.playerCount, tier)}
                        </div>
                      )}
                    </div>
                  )}

                  {tier.eliminationType === 'DOUBLE' && tier.bracketRouting === 'ACCELERATED_HYBRID' && (
                    <div className="min-w-0">
                      <label className={tierLabelTruncateClass} title="Finals Cutoff">
                        Finals Cutoff
                      </label>
                      <select
                        value={tier.finalsCutoff || 16}
                        onChange={e => onUpdateTier(idx, { finalsCutoff: parseInt(e.target.value, 10) })}
                        className={inputClass}
                      >
                        <option value={8}>Top 8</option>
                        <option value={16}>Top 16</option>
                      </select>
                      {getDoubleEliminationConfigError(tier.playerCount, tier) && (
                        <div className="mt-1 text-xs text-red">
                          {getDoubleEliminationConfigError(tier.playerCount, tier)}
                        </div>
                      )}
                    </div>
                  )}

                  {tier.eliminationType !== 'DOUBLE' && tier.bracketType === 'FLAT' && (
                    <div className="min-w-0">
                      <label className={tierLabelTruncateClass} title="Flat Width (Matches Per Round)">
                        Flat Width (Per Round)
                      </label>
                      <select
                        value={tier.flatWidth || getValidFlatWidths(tier.playerCount)[0] || 2}
                        onChange={e => onUpdateTier(idx, { flatWidth: parseInt(e.target.value, 10) })}
                        className={inputClass}
                      >
                        {getValidFlatWidths(tier.playerCount).map(w => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="min-w-0">
                    <label className={tierLabelClass}>Participant Count</label>
                    <ClearableNumberInput
                      min={2}
                      max={64}
                      value={tier.playerCount}
                      onChange={val => onUpdateTier(idx, { playerCount: val ?? 2 })}
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={tierLabelClass}>Best-of Default</label>
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
                      className={cn(
                        'mt-3 overflow-hidden rounded-md border bg-surface transition-all duration-200',
                        !isThemeOpen && 'border-line-subtle'
                      )}
                      style={{ borderColor: isThemeOpen ? colorWithAlpha(priColor, 0.4) : undefined }}
                    >
                      {/* Accordion Header Toggle */}
                      <button
                        type="button"
                        onClick={() => onToggleThemeCollapse(tier.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center justify-between gap-3 border-0 py-2.5 px-4 text-left transition-colors duration-150 hover:bg-elevated',
                          isThemeOpen ? 'border-b bg-surface' : 'bg-elevated'
                        )}
                        style={{ borderBottomColor: isThemeOpen ? colorWithAlpha(priColor, 0.25) : undefined }}
                        aria-expanded={isThemeOpen}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Palette size={15} color={priColor} />
                            <span className="text-sm font-bold text-fg">
                              Bracket Theme &amp; Palette
                            </span>
                          </div>

                          {/* Palette Color Swatches Preview */}
                          <div
                            className="flex items-center gap-1.5 rounded-full border border-line-subtle bg-canvas py-0.5 px-2"
                            title={`Current theme: Primary (${priColor}), Secondary (${secColor}), Card (${cardBg}), Text (${txtColor}), Canvas (${canvasBg}), Lower Bracket (${lowerColor})`}
                          >
                            <span className="size-2.25 shrink-0 rounded-full border border-black/30" style={{ background: priColor }} />
                            <span className="size-2.25 shrink-0 rounded-full border border-black/30" style={{ background: secColor }} />
                            <span className="size-2.25 shrink-0 rounded-full border border-white/15" style={{ background: cardBg }} />
                            <span className="size-2.25 shrink-0 rounded-full border border-black/30" style={{ background: txtColor }} />
                            <span className="size-2.25 shrink-0 rounded-full border border-white/15" style={{ background: canvasBg }} />
                            <span className="size-2.25 shrink-0 rounded-full border border-black/30" style={{ background: lowerColor }} />
                            <span className="ml-1 font-mono text-2xs text-fg-muted">
                              {tier.textSize ? `${tier.textSize}` : 'normal'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-fg-muted">
                            {isThemeOpen ? 'Click to collapse' : 'Click to customize colors & text size'}
                          </span>
                          <ChevronDown
                            size={16}
                            color="var(--color-text-muted)"
                            className={cn('transition-transform duration-200', isThemeOpen ? 'rotate-180' : 'rotate-0')}
                          />
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isThemeOpen && (
                        <div className="flex animate-fade-in flex-col gap-5 p-5">
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
          <div className="flex justify-start pt-1">
            <Button variant="primary" onClick={onAddTier} className="gap-2 py-2 px-4.5 text-sm">
              <Plus size={16} /> Add Tier
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
