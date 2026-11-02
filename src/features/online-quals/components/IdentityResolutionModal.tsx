import React, { useState, useId } from 'react';
import { UserCheck, UserX, UserPlus, Search, X, AlertTriangle } from 'lucide-react';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import type { PlayerProfile } from '../../tournament/types';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton, cn } from '../../../components/ui';
import { getReassignBlockReason, reassignReplacesEmptyQual, type ReassignTargetQual } from '../reassignRules';

const tabClass = (active: boolean) =>
  cn(
    'flex-1 cursor-pointer border-0 border-b-2 p-3 text-sm font-bold',
    active ? 'border-gold-bright bg-surface text-white' : 'border-transparent bg-transparent text-fg-muted'
  );

const labelClass = 'mb-1.5 block text-caption font-bold text-fg-muted';

const fieldClass = 'w-full rounded-md border border-line bg-elevated px-3 py-2 text-sm text-white';

export interface IdentityResolutionModalProps {
  isOpen: boolean;
  session: ReviewQueueSessionSummary | null;
  playersPool: PlayerProfile[];
  /** Every qual in the tournament, used to show which reassignment targets already have one. */
  sessions?: ReviewQueueSessionSummary[];
  onClose: () => void;
  onResolve: (
    action: 'CONFIRM_IDENTITY' | 'REASSIGN_PLAYER' | 'PROMOTE_PROVISIONAL' | 'CREATE_NEW_PLAYER',
    options?: {
      targetPlayerId?: string;
      newPlayer?: { name: string; country?: string; playstyle?: string };
    }
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export const IdentityResolutionModal: React.FC<IdentityResolutionModalProps> = ({
  isOpen,
  session,
  playersPool,
  sessions = [],
  onClose,
  onResolve,
  isSubmitting = false,
}) => {
  // Always default to 'reassign' as the first tab
  const [activeTab, setActiveTab] = useState<'reassign' | 'add_global' | 'confirm'>('reassign');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const [newName, setNewName] = useState(session?.playerName || '');
  const [newCountry, setNewCountry] = useState(session?.country || '');
  const [newPlaystyle, setNewPlaystyle] = useState('DAS');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  if (!isOpen || !session) return null;

  const qualByPlayer = new Map<string, ReassignTargetQual>(
    sessions.map(s => [s.playerId, { status: s.status, scoreCount: s.scores.length }])
  );
  const selectedTarget = selectedTargetId ? playersPool.find(p => p.id === selectedTargetId) : undefined;
  const selectedQual = selectedTargetId ? qualByPlayer.get(selectedTargetId) : undefined;
  const selectedBlock = selectedTarget ? getReassignBlockReason(selectedTarget.name, selectedQual) : null;

  const resolve = async (...args: Parameters<typeof onResolve>) => {
    setError(null);
    try {
      await onResolve(...args);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  };

  const describeQual = (qual: ReassignTargetQual | undefined): string | null => {
    if (!qual) return null;
    if (qual.status === 'VERIFIED') return 'Has a verified qual';
    if (qual.status === 'IN_PROGRESS') return 'Online run in progress';
    if (qual.scoreCount === 0) return 'Has an empty qual';
    return `Has a qual · ${qual.scoreCount} score${qual.scoreCount === 1 ? '' : 's'}`;
  };

  const filteredPlayers = playersPool
    .filter(p => p.id !== session.playerId)
    .filter(p => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.twitchUsername && p.twitchUsername.toLowerCase().includes(q))
      );
    })
    .slice(0, 50);

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={selectedTargetId !== null || newName !== (session?.playerName || '') || newCountry !== (session?.country || '') || newPlaystyle !== 'DAS'}
      busy={isSubmitting}
      aria-labelledby={titleId}
      panelClassName="flex max-h-[90vh] max-w-155 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_24px_48px_rgba(0,0,0,0.6)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-elevated px-6 py-5">
            <div className="flex items-center gap-2.5">
              <UserCheck size={22} color="var(--color-gold-bright)" />
              <div>
                <h2 id={titleId} className="m-0 text-lg font-extrabold text-white">
                  Resolve Competitor Identity: {session.playerName}
                </h2>
                <span className="text-caption text-fg-muted">
                  Twitch: @{session.submittedTwitchUsername || 'N/A'} (ID: {session.submittedTwitchId || 'N/A'})
                </span>
              </div>
            </div>
            <IconButton
              onClick={requestClose}
              aria-label="Close Identity Resolution Dialog"
              disabled={isSubmitting}
              className="p-1.5"
            >
              <X size={20} />
            </IconButton>
          </div>

