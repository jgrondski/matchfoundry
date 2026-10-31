import React, { useState, useId } from 'react';
import { UserCheck, UserX, UserPlus, Search, X } from 'lucide-react';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import type { PlayerProfile } from '../../tournament/types';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { Overlay } from '../../../components/overlay';

export interface IdentityResolutionModalProps {
  isOpen: boolean;
  session: ReviewQueueSessionSummary | null;
  playersPool: PlayerProfile[];
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
  const titleId = useId();

  if (!isOpen || !session) return null;

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
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-surface-elevated)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <UserCheck size={22} color="var(--color-gold-bright)" />
              <div>
                <h2
                  id={titleId}
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: 0,
                  }}
                >
                  Resolve Competitor Identity: {session.playerName}
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Twitch: @{session.submittedTwitchUsername || 'N/A'} (ID: {session.submittedTwitchId || 'N/A'})
                </span>
              </div>
            </div>
            <button
              onClick={requestClose}
              aria-label="Close Identity Resolution Dialog"
              disabled={isSubmitting}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '0.4rem',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Controls: Tab 1 = Reassign Competitor (Default), Tab 2 = Add Global Player */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-border)',
              background: 'rgba(0, 0, 0, 0.25)',
            }}
          >
            <button
              type="button"
              data-testid="tab-reassign"
              onClick={() => setActiveTab('reassign')}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: activeTab === 'reassign' ? 'var(--color-bg-surface)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'reassign' ? '2px solid var(--color-gold-bright)' : '2px solid transparent',
                color: activeTab === 'reassign' ? '#ffffff' : 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Reassign Competitor
            </button>
            <button
              type="button"
              data-testid="tab-add-global"
              onClick={() => setActiveTab('add_global')}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: activeTab === 'add_global' ? 'var(--color-bg-surface)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'add_global' ? '2px solid var(--color-gold-bright)' : '2px solid transparent',
                color: activeTab === 'add_global' ? '#ffffff' : 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Add Global Player
            </button>
            {session.identityStatus === 'CLAIMED_PENDING_REVIEW' && (
              <button
                type="button"
                data-testid="tab-confirm"
                onClick={() => setActiveTab('confirm')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: activeTab === 'confirm' ? 'var(--color-bg-surface)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'confirm' ? '2px solid var(--color-gold-bright)' : '2px solid transparent',
                  color: activeTab === 'confirm' ? '#ffffff' : 'var(--color-text-muted)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Confirm Binding
              </button>
            )}
          </div>

          {/* Tab Body */}
          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* TAB 1: Reassign Competitor */}
            {activeTab === 'reassign' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  If the competitor has an existing account under another name or claimed the wrong person,
                  select the correct competitor below to transfer this run.
                </p>

                {/* Search Box */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search registered competitors..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                      background: 'var(--color-bg-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Competitors List */}
                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {filteredPlayers.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      No matching competitors found.
                    </div>
                  ) : (
                    filteredPlayers.map(p => {
                      const isSelected = selectedTargetId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedTargetId(p.id)}
                          style={{
                            padding: '0.65rem 0.85rem',
                            background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                            borderBottom: '1px solid var(--color-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <PlayerAvatar player={p} size={28} />
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                                {p.name}
                              </div>
                              {p.twitchUsername && (
                                <div style={{ fontSize: '0.72rem', color: '#a78bfa' }}>
                                  @{p.twitchUsername}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-gold-bright)' }}>
                              Selected
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Add Global Player (Consolidated) */}
            {activeTab === 'add_global' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Register this competitor as an official player in the global directory with confirmed name, country, and playstyle.
                </p>

                {/* Profile Card Preview */}
                <div
                  style={{
                    background: 'var(--color-bg-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
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
                    <div style={{ fontWeight: 800, color: '#ffffff' }}>{newName || session.playerName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      {session.submittedTwitchUsername ? `@${session.submittedTwitchUsername} • ` : ''}
                      Country: {newCountry || 'Unassigned'} • Style: {newPlaystyle}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Competitor Name / Alias
                  </label>
                  <input
                    type="text"
                    data-testid="new-player-name-input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Sharky DAS"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--color-bg-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                      Country Code (ISO 2-letter)
                    </label>
                    <input
                      type="text"
                      data-testid="new-player-country-input"
                      maxLength={2}
                      value={newCountry}
                      onChange={e => setNewCountry(e.target.value.toUpperCase())}
                      placeholder="e.g. US"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        background: 'var(--color-bg-surface-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        textTransform: 'uppercase',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                      Playstyle
                    </label>
                    <select
                      data-testid="new-player-playstyle-select"
                      value={newPlaystyle}
                      onChange={e => setNewPlaystyle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        background: 'var(--color-bg-surface-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  This competitor claimed the profile <strong>{session.playerName}</strong> during Twitch login.
                  Confirming identity will permanently bind Twitch ID <code>{session.submittedTwitchId}</code> to their profile.
                  Future logins with this Twitch account will automatically resolve without judge review.
                </p>
                <div
                  style={{
                    background: 'var(--color-bg-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
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
                    <div style={{ fontWeight: 800, color: '#ffffff' }}>{session.playerName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#a78bfa' }}>
                      Twitch: @{session.submittedTwitchUsername || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              Cancel
            </button>

            {activeTab === 'reassign' && (
              <button
                type="button"
                data-testid="submit-reassign-button"
                onClick={() => {
                  if (selectedTargetId) {
                    onResolve('REASSIGN_PLAYER', { targetPlayerId: selectedTargetId });
                  }
                }}
                disabled={isSubmitting || !selectedTargetId}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#3b82f6',
                  borderColor: '#2563eb',
                }}
              >
                <UserX size={15} /> Reassign Run
              </button>
            )}

            {activeTab === 'add_global' && (
              <button
                type="button"
                data-testid="submit-add-global-button"
                onClick={() => {
                  if (newName.trim()) {
                    const action = session.identityStatus === 'PROVISIONAL_NEW'
                      ? 'PROMOTE_PROVISIONAL'
                      : 'CREATE_NEW_PLAYER';
                    onResolve(action, {
                      newPlayer: {
                        name: newName.trim(),
                        country: newCountry.trim().toUpperCase() || undefined,
                        playstyle: newPlaystyle,
                      },
                    });
                  }
                }}
                disabled={isSubmitting || !newName.trim()}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#10b981',
                  borderColor: '#059669',
                }}
              >
                <UserPlus size={15} /> Add Global Player
              </button>
            )}

            {activeTab === 'confirm' && (
              <button
                type="button"
                data-testid="submit-confirm-button"
                onClick={() => onResolve('CONFIRM_IDENTITY')}
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <UserCheck size={15} /> Confirm Binding
              </button>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
};
