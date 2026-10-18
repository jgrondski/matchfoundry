import React, { useState } from 'react';
import { UserCheck, UserX, UserPlus, Search, X } from 'lucide-react';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import type { PlayerProfile } from '../../tournament/types';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';

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
  const [activeTab, setActiveTab] = useState<'confirm' | 'reassign' | 'promote' | 'create_new'>(
    session?.identityStatus === 'PROVISIONAL_NEW'
      ? 'promote'
      : session?.identityStatus === 'CLAIMED_PENDING_REVIEW'
      ? 'confirm'
      : 'reassign'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const defaultNewName = session
    ? session.submittedTwitchUsername
      ? session.playerName.toLowerCase() === session.submittedTwitchUsername.toLowerCase()
        ? `${session.playerName} (New)`
        : `${session.playerName} (${session.submittedTwitchUsername})`
      : `${session.playerName} (New)`
    : '';
  const [newName, setNewName] = useState(
    session?.identityStatus === 'PROVISIONAL_NEW' ? session.playerName : defaultNewName
  );
  const [newCountry, setNewCountry] = useState(session?.country || 'US');
  const [newPlaystyle, setNewPlaystyle] = useState('DAS');

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
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
                id="identity-modal-title"
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: 0,
                }}
              >
                Resolve Competitor Identity
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Twitch: @{session.submittedTwitchUsername || 'N/A'} (ID: {session.submittedTwitchId || 'N/A'})
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
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

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          {session.identityStatus === 'CLAIMED_PENDING_REVIEW' && (
            <button
              type="button"
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
          {session.identityStatus === 'PROVISIONAL_NEW' && (
            <button
              type="button"
              onClick={() => setActiveTab('promote')}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: activeTab === 'promote' ? 'var(--color-bg-surface)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'promote' ? '2px solid var(--color-gold-bright)' : '2px solid transparent',
                color: activeTab === 'promote' ? '#ffffff' : 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Promote to Global
            </button>
          )}
          <button
            type="button"
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
            onClick={() => setActiveTab('create_new')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: activeTab === 'create_new' ? 'var(--color-bg-surface)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'create_new' ? '2px solid var(--color-gold-bright)' : '2px solid transparent',
              color: activeTab === 'create_new' ? '#ffffff' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Create Separate Player
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

          {activeTab === 'promote' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                This competitor registered as a provisional walk-in: <strong>{session.playerName}</strong>.
                Promoting will create a permanent profile in the global database and register them for future tournaments.
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
                  <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
                    Walk-in Competitor • Country: {session.country || 'US'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reassign' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                If the competitor claimed the wrong person or has an existing account under a different name,
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

          {activeTab === 'create_new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                If this competitor is a distinct person rather than the matched global player, create a separate profile to transfer this run.
              </p>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Competitor Name / Alias
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Omenvoir (New)"
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
                    maxLength={2}
                    value={newCountry}
                    onChange={e => setNewCountry(e.target.value.toUpperCase())}
                    placeholder="US"
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
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            Cancel
          </button>

          {activeTab === 'confirm' && (
            <button
              type="button"
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

          {activeTab === 'promote' && (
            <button
              type="button"
              onClick={() => onResolve('PROMOTE_PROVISIONAL')}
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <UserPlus size={15} /> Promote to Global Player
            </button>
          )}

          {activeTab === 'reassign' && (
            <button
              type="button"
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

          {activeTab === 'create_new' && (
            <button
              type="button"
              onClick={() => {
                if (newName.trim()) {
                  onResolve('CREATE_NEW_PLAYER', {
                    newPlayer: {
                      name: newName.trim(),
                      country: newCountry.trim().toUpperCase() || 'US',
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
              <UserPlus size={15} /> Create &amp; Reassign Run
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
