import React from 'react';
import { Palette, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import { OrgTierTheme } from '../../tournament/types';
import { TierThemeColors } from '../../bracket/colorUtils';
import { BracketThemeEditor } from '../../bracket/components/BracketThemeEditor';

interface OrgBrandingTabProps {
  orgName: string;
  primaryTheme: TierThemeColors;
  primaryTextSize: 'compact' | 'normal' | 'large';
  tierThemes: OrgTierTheme[];
  onPrimaryThemeChange: (theme: TierThemeColors) => void;
  onPrimaryTextSizeChange: (size: 'compact' | 'normal' | 'large') => void;
  onAddTierTheme: () => void;
  onUpdateTierTheme: (index: number, updates: Partial<OrgTierTheme>) => void;
  onRemoveTierTheme: (index: number) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const OrgBrandingTab: React.FC<OrgBrandingTabProps> = ({
  orgName,
  primaryTheme,
  primaryTextSize,
  tierThemes,
  onPrimaryThemeChange,
  onPrimaryTextSizeChange,
  onAddTierTheme,
  onUpdateTierTheme,
  onRemoveTierTheme,
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <div className="flex items-center gap-3 rounded-md border border-tier-gold/20 bg-tier-gold/5 px-5 py-4">
        <Palette size={20} color="var(--color-gold-bright)" />
        <p className="m-0 text-sm leading-snug text-fg-secondary">
          <strong>Circuit Palette Hierarchy:</strong> The primary branding defines the championship bracket theme for tournaments hosted by <strong>{orgName}</strong>. Tournaments inherit these colors automatically, and you can define secondary/tertiary tier themes below.
        </p>
      </div>

      {/* Primary Championship Theme */}
      <div className="rounded-lg border border-line bg-surface p-6">
        <div className="mb-5">
          <h3 className="m-0 mb-1 text-lg font-extrabold text-white">
            Primary Theme Colors
          </h3>
          <p className="m-0 text-caption text-fg-muted">
            Default 5-color architecture for premier Gold championship brackets across all circuit events.
          </p>
        </div>

        <BracketThemeEditor
          themeColors={primaryTheme}
          textSize={primaryTextSize}
          label="Primary Gold Bracket"
          onThemeChange={onPrimaryThemeChange}
          onTextSizeChange={onPrimaryTextSizeChange}
          onReset={() => {
            onPrimaryThemeChange({
              primaryColor: '#ffc905',
              secondaryColor: '#705b33',
              cardColor: '#1b1c1d',
              textColor: '#94A3B8',
              backgroundColor: '#020203',
            });
          }}
        />
      </div>

      {/* Additional Tier Themes */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="m-0 mb-1 text-lg font-extrabold text-white">
              Additional Tier Themes ({tierThemes.length})
            </h3>
            <p className="m-0 text-caption text-fg-muted">
              Define secondary or tertiary bracket themes (e.g. Silver Bracket, Bronze Bracket) that tournaments can apply in one click.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={onAddTierTheme}
          >
            <Plus size={15} />
            <span>Add Tier Theme</span>
          </Button>
        </div>

        {tierThemes.map((tierTheme, idx) => (
          <div
            key={tierTheme.id}
            className="relative rounded-lg border border-line bg-surface p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={tierTheme.name}
                  onChange={e => onUpdateTierTheme(idx, { name: e.target.value })}
                  className="rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-base font-bold text-white"
                />
                <span className="text-xs text-fg-muted">
                  Tier #{idx + 2} in tournament lineup
                </span>
              </div>

              <Button
                type="button"
                variant="danger"
                onClick={() => onRemoveTierTheme(idx)}
                className="px-3 py-1.5 text-caption"
              >
                <Trash2 size={13} />
                <span>Remove Theme</span>
              </Button>
            </div>

            <BracketThemeEditor
              themeColors={tierTheme.themeColors}
              textSize={tierTheme.textSize || 'normal'}
              label={tierTheme.name}
              onThemeChange={colors => onUpdateTierTheme(idx, { themeColors: colors })}
              onTextSizeChange={size => onUpdateTierTheme(idx, { textSize: size })}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          variant="primary"
          className="px-7 py-2.5 text-base"
          style={{ boxShadow: `0 2px 12px ${primaryTheme.primaryColor || 'var(--color-tier-gold)'}55` }}
        >
          Save Branding &amp; Palettes
        </Button>
      </div>
    </form>
  );
};
