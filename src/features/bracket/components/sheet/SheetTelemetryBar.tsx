import React from 'react';
import { Filter, Check, ChevronDown, Clock, CheckCircle2, Search, Trophy } from 'lucide-react';
import { colorWithAlpha, getAlternateShade, getContrastingTextColor } from '../../colorUtils';
import { SheetDensitySize } from '../../sheetUtils';
import { Button, cn } from '../../../../components/ui';

const dropdownItemClass =
  'flex items-center gap-2 py-1.5 px-2.5 rounded-sm border-0 bg-transparent text-fg text-caption cursor-pointer text-left w-full';
const dropdownHeadingClass = 'text-2xs font-bold text-fg-muted uppercase tracking-wider pt-1 px-2.5 pb-0.5';

interface SheetTelemetryBarProps {
  tournamentName: string;
  tierName: string;
  primaryColor: string;
  secondaryColor: string;
  cardColor: string;
  searchTerm: string;
  onSearchTermChange: (val: string) => void;
  selectedRoundFilter: 'ALL' | 'IN_PROGRESS' | 'COMPLETE' | string[];
  isFilterDropdownOpen: boolean;
  onToggleFilterDropdown: () => void;
  onSelectFilterPreset: (preset: 'ALL' | 'IN_PROGRESS' | 'COMPLETE') => void;
  onToggleRoundFilter: (roundName: string) => void;
  roundNames: string[];
  telemetry: { total: number; completed: number; inProgress: number };
  sheetSize: SheetDensitySize;
  onSizeChange: (newSize: SheetDensitySize) => void;
}