          {/* Tab Controls: Tab 1 = Reassign Competitor (Default), Tab 2 = Add Global Player */}
          <div className="flex border-b border-line bg-black/25">
            <button
              type="button"
              data-testid="tab-reassign"
              onClick={() => setActiveTab('reassign')}
              className={tabClass(activeTab === 'reassign')}
            >
              Reassign Competitor
            </button>
            <button
              type="button"
              data-testid="tab-add-global"
              onClick={() => setActiveTab('add_global')}
              className={tabClass(activeTab === 'add_global')}
            >
              Add Global Player
            </button>
            {session.identityStatus === 'CLAIMED_PENDING_REVIEW' && (
              <button
                type="button"
                data-testid="tab-confirm"
                onClick={() => setActiveTab('confirm')}
                className={tabClass(activeTab === 'confirm')}
              >
                Confirm Binding
              </button>
            )}
          </div>

          {/* Tab Body */}
          <div className="flex flex-col gap-4 overflow-y-auto p-6">
            {/* TAB 1: Reassign Competitor */}
            {activeTab === 'reassign' && (
              <div className="flex flex-col gap-3.5">
                <p className="m-0 text-sm text-fg-secondary">
                  If the competitor has an existing account under another name or claimed the wrong person,
                  select the correct competitor below to transfer this run.
                </p>

                {/* Search Box */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted"
                  />
                  <input
                    type="text"
                    placeholder="Search registered competitors..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={cn(fieldClass, 'pl-9')}
                  />
                </div>

                {/* Competitors List */}
                <div className="flex max-h-55 flex-col overflow-y-auto rounded-md border border-line">
                  {filteredPlayers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-fg-muted">
                      No matching competitors found.
                    </div>
                  ) : (
                    filteredPlayers.map(p => {
                      const isSelected = selectedTargetId === p.id;
                      const qual = qualByPlayer.get(p.id);
                      const qualLabel = describeQual(qual);
                      const isBlocked = getReassignBlockReason(p.name, qual) !== null;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedTargetId(p.id);
                            setError(null);
                          }}
                          className={cn(
                            'flex cursor-pointer items-center justify-between border-b border-line-subtle px-3.5 py-2.5 transition-colors duration-100',
                            isSelected ? 'bg-gold/15' : 'bg-transparent',
                            isBlocked && !isSelected && 'opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar player={p} size={28} />
                            <div>
                              <div className="text-sm font-bold text-white">
                                {p.name}
                              </div>
                              {p.twitchUsername && (
                                <div className="text-xs text-violet-400">
                                  @{p.twitchUsername}
                                </div>
                              )}
                              {qualLabel && (
                                <div className={cn('text-xs', isBlocked ? 'text-red-bright' : 'text-fg-muted')}>
                                  {qualLabel}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-xs font-extrabold text-gold-bright">
                              Selected
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedBlock && (
                  <div
                    data-testid="reassign-blocked"
                    className="flex items-start gap-2.5 rounded-md border border-red/40 bg-red/12 px-3.5 py-3 text-sm text-red-300"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>{selectedBlock}</div>
                  </div>
                )}
                {selectedTarget && !selectedBlock && reassignReplacesEmptyQual(selectedQual) && (
                  <div
                    data-testid="reassign-replaces-empty"
                    className="rounded-md border border-gold/30 bg-gold/10 px-3.5 py-3 text-sm text-gold-bright"
                  >
                    {selectedTarget.name} has an empty qual (no scores). It will be replaced by this run.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Add Global Player (Consolidated) */}
            {activeTab === 'add_global' && (
              <div className="flex flex-col gap-3.5">
                <p className="m-0 text-sm text-fg-secondary">
                  Register this competitor as an official player in the global directory with confirmed name, country, and playstyle.
                </p>

                {/* Profile Card Preview */}
                <div className="flex items-center gap-3 rounded-md border border-line bg-elevated px-4 py-3.5">
                  <PlayerAvatar
                    player={{
                      name: newName || session.playerName,
                      country: newCountry || undefined,
                      avatarUrl: session.avatarUrl,
                      avatarType: (session.avatarType as any) || 'flag',
                    }}
                    size={42}
                  />
                  <div>
                    <div className="font-extrabold text-white">{newName || session.playerName}</div>
                    <div className="text-caption text-fg-muted">
                      {session.submittedTwitchUsername ? `@${session.submittedTwitchUsername} • ` : ''}
                      Country: {newCountry || 'Unassigned'} • Style: {newPlaystyle}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Competitor Name / Alias
                  </label>
                  <input
                    type="text"
                    data-testid="new-player-name-input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Sharky DAS"
                    className={fieldClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      Country Code (ISO 2-letter)
                    </label>
                    <input
                      type="text"
                      data-testid="new-player-country-input"
                      maxLength={2}
                      value={newCountry}
                      onChange={e => setNewCountry(e.target.value.toUpperCase())}
                      placeholder="e.g. US"
                      className={cn(fieldClass, 'uppercase')}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Playstyle
                    </label>
                    <select
                      data-testid="new-player-playstyle-select"
                      value={newPlaystyle}
                      onChange={e => setNewPlaystyle(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="DAS">DAS</option>
                      <option value="Rolling">Rolling</option>
                      <option value="Hypertap">Hypertap</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Confirm Binding (Twitch Claims) */}
            {activeTab === 'confirm' && (
              <div className="flex flex-col gap-3.5">
                <p className="m-0 text-sm text-fg-secondary">
                  This competitor claimed the profile <strong>{session.playerName}</strong> during Twitch login.
                  Confirming identity will permanently bind Twitch ID <code>{session.submittedTwitchId}</code> to their profile.
                  Future logins with this Twitch account will automatically resolve without judge review.
                </p>
                <div className="flex items-center gap-3 rounded-md border border-line bg-elevated p-4">
                  <PlayerAvatar
                    player={{
                      name: session.playerName,
                      country: session.country,
                      avatarUrl: session.avatarUrl,
                      avatarType: (session.avatarType as any) || 'flag',
                    }}
                    size={42}
                  />
                  <div>
                    <div className="font-extrabold text-white">{session.playerName}</div>
                    <div className="text-caption text-violet-400">
                      Twitch: @{session.submittedTwitchUsername || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              data-testid="identity-resolution-error"
              className="flex items-start gap-2.5 border-t border-red/40 bg-red/12 px-6 py-3 text-sm text-red-300"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-line bg-elevated px-6 py-4">
            <Button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              variant="secondary"
              className="text-sm"
            >
              Cancel
            </Button>

            {activeTab === 'reassign' && (
              <Button
                type="button"
                data-testid="submit-reassign-button"
                onClick={() => {
                  if (selectedTargetId) {
                    void resolve('REASSIGN_PLAYER', { targetPlayerId: selectedTargetId });
                  }
                }}
                disabled={isSubmitting || !selectedTargetId || selectedBlock !== null}
                variant="primary"
                className="inline-flex items-center gap-1.5 text-sm bg-blue-500 bg-none border-blue-600"
              >
                <UserX size={15} /> Reassign Run
              </Button>
            )}

            {activeTab === 'add_global' && (
              <Button
                type="button"
                data-testid="submit-add-global-button"
                onClick={() => {
                  if (newName.trim()) {
                    const action = session.identityStatus === 'PROVISIONAL_NEW'
                      ? 'PROMOTE_PROVISIONAL'
                      : 'CREATE_NEW_PLAYER';
                    void resolve(action, {
                      newPlayer: {
                        name: newName.trim(),
                        country: newCountry.trim().toUpperCase() || undefined,
                        playstyle: newPlaystyle,
                      },
                    });
                  }
                }}
                disabled={isSubmitting || !newName.trim()}
                variant="primary"
                className="inline-flex items-center gap-1.5 text-sm bg-green bg-none border-emerald-600"
              >
                <UserPlus size={15} /> Add Global Player
              </Button>
            )}

            {activeTab === 'confirm' && (
              <Button
                type="button"
                data-testid="submit-confirm-button"
                onClick={() => void resolve('CONFIRM_IDENTITY')}
                disabled={isSubmitting}
                variant="primary"
                className="inline-flex items-center gap-1.5 text-sm"
              >
                <UserCheck size={15} /> Confirm Binding
              </Button>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
};
