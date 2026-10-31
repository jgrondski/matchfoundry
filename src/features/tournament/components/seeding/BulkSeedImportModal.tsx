import React, { useState, useMemo, useId } from 'react';
import { X, Upload, CheckCircle2, UserPlus, Globe, AlertCircle, Layers, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { Tournament, PlayerProfile } from '../../types';
import { useTournament } from '../../store';
import { COUNTRIES } from '../../../players/flagUtils';
import { Overlay } from '../../../../components/overlay';
import { Button, IconButton, cn } from '../../../../components/ui';

const ISO_COUNTRY_CODES = new Set([
  ...COUNTRIES.map(c => c.code.toUpperCase()),
  'USA', 'CAN', 'JPN', 'KOR', 'GER', 'FRA', 'AUS', 'BRA', 'FIN', 'SWE', 'POL', 'GBR',
]);

const TABLE_KEYWORDS = new Set([
  'rank', 'seed', 'seeds', '#', 'no', 'num', 'number',
  'player', 'players', 'competitor', 'competitors', 'participant', 'participants',
  'name', 'names',
  'country', 'flag', 'nation', 'region',
  'playstyle', 'style', 'grip',
  'pb', 'personal best', 'score', 'scores', 'points', 'pts', 'max', 'attempts', 'avg', 'average',
  'actions', 'action', 'remove', 'delete', 'edit', 'view', 'details', 'status',
  'verified', 'unverified', 'pending', 'qualified', 'dnq', 'disqualified',
  '—', '-', '–', 'n/a', 'none', 'null', 'undefined'
]);

const PLAYSTYLES = new Set(['das', 'rolling', 'hybrid', 'tapper']);

function isPureNumberOrScore(text: string): boolean {
  const trimmed = text.trim();
  // Pure integer or rank
  if (/^#?\d+[\s.)\-:]*$/.test(trimmed)) return true;
  // Numbers with commas/decimals and optional score units: 982,561, 1,334,643, 1.2M, 850k, 100pts
  if (/^[\d,._]+(?:\s*(?:pts?|points?|k|m|mil|million))?$/i.test(trimmed)) return true;
  // Numbers with trailing actions like "982,561\tRemove" or "982,561 Remove"
  if (/^[\d,._\s]+(?:pts?|points?|k|m)?[\s\t\-|/]+(?:remove|delete|edit|view|details|status)$/i.test(trimmed)) return true;
  return false;
}

function cleanCandidateToken(token: string): string | null {
  let cleaned = token.trim();
  if (!cleaned) return null;

  // Remove surrounding quotes if any
  cleaned = cleaned.replace(/^["'](.*)["']$/, '$1').trim();

  // Strip leading list prefixes like "1. ", "1) ", "#1 ", "- ", "* ", "• "
  cleaned = cleaned.replace(/^\s*(?:#?\d+[\s.)\-:]+|\*|\-|•)\s*/, '').trim();

  // Strip trailing metadata iteratively (trailing scores, trailing country tags)
  let changed = true;
  while (changed) {
    const prev = cleaned;
    // Strip trailing scores like "- 982,561", "| 1.2M", ": 850k"
    cleaned = cleaned.replace(/\s*[-–—|:]\s*[\d,._]+(?:\s*(?:pts?|points?|k|m|mil|million))?\s*$/i, '').trim();
    // Strip trailing parenthesized country like "(US)", "(JP)", "(CA)", "(USA)"
    cleaned = cleaned.replace(/\s*\([A-Za-z]{2,3}\)\s*$/, '').trim();
    // Strip trailing bracketed country like "[US]"
    cleaned = cleaned.replace(/\s*\[[A-Za-z]{2,3}\]\s*$/, '').trim();
    changed = cleaned !== prev;
  }

  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  const upper = cleaned.toUpperCase();

  if (TABLE_KEYWORDS.has(lower)) return null;
  if (PLAYSTYLES.has(lower)) return null;
  if (ISO_COUNTRY_CODES.has(upper)) return null;
  if (isPureNumberOrScore(cleaned)) return null;

  // If token is just punctuation or single character
  if (/^[^\w\s]+$/.test(cleaned) || cleaned.length < 2) return null;

  return cleaned;
}

export function parseBulkSeedList(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if the line has tabs (tabular row)
    if (line.includes('\t')) {
      const cells = line.split('\t');
      for (const cell of cells) {
        const candidate = cleanCandidateToken(cell);
        if (candidate) {
          const lower = candidate.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            result.push(candidate);
          }
          break; // Extract at most one player name per tabbed table row
        }
      }
      continue;
    }

    // Check comma-separated line (e.g. "1, Blue Scuti, CA, 982561")
    if (line.includes(',') && !isPureNumberOrScore(line)) {
      const cells = line.split(',');
      let foundInCells = false;
      for (const cell of cells) {
        const candidate = cleanCandidateToken(cell);
        if (candidate) {
          const lower = candidate.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            result.push(candidate);
          }
          foundInCells = true;
          break;
        }
      }
      if (foundInCells) continue;
    }

    // Single line / standalone item (or block item from web table copy)
    const candidate = cleanCandidateToken(line);
    if (candidate) {
      const lower = candidate.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(candidate);
      }
    }
  }

  return result;
}

interface BulkSeedImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
}

export const BulkSeedImportModal: React.FC<BulkSeedImportModalProps> = ({
  isOpen,
  onClose,
  tournament,
}) => {
  const {
    globalPlayers,
    addGlobalPlayer,
    importPlayersToTournament,
    setManualSeeds,
    setSeedingMethod,
  } = useTournament();

  const [rawText, setRawText] = useState('');
  const [importDestination, setImportDestination] = useState<'BOTTOM' | 'TOP' | 'REPLACE'>('BOTTOM');
  const titleId = useId();

  const existingSeeds = useMemo(() => tournament.manualSeeds || [], [tournament.manualSeeds]);
  const existingSeedsCount = existingSeeds.length;

  const parsedNames = useMemo(() => parseBulkSeedList(rawText), [rawText]);

  // Analyze how names will be resolved
  const resolutionAnalysis = useMemo(() => {
    const existingTourneyMap = new Map(
      (tournament.playersPool || []).map(p => [p.name.toLowerCase(), p])
    );
    const globalMap = new Map(globalPlayers.map(p => [p.name.toLowerCase(), p]));
    const existingSeedSet = new Set(existingSeeds);

    let onRosterCount = 0;
    let inGlobalCount = 0;
    let newPlayerCount = 0;
    let alreadySeededCount = 0;

    let newSeedOffset = 0;
    const items = parsedNames.map((name) => {
      const lower = name.toLowerCase();
      const inTourney = existingTourneyMap.get(lower);
      const isAlreadySeeded = Boolean(inTourney && existingSeedSet.has(inTourney.id));

      if (isAlreadySeeded) {
        alreadySeededCount++;
      } else {
        newSeedOffset++;
      }

      let projectedSeed: number;
      if (importDestination === 'REPLACE' || existingSeedsCount === 0) {
        projectedSeed = newSeedOffset + (isAlreadySeeded ? 1 : 0);
      } else if (importDestination === 'BOTTOM') {
        projectedSeed = isAlreadySeeded
          ? existingSeeds.indexOf(inTourney!.id) + 1
          : existingSeedsCount + newSeedOffset;
      } else {
        // TOP
        projectedSeed = isAlreadySeeded
          ? existingSeeds.indexOf(inTourney!.id) + 1
          : newSeedOffset;
      }

      if (inTourney) {
        onRosterCount++;
        return {
          name,
          projectedSeed,
          status: 'roster' as const,
          player: inTourney,
          isAlreadySeeded,
        };
      }

      const inGlobal = globalMap.get(lower);
      if (inGlobal) {
        inGlobalCount++;
        return {
          name,
          projectedSeed,
          status: 'global' as const,
          player: inGlobal,
          isAlreadySeeded: false,
        };
      }

      newPlayerCount++;
      return {
        name,
        projectedSeed,
        status: 'new' as const,
        isAlreadySeeded: false,
      };
    });

    const netNewSeedsCount = items.filter(i => !i.isAlreadySeeded).length;

    return {
      items,
      onRosterCount,
      inGlobalCount,
      newPlayerCount,
      alreadySeededCount,
      netNewSeedsCount,
    };
  }, [parsedNames, tournament.playersPool, globalPlayers, existingSeeds, existingSeedsCount, importDestination]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (parsedNames.length === 0) return;

    const existingTourneyMap = new Map(
      (tournament.playersPool || []).map(p => [p.name.toLowerCase(), p])
    );
    const globalMap = new Map(globalPlayers.map(p => [p.name.toLowerCase(), p]));

    const playersToAddToTournament: PlayerProfile[] = [];
    const parsedPlayerIds: string[] = [];

    for (const name of parsedNames) {
      const lower = name.toLowerCase();
      const inTourney = existingTourneyMap.get(lower);
      if (inTourney) {
        parsedPlayerIds.push(inTourney.id);
        continue;
      }

      const inGlobal = globalMap.get(lower);
      if (inGlobal) {
        playersToAddToTournament.push(inGlobal);
        parsedPlayerIds.push(inGlobal.id);
        continue;
      }

      // Brand new competitor
      const created = addGlobalPlayer({
        name,
        playstyle: 'Rolling',
        personalBest: 1000000,
        notes: 'Bulk imported participant',
      });
      playersToAddToTournament.push(created);
      parsedPlayerIds.push(created.id);
    }

    if (playersToAddToTournament.length > 0) {
      importPlayersToTournament(tournament.id, playersToAddToTournament);
    }

    let finalOrderedPlayerIds: string[];

    if (existingSeedsCount === 0 || importDestination === 'REPLACE') {
      finalOrderedPlayerIds = parsedPlayerIds;
    } else if (importDestination === 'TOP') {
      const existingSet = new Set(existingSeeds);
      const uniqueNew = parsedPlayerIds.filter(id => !existingSet.has(id));
      finalOrderedPlayerIds = [...uniqueNew, ...existingSeeds];
    } else {
      // 'BOTTOM' (Default additive)
      const existingSet = new Set(existingSeeds);
      const uniqueNew = parsedPlayerIds.filter(id => !existingSet.has(id));
      finalOrderedPlayerIds = [...existingSeeds, ...uniqueNew];
    }

    setManualSeeds(tournament.id, finalOrderedPlayerIds);
    if (tournament.seedingMethod !== 'MANUAL') {
      setSeedingMethod(tournament.id, 'MANUAL');
    }

    setRawText('');
    onClose();
  };

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={rawText.trim() !== ''}
      aria-labelledby={titleId}
      panelClassName="flex max-h-[90vh] max-w-170 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-[rgba(99,102,241,0.15)] text-brand">
                <Upload size={20} />
              </div>
              <div>
                <h3 id={titleId} className="m-0 text-lg font-bold text-fg">
                  Bulk Import Participants & Seeds
                </h3>
                <p className="m-0 text-caption text-fg-muted">
                  Paste an ordered list of competitors with top seeds at the top.
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose} className="p-1.5">
              <X size={20} />
            </IconButton>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
                Paste Participant List (1 per line)
              </label>
              <textarea
                rows={8}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Example:\n1. Jonas Neubauer\n2. Harry Hong\n#3 Joseph Saelee\nDogPlayingTetris\nPixelAndy`}
                className="w-full resize-y rounded-md border border-line bg-elevated p-3 font-mono text-sm leading-snug text-fg"
              />
              <span className="text-xs text-fg-muted">
                Supports plain lists, numbered/bulleted ranks, or direct copy-paste from player tables, Google Sheets, and Excel. Table ranks, scores, country codes, and action buttons are automatically cleaned.
              </span>
            </div>

            {/* Additive Mode Selector when tournament already has seeds */}
            {existingSeedsCount > 0 && (
              <div className="flex flex-col gap-2.5 rounded-md border border-line bg-elevated px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={16} color="var(--color-gold-bright)" />
                    <span className="text-sm font-bold text-fg">
                      Existing Seeds ({existingSeedsCount} competitors currently seeded)
                    </span>
                  </div>
                  <span className="text-xs text-fg-muted">
                    Additive Import Mode
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Append to Bottom */}
                  <button
                    type="button"
                    onClick={() => setImportDestination('BOTTOM')}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1 rounded-sm border-[1.5px] px-3 py-2.5 text-left text-fg transition-all duration-150',
                      importDestination === 'BOTTOM' ? 'border-brand bg-[rgba(99,102,241,0.12)]' : 'border-line bg-surface'
                    )}
                  >
                    <div className={cn('flex items-center gap-1.5 text-caption font-bold', importDestination === 'BOTTOM' ? 'text-brand' : 'text-fg')}>
                      <ArrowDown size={14} />
                      Add to Bottom
                    </div>
                    <span className="text-2xs text-fg-muted">
                      Seeds #{existingSeedsCount + 1}+
                    </span>
                  </button>

                  {/* Insert at Top */}
                  <button
                    type="button"
                    onClick={() => setImportDestination('TOP')}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1 rounded-sm border-[1.5px] px-3 py-2.5 text-left text-fg transition-all duration-150',
                      importDestination === 'TOP' ? 'border-brand bg-[rgba(99,102,241,0.12)]' : 'border-line bg-surface'
                    )}
                  >
                    <div className={cn('flex items-center gap-1.5 text-caption font-bold', importDestination === 'TOP' ? 'text-brand' : 'text-fg')}>
                      <ArrowUp size={14} />
                      Add to Top
                    </div>
                    <span className="text-2xs text-fg-muted">
                      Seeds #1..N (shift existing)
                    </span>
                  </button>

                  {/* Replace All */}
                  <button
                    type="button"
                    onClick={() => setImportDestination('REPLACE')}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1 rounded-sm border-[1.5px] px-3 py-2.5 text-left text-fg transition-all duration-150',
                      importDestination === 'REPLACE' ? 'border-red bg-red/12' : 'border-line bg-surface'
                    )}
                  >
                    <div className={cn('flex items-center gap-1.5 text-caption font-bold', importDestination === 'REPLACE' ? 'text-red' : 'text-fg')}>
                      <RefreshCw size={14} />
                      Replace All
                    </div>
                    <span className={cn('text-2xs', importDestination === 'REPLACE' ? 'text-red' : 'text-fg-muted')}>
                      Overwrite {existingSeedsCount} seeds
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Warning banner when text is entered but 0 competitors parsed */}
            {rawText.trim().length > 0 && parsedNames.length === 0 && (
              <div className="flex items-center gap-2.5 rounded-md border border-red/35 bg-red/10 px-4 py-3 text-caption text-red">
                <AlertCircle size={16} className="shrink-0" />
                <span>
                  No valid competitor names detected. The pasted text appears to contain only numbers, country codes, or action buttons.
                </span>
              </div>
            )}

            {/* Analysis & Summary Badges */}
            {parsedNames.length > 0 && (
              <div className="flex flex-col gap-2.5 rounded-md border border-line-subtle bg-elevated px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-bold text-fg">
                      Detected {parsedNames.length} Competitors
                    </span>
                    {rawText.split(/\r?\n/).filter(l => l.trim().length > 0).length > parsedNames.length && (
                      <span className="rounded-sm border border-line-subtle bg-surface px-2 py-0.5 text-xs text-fg-muted">
                        Filtered {rawText.split(/\r?\n/).filter(l => l.trim().length > 0).length - parsedNames.length} table artifacts
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {resolutionAnalysis.alreadySeededCount > 0 && importDestination !== 'REPLACE' && (
                      <span className="flex items-center gap-1 text-fg-muted">
                        <CheckCircle2 size={13} /> {resolutionAnalysis.alreadySeededCount} already seeded (preserved)
                      </span>
                    )}
                    {resolutionAnalysis.onRosterCount > 0 && (
                      <span className="flex items-center gap-1 text-green-bright">
                        <CheckCircle2 size={13} /> {resolutionAnalysis.onRosterCount} on roster
                      </span>
                    )}
                    {resolutionAnalysis.inGlobalCount > 0 && (
                      <span className="flex items-center gap-1 text-gold-bright">
                        <Globe size={13} /> {resolutionAnalysis.inGlobalCount} in global pool
                      </span>
                    )}
                    {resolutionAnalysis.newPlayerCount > 0 && (
                      <span className="flex items-center gap-1 text-brand">
                        <UserPlus size={13} /> {resolutionAnalysis.newPlayerCount} new
                      </span>
                    )}
                  </div>
                </div>

                {/* Seed Preview List */}
                <div className="flex max-h-45 flex-col gap-1.5 overflow-y-auto">
                  {resolutionAnalysis.items.slice(0, 16).map(item => (
                    <div
                      key={`${item.projectedSeed}-${item.name}`}
                      className={cn(
                        'flex items-center justify-between rounded-sm bg-surface px-2.5 py-1.5 text-caption',
                        item.isAlreadySeeded && importDestination !== 'REPLACE' && 'opacity-75'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 font-bold text-gold-bright">
                          #{item.projectedSeed}
                        </span>
                        <span className="font-medium text-fg">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.isAlreadySeeded && importDestination !== 'REPLACE' && (
                          <span className="rounded-full bg-elevated px-2 py-0.5 text-2xs text-fg-muted">
                            Preserved
                          </span>
                        )}
                        {item.status === 'roster' && (
                          <span className="rounded-full bg-green/10 px-2 py-0.5 text-2xs text-green-bright">
                            On Roster
                          </span>
                        )}
                        {item.status === 'global' && (
                          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-2xs text-gold-bright">
                            Global Catalog
                          </span>
                        )}
                        {item.status === 'new' && (
                          <span className="rounded-full bg-[rgba(99,102,241,0.1)] px-2 py-0.5 text-2xs text-brand">
                            Create New
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {resolutionAnalysis.items.length > 16 && (
                    <div className="pt-1 text-center text-xs text-fg-muted">
                      + {resolutionAnalysis.items.length - 16} more competitors...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-line bg-elevated px-6 py-4">
            <Button variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={parsedNames.length === 0}
              onClick={handleApply}
              className="gap-1.5 px-5"
            >
              <Upload size={16} />
              {existingSeedsCount === 0 || importDestination === 'REPLACE'
                ? `Apply ${parsedNames.length > 0 ? `${parsedNames.length} ` : ''}Seeds`
                : importDestination === 'TOP'
                ? `Insert ${resolutionAnalysis.netNewSeedsCount} Seeds at Top`
                : `Append ${resolutionAnalysis.netNewSeedsCount} Seeds to Bottom`}
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};