export const SheetTelemetryBar: React.FC<SheetTelemetryBarProps> = ({
  tournamentName,
  tierName,
  primaryColor,
  secondaryColor,
  cardColor,
  searchTerm,
  onSearchTermChange,
  selectedRoundFilter,
  isFilterDropdownOpen,
  onToggleFilterDropdown,
  onSelectFilterPreset,
  onToggleRoundFilter,
  roundNames,
  telemetry,
  sheetSize,
  onSizeChange,
}) => {
  return (
    <>
      {/* Tournament Name & Bracket Header - Left-aligned with the table */}
      <div className="w-full flex flex-col items-start mb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-caption font-bold text-gold-bright uppercase tracking-widest">
            Master Organizer Sheet
          </span>
          <span className="text-fg-muted text-xs">•</span>
          <span
            className="text-caption font-bold uppercase tracking-wide"
            style={{ color: primaryColor || 'var(--color-gold-bright)' }}
          >
            {tierName}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5 tracking-tight m-0 leading-tight">
          <Trophy color="var(--color-gold-bright)" size={28} />
          {tournamentName}
        </h1>
      </div>

      {/* Top Filter & Telemetry Bar */}
      <div
        className="flex justify-between items-center py-2 px-3.5 rounded-md w-full flex-wrap gap-3"
        style={{
          border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-border)')}`,
          background: cardColor,
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Competitor / Match # Quick Search */}
          <div className="relative w-43.75">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              placeholder="Search competitor or #..."
              value={searchTerm}
              onChange={e => onSearchTermChange(e.target.value)}
              className="w-full py-1.5 pr-2 pl-7 text-caption rounded-sm bg-canvas text-fg"
              style={{ border: `1px solid ${colorWithAlpha(secondaryColor, 0.5, 'var(--color-border)')}` }}
            />
          </div>

          {/* Multi-Select Round Filter Dropdown */}
          <div className="relative">
            <Button
              variant="secondary"
              onClick={onToggleFilterDropdown}
              className="py-1.5 px-3 text-caption rounded-sm bg-canvas enabled:hover:bg-canvas text-fg gap-1.5"
              style={{ border: `1px solid ${colorWithAlpha(secondaryColor, 0.5, 'var(--color-border)')}` }}
            >
              <Filter size={13} color={primaryColor} />
              <span>
                Round:{' '}
                <strong style={{ color: primaryColor }}>
                  {selectedRoundFilter === 'ALL'
                    ? 'All'
                    : selectedRoundFilter === 'IN_PROGRESS'
                    ? 'Live Only'
                    : selectedRoundFilter === 'COMPLETE'
                    ? 'Complete Only'
                    : `${selectedRoundFilter.length} Selected`}
                </strong>
              </span>
              <ChevronDown size={13} />
            </Button>

            {isFilterDropdownOpen && (
              <div
                className="absolute top-[calc(100%+4px)] left-0 z-50 min-w-50 max-h-80 overflow-y-auto rounded-md shadow-[0_10px_25px_rgba(0,0,0,0.5)] p-1.5 flex flex-col gap-0.5"
                style={{
                  background: getAlternateShade(cardColor, 8),
                  border: `1px solid ${colorWithAlpha(secondaryColor, 0.6, 'var(--color-border)')}`,
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className={dropdownHeadingClass}>
                  Filter Presets
                </div>
                <button
                  className={dropdownItemClass}
                  onClick={() => onSelectFilterPreset('ALL')}
                >
                  <span className="w-4">{selectedRoundFilter === 'ALL' && <Check size={13} color={primaryColor} />}</span>
                  <span>All Rounds</span>
                </button>
                <button
                  className={dropdownItemClass}
                  onClick={() => onSelectFilterPreset('IN_PROGRESS')}
                >
                  <span className="w-4">{selectedRoundFilter === 'IN_PROGRESS' && <Check size={13} color={primaryColor} />}</span>
                  <span>In Progress Only</span>
                </button>
                <button
                  className={dropdownItemClass}
                  onClick={() => onSelectFilterPreset('COMPLETE')}
                >
                  <span className="w-4">{selectedRoundFilter === 'COMPLETE' && <Check size={13} color={primaryColor} />}</span>
                  <span>Completed Only</span>
                </button>

                <div className={cn(dropdownHeadingClass, 'mt-1.5')}>
                  Individual Rounds
                </div>
                {roundNames.map(rName => {
                  const isChecked = Array.isArray(selectedRoundFilter) && selectedRoundFilter.includes(rName);
                  return (
                    <button
                      key={rName}
                      className={dropdownItemClass}
                      onClick={() => onToggleRoundFilter(rName)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="cursor-pointer"
                        style={{ accentColor: primaryColor }}
                      />
                      <span>{rName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Telemetry Stats Pills */}
          <div className="flex items-center gap-2.5 text-caption">
            <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-full bg-green-500/10 border border-green-500/25 text-green-400">
              <CheckCircle2 size={13} />
              <span className="text-fg-secondary">Matches:</span>
              <strong className="font-mono tabular-nums tracking-tight text-white">
                {telemetry.completed} / {telemetry.total}
              </strong>
            </span>

            {telemetry.inProgress > 0 && (
              <span
                className="inline-flex items-center gap-1.5 py-1 px-2 rounded-full"
                style={{
                  background: colorWithAlpha(primaryColor, 0.14, 'rgba(245, 158, 11, 0.1)'),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'rgba(245, 158, 11, 0.3)')}`,
                  color: primaryColor,
                }}
              >
                <Clock size={13} />
                <span>Live:</span>
                <strong className="font-mono tabular-nums tracking-tight">{telemetry.inProgress} active</strong>
              </span>
            )}
          </div>
        </div>

        {/* Size Density Toggle (XS / S / M / L) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
            Size:
          </span>
          <div
            className="inline-flex p-0.5 rounded-sm bg-canvas gap-0.5"
            style={{ border: `1px solid ${colorWithAlpha(secondaryColor, 0.5, 'var(--color-border)')}` }}
          >
            {(['xs', 'sm', 'md', 'lg'] as const).map(s => {
              const isCurrent = sheetSize === s;
              const label = s === 'xs' ? 'XS' : s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L';
              const title = s === 'xs' ? 'Extra Small' : s === 'sm' ? 'Small (Default)' : s === 'md' ? 'Medium' : 'Large';
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSizeChange(s)}
                  title={`View size: ${title}`}
                  className={cn(
                    'py-1 px-2 rounded-2xs border-0 text-xs transition-all duration-100',
                    isCurrent ? 'font-extrabold cursor-default' : 'font-semibold cursor-pointer bg-transparent text-fg-secondary'
                  )}
                  style={isCurrent ? { background: primaryColor, color: getContrastingTextColor(primaryColor) } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};
