import React, { useState, useMemo, useId } from 'react';
import { X, Upload, CheckCircle2, UserPlus, Globe, AlertCircle, Layers, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { Tournament, PlayerProfile } from '../../types';
import { useTournament } from '../../store';
import { COUNTRIES } from '../../../players/flagUtils';
import { Overlay } from '../../../../components/overlay';

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
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-brand)',
                }}
              >
                <Upload size={20} />
              </div>
              <div>
                <h3 id={titleId} style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Bulk Import Participants & Seeds
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Paste an ordered list of competitors with top seeds at the top.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Paste Participant List (1 per line)
              </label>
              <textarea
                rows={8}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Example:\n1. Jonas Neubauer\n2. Harry Hong\n#3 Joseph Saelee\nDogPlayingTetris\nPixelAndy`}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  resize: 'vertical',
                  lineHeight: '1.4',
                }}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                Supports plain lists, numbered/bulleted ranks, or direct copy-paste from player tables, Google Sheets, and Excel. Table ranks, scores, country codes, and action buttons are automatically cleaned.
              </span>
            </div>

            {/* Additive Mode Selector when tournament already has seeds */}
            {existingSeedsCount > 0 && (
              <div
                style={{
                  background: 'var(--color-bg-surface-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={16} color="var(--color-gold-bright)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Existing Seeds ({existingSeedsCount} competitors currently seeded)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Additive Import Mode
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {/* Append to Bottom */}
                  <button
                    type="button"
                    onClick={() => setImportDestination('BOTTOM')}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${importDestination === 'BOTTOM' ? 'var(--color-brand)' : 'var(--color-border)'}`,
                      background: importDestination === 'BOTTOM' ? 'rgba(99, 102, 241, 0.12)' : 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.8rem', color: importDestination === 'BOTTOM' ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>
                      <ArrowDown size={14} />
                      Add to Bottom
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      Seeds #{existingSeedsCount + 1}+
                    </span>
                  </button>

                  {/* Insert at Top */}
                  <button
                    type="button"
                    onClick={() => setImportDestination('TOP')}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${importDestination === 'TOP' ? 'var(--color-brand)' : 'var(--color-border)'}`,
                      background: importDestination === 'TOP' ? 'rgba(99, 102, 241, 0.12)' : 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.8rem', color: importDestination === 'TOP' ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>
                      <ArrowUp size={14} />
                      Add to Top
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      Seeds #1..N (shift existing)
                    </span>
                  </button>

                  {/* Replace All */}
                  <button
                    type="button"
                    onClick={() => setImportDestination('REPLACE')}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${importDestination === 'REPLACE' ? 'var(--color-red)' : 'var(--color-border)'}`,
                      background: importDestination === 'REPLACE' ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.8rem', color: importDestination === 'REPLACE' ? 'var(--color-red)' : 'var(--color-text-primary)' }}>
                      <RefreshCw size={14} />
                      Replace All
                    </div>
                    <span style={{ fontSize: '0.7rem', color: importDestination === 'REPLACE' ? 'var(--color-red)' : 'var(--color-text-muted)' }}>
                      Overwrite {existingSeedsCount} seeds
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Warning banner when text is entered but 0 competitors parsed */}
            {rawText.trim().length > 0 && parsedNames.length === 0 && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: 'var(--color-red)',
                  fontSize: '0.82rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  No valid competitor names detected. The pasted text appears to contain only numbers, country codes, or action buttons.
                </span>
              </div>
            )}

            {/* Analysis & Summary Badges */}
            {parsedNames.length > 0 && (
              <div
                style={{
                  background: 'var(--color-bg-surface-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Detected {parsedNames.length} Competitors
                    </span>
                    {rawText.split(/\r?\n/).filter(l => l.trim().length > 0).length > parsedNames.length && (
                      <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-surface)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                        Filtered {rawText.split(/\r?\n/).filter(l => l.trim().length > 0).length - parsedNames.length} table artifacts
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                    {resolutionAnalysis.alreadySeededCount > 0 && importDestination !== 'REPLACE' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-muted)' }}>
                        <CheckCircle2 size={13} /> {resolutionAnalysis.alreadySeededCount} already seeded (preserved)
                      </span>
                    )}
                    {resolutionAnalysis.onRosterCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-green-bright)' }}>
                        <CheckCircle2 size={13} /> {resolutionAnalysis.onRosterCount} on roster
                      </span>
                    )}
                    {resolutionAnalysis.inGlobalCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-gold-bright)' }}>
                        <Globe size={13} /> {resolutionAnalysis.inGlobalCount} in global pool
                      </span>
                    )}
                    {resolutionAnalysis.newPlayerCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-brand)' }}>
                        <UserPlus size={13} /> {resolutionAnalysis.newPlayerCount} new
                      </span>
                    )}
                  </div>
                </div>

                {/* Seed Preview List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {resolutionAnalysis.items.slice(0, 16).map(item => (
                    <div
                      key={`${item.projectedSeed}-${item.name}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.65rem',
                        background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        opacity: item.isAlreadySeeded && importDestination !== 'REPLACE' ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-gold-bright)', width: '28px' }}>
                          #{item.projectedSeed}
                        </span>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                          {item.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {item.isAlreadySeeded && importDestination !== 'REPLACE' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-surface-elevated)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)' }}>
                            Preserved
                          </span>
                        )}
                        {item.status === 'roster' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-green-bright)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)' }}>
                            On Roster
                          </span>
                        )}
                        {item.status === 'global' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-gold-bright)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)' }}>
                            Global Catalog
                          </span>
                        )}
                        {item.status === 'new' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-brand)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)' }}>
                            Create New
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {resolutionAnalysis.items.length > 16 && (
                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingTop: '0.25rem' }}>
                      + {resolutionAnalysis.items.length - 16} more competitors...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: 'var(--color-bg-surface-elevated)',
            }}
          >
            <button
              type="button"
              onClick={requestClose}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedNames.length === 0}
              onClick={handleApply}
              className="btn btn-primary"
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                opacity: parsedNames.length === 0 ? 0.5 : 1,
                cursor: parsedNames.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Upload size={16} />
              {existingSeedsCount === 0 || importDestination === 'REPLACE'
                ? `Apply ${parsedNames.length > 0 ? `${parsedNames.length} ` : ''}Seeds`
                : importDestination === 'TOP'
                ? `Insert ${resolutionAnalysis.netNewSeedsCount} Seeds at Top`
                : `Append ${resolutionAnalysis.netNewSeedsCount} Seeds to Bottom`}
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};
