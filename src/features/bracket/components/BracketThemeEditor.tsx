import React from 'react';
import { TierThemeColors, getTextScale, getAlternateShade } from '../colorUtils';
import { Palette, Type, RefreshCw } from 'lucide-react';
import { Button, cn } from '../../../components/ui';

interface BracketThemeEditorProps {
  themeColors: TierThemeColors;
  textSize?: 'compact' | 'normal' | 'large';
  bestOf?: number;
  label?: string;
  onThemeChange: (colors: TierThemeColors) => void;
  onTextSizeChange?: (textSize: 'compact' | 'normal' | 'large') => void;
  onReset?: () => void;
}

export const BracketThemeEditor: React.FC<BracketThemeEditorProps> = ({
  themeColors,
  textSize = 'normal',
  bestOf = 5,
  label,
  onThemeChange,
  onTextSizeChange,
  onReset,
}) => {
  const priColor = themeColors.primaryColor || '#ffc905';
  const secColor = themeColors.secondaryColor || '#705b33';
  const cardBg = themeColors.cardColor || '#1b1c1d';
  const txtColor = themeColors.textColor || '#94A3B8';
  const canvasBg = themeColors.backgroundColor || '#020203';
  const lowerColor = themeColors.lowerBracketColor || '#c2410c';

  const p1ZebraBg = getAlternateShade(cardBg, -0.06);

  // Dynamic preview text scaling calculations
  const previewTextScale = getTextScale(textSize);
  const previewShelfFontSize = `${(0.64 * previewTextScale).toFixed(3)}rem`;
  const previewSeedDim = Math.max(16, Math.round(18 * previewTextScale));
  const previewSeedFontSize = `${(0.68 * previewTextScale).toFixed(3)}rem`;
  const previewFlagFontSize = `${(0.9 * previewTextScale).toFixed(3)}rem`;
  const previewNameFontSize = `${(0.84 * previewTextScale).toFixed(3)}rem`;
  const previewScoreFontSize = `${(0.88 * previewTextScale).toFixed(3)}rem`;
  const previewScoreMinW = Math.max(18, Math.round(20 * previewTextScale));
  const previewScoreH = Math.max(18, Math.round(20 * previewTextScale));

  const handleColorChange = (field: keyof TierThemeColors, value: string) => {
    onThemeChange({
      ...themeColors,
      [field]: value,
    });
  };

  return (
    <div className="flex flex-col gap-5 rounded-md border border-line-subtle bg-elevated p-5">
      {label && (
        <div className="flex items-center justify-between border-b border-line-subtle pb-2">
          <div className="flex items-center gap-2">
            <Palette size={16} color={priColor} />
            <span className="text-sm font-bold text-fg">
              {label}
            </span>
          </div>
          {onReset && (
            <Button
              variant="secondary"
              onClick={onReset}
              className="gap-1.5 py-1 px-2.5 text-xs"
              title="Reset to default colors"
            >
              <RefreshCw size={11} />
              Reset Defaults
            </Button>
          )}
        </div>
      )}

      {/* 1. Color Picker Controls (Full Row) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
        {/* Primary Accent */}
        <div>
          <label className={colorLabelCls} title="Primary Accent (Lines, Rings & Winner Glory)">
            Primary Accent
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={priColor}
              onChange={e => handleColorChange('primaryColor', e.target.value)}
              className={colorInputCls}
            />
            <input
              type="text"
              value={priColor}
              onChange={e => handleColorChange('primaryColor', e.target.value)}
              className={hexTextInputCls}
              placeholder="#ffc905"
            />
          </div>
        </div>

        {/* Secondary Accent */}
        <div>
          <label className={colorLabelCls} title="Secondary Accent (Dividers & Winner Bg)">
            Secondary Accent
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={secColor}
              onChange={e => handleColorChange('secondaryColor', e.target.value)}
              className={colorInputCls}
            />
            <input
              type="text"
              value={secColor}
              onChange={e => handleColorChange('secondaryColor', e.target.value)}
              className={hexTextInputCls}
              placeholder="#705b33"
            />
          </div>
        </div>

        {/* Match Card Background */}
        <div>
          <label className={colorLabelCls} title="Match Card Background (Base)">
            Match Card Bg
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={cardBg}
              onChange={e => handleColorChange('cardColor', e.target.value)}
              className={colorInputCls}
            />
            <input
              type="text"
              value={cardBg}
              onChange={e => handleColorChange('cardColor', e.target.value)}
              className={hexTextInputCls}
              placeholder="#1b1c1d"
            />
          </div>
        </div>

        {/* Text Color */}
        <div>
          <label className={colorLabelCls} title="Text & Score Color">
            Text Color
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={txtColor}
              onChange={e => handleColorChange('textColor', e.target.value)}
              className={colorInputCls}
            />
            <input
              type="text"
              value={txtColor}
              onChange={e => handleColorChange('textColor', e.target.value)}
              className={hexTextInputCls}
              placeholder="#94A3B8"
            />
          </div>
        </div>

        {/* Canvas Background Color */}
        <div>
          <label className={colorLabelCls} title="Overall Bracket Canvas Background">
            Canvas Bg
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={canvasBg}
              onChange={e => handleColorChange('backgroundColor', e.target.value)}
              className={colorInputCls}
            />
            <input
              type="text"
              value={canvasBg}
              onChange={e => handleColorChange('backgroundColor', e.target.value)}
              className={hexTextInputCls}
              placeholder="#020203"
            />
          </div>
        </div>

        {/* Lower Bracket Accent Color */}
        <div>
          <label className={colorLabelCls} title="Lower Bracket Accent (Border highlights in Double Elimination)">
            Lower Bracket
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={lowerColor}
              onChange={e => handleColorChange('lowerBracketColor', e.target.value)}
              className={colorInputCls}
            />
            <input
              type="text"
              value={lowerColor}
              onChange={e => handleColorChange('lowerBracketColor', e.target.value)}
              className={hexTextInputCls}
              placeholder="#c2410c"
            />
          </div>
        </div>
      </div>

      {/* 2. Text Size Scaling Option */}
      {onTextSizeChange && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line-subtle bg-canvas py-2.5 px-3.5">
          <div className="flex items-center gap-2">
            <Type size={15} color={priColor} />
            <span className="text-caption font-bold text-fg">
              Bracket Match Text Size:
            </span>
          </div>

          <div className="flex gap-1.5">
            {(['compact', 'normal', 'large'] as const).map(opt => {
              const isSelected = (textSize || 'normal') === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onTextSizeChange(opt)}
                  className={cn(
                    'cursor-pointer rounded-xs border py-1 px-3 text-xs capitalize transition-all duration-100',
                    isSelected ? 'font-bold' : 'font-medium bg-white/5 text-fg-secondary border-line'
                  )}
                  style={isSelected ? { background: priColor, color: cardBg, borderColor: priColor } : undefined}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. The 3 Live Interactive Match Card Previews */}
      <div
        className="flex flex-col items-center gap-4 rounded-md border p-5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
        style={{ background: canvasBg, borderColor: `${secColor}44` }}
      >
        <span className="text-xs font-extrabold uppercase tracking-widest opacity-85" style={{ color: txtColor }}>
          Live Bracket Match Previews (Canvas Background: {canvasBg})
        </span>

        <div className="flex w-full flex-wrap justify-center gap-6">
          {/* State 1: Inactive / Pre-Game */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-2xs font-bold uppercase tracking-wide text-fg-muted">
              1. Inactive (Pre-Game)
            </span>
            <div
              className={cn(previewCardCls, 'border-[1.5px]')}
              style={{ background: cardBg, borderColor: secColor }}
            >
              <div className={previewHeaderCls} style={{ background: cardBg, fontSize: previewShelfFontSize, color: txtColor, borderBottomColor: secColor }}>
                <span>Match #1</span>
                <span>Bo{bestOf}</span>
              </div>
              <div className={previewRowCls} style={{ background: p1ZebraBg }}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={previewSeedCls} style={{ width: `${previewSeedDim}px`, height: `${previewSeedDim}px`, minWidth: `${previewSeedDim}px`, background: cardBg, borderColor: secColor, color: txtColor, fontSize: previewSeedFontSize }}>1</span>
                  <span className="shrink-0 leading-none" style={{ fontSize: previewFlagFontSize }}>🇺🇸</span>
                  <span className={cn('truncate', 'font-bold')} style={{ fontSize: previewNameFontSize, color: txtColor }}>Cheez</span>
                </div>
                <span className={cn(previewScoreCls, 'border-[1.5px]')} style={{ width: `${previewScoreMinW}px`, height: `${previewScoreH}px`, minWidth: `${previewScoreMinW}px`, background: cardBg, borderColor: secColor, color: txtColor, fontSize: previewScoreFontSize }}>-</span>
              </div>
              <div className="h-[1.5px] min-h-[1.5px]" style={{ background: secColor }} />
              <div className={previewRowCls} style={{ background: cardBg }}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={previewSeedCls} style={{ width: `${previewSeedDim}px`, height: `${previewSeedDim}px`, minWidth: `${previewSeedDim}px`, background: cardBg, borderColor: secColor, color: txtColor, fontSize: previewSeedFontSize }}>4</span>
                  <span className="shrink-0 leading-none" style={{ fontSize: previewFlagFontSize }}>🇨🇦</span>
                  <span className={cn('truncate', 'font-bold')} style={{ fontSize: previewNameFontSize, color: txtColor }}>Fractal</span>
                </div>
                <span className={cn(previewScoreCls, 'border-[1.5px]')} style={{ width: `${previewScoreMinW}px`, height: `${previewScoreH}px`, minWidth: `${previewScoreMinW}px`, background: cardBg, borderColor: secColor, color: txtColor, fontSize: previewScoreFontSize }}>-</span>
              </div>
            </div>
          </div>

          {/* State 2: Active Match */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-2xs font-bold uppercase tracking-wide" style={{ color: priColor }}>
              2. Active (Live Ring)
            </span>
            <div
              className={cn(previewCardCls, 'border-2')}
              style={{ background: cardBg, borderColor: priColor, boxShadow: `0 0 16px ${priColor}55` }}
            >
              <div className={previewHeaderCls} style={{ background: cardBg, fontSize: previewShelfFontSize, color: txtColor, borderBottomColor: secColor }}>
                <span>Match #1</span>
                <span>Bo{bestOf}</span>
              </div>
              <div className={previewRowCls} style={{ background: p1ZebraBg }}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={previewSeedCls} style={{ width: `${previewSeedDim}px`, height: `${previewSeedDim}px`, minWidth: `${previewSeedDim}px`, background: cardBg, borderColor: priColor, color: priColor, fontSize: previewSeedFontSize }}>1</span>
                  <span className="shrink-0 leading-none" style={{ fontSize: previewFlagFontSize }}>🇺🇸</span>
                  <span className={cn('truncate', 'font-black')} style={{ fontSize: previewNameFontSize, color: priColor }}>Cheez</span>
                </div>
                <span className={cn(previewScoreCls, 'border-0')} style={{ width: `${previewScoreMinW}px`, height: `${previewScoreH}px`, minWidth: `${previewScoreMinW}px`, background: priColor, color: cardBg, fontSize: previewScoreFontSize }}>2</span>
              </div>
              <div className="h-[1.5px] min-h-[1.5px]" style={{ background: secColor }} />
              <div className={previewRowCls} style={{ background: cardBg }}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={previewSeedCls} style={{ width: `${previewSeedDim}px`, height: `${previewSeedDim}px`, minWidth: `${previewSeedDim}px`, background: cardBg, borderColor: secColor, color: txtColor, fontSize: previewSeedFontSize }}>4</span>
                  <span className="shrink-0 leading-none" style={{ fontSize: previewFlagFontSize }}>🇨🇦</span>
                  <span className={cn('truncate', 'font-bold')} style={{ fontSize: previewNameFontSize, color: txtColor }}>Fractal</span>
                </div>
                <span className={cn(previewScoreCls, 'border-0 bg-transparent')} style={{ width: `${previewScoreMinW}px`, height: `${previewScoreH}px`, minWidth: `${previewScoreMinW}px`, color: txtColor, fontSize: previewScoreFontSize }}>1</span>
              </div>
            </div>
          </div>

          {/* State 3: Finished Match */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-2xs font-bold uppercase tracking-wide" style={{ color: priColor }}>
              3. Finished (Final Result)
            </span>
            <div
              className={cn(previewCardCls, 'border-2')}
              style={{ background: cardBg, borderColor: priColor, boxShadow: `0 0 16px ${priColor}55` }}
            >
              <div className={previewHeaderCls} style={{ background: cardBg, fontSize: previewShelfFontSize, color: txtColor, borderBottomColor: priColor }}>
                <span>Match #1</span>
                <span>Bo{bestOf}</span>
              </div>
              <div className={previewRowCls} style={{ background: secColor }}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={previewSeedCls} style={{ width: `${previewSeedDim}px`, height: `${previewSeedDim}px`, minWidth: `${previewSeedDim}px`, background: cardBg, borderColor: priColor, color: priColor, fontSize: previewSeedFontSize }}>1</span>
                  <span className="shrink-0 leading-none" style={{ fontSize: previewFlagFontSize }}>🇺🇸</span>
                  <span className={cn('truncate', 'font-black')} style={{ fontSize: previewNameFontSize, color: priColor }}>Cheez</span>
                </div>
                <span className={cn(previewScoreCls, 'border-0')} style={{ width: `${previewScoreMinW}px`, height: `${previewScoreH}px`, minWidth: `${previewScoreMinW}px`, background: priColor, color: cardBg, fontSize: previewScoreFontSize }}>3</span>
              </div>
              <div className="h-[1.5px] min-h-[1.5px]" style={{ background: priColor }} />
              <div className={previewRowCls} style={{ background: cardBg }}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={previewSeedCls} style={{ width: `${previewSeedDim}px`, height: `${previewSeedDim}px`, minWidth: `${previewSeedDim}px`, background: cardBg, borderColor: secColor, color: txtColor, fontSize: previewSeedFontSize }}>4</span>
                  <span className="shrink-0 leading-none" style={{ fontSize: previewFlagFontSize }}>🇨🇦</span>
                  <span className={cn('truncate', 'font-bold')} style={{ fontSize: previewNameFontSize, color: txtColor }}>Fractal</span>
                </div>
                <span className={cn(previewScoreCls, 'border-0 bg-transparent')} style={{ width: `${previewScoreMinW}px`, height: `${previewScoreH}px`, minWidth: `${previewScoreMinW}px`, color: txtColor, fontSize: previewScoreFontSize }}>1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const colorLabelCls = 'mb-1 block truncate text-xs font-semibold text-fg-secondary';

const colorInputCls = 'size-8.5 shrink-0 cursor-pointer rounded-xs border-0 bg-transparent';

const hexTextInputCls =
  'w-full min-w-0 flex-1 rounded-sm border border-line bg-canvas py-1.5 px-2 font-mono text-caption text-fg';

const previewCardCls = 'flex h-20 w-65 flex-col overflow-hidden rounded-sm';
const previewHeaderCls =
  'flex h-5 min-h-5 items-center justify-between border-b-[1.5px] px-2 font-medium leading-[20px]';
const previewRowCls = 'flex h-7 min-h-7 items-center justify-between px-2';
const previewSeedCls = 'flex items-center justify-center rounded-xs border-[1.5px] font-mono font-black';
const previewScoreCls = 'flex items-center justify-center rounded-xs font-black leading-none';
