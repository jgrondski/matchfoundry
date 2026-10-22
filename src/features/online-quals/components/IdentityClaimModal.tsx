import React, { useState } from 'react';
import { UserCheck, UserPlus, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface UnclaimedPlayerOption {
  id: string;
  name: string;
  country?: string;
  playstyle?: string;
}

export interface IdentityClaimModalProps {
  isOpen: boolean;
  unclaimedPlayers: UnclaimedPlayerOption[];
  twitchUser: {
    id: string;
    login: string;
    displayName: string;
    profileImageUrl?: string;
  };
  onClaimRoster: (playerId: string) => Promise<void>;
  onRegisterNew: (newPlayer: { name: string; country: string; playstyle: string }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export const IdentityClaimModal: React.FC<IdentityClaimModalProps> = ({
  isOpen,
  unclaimedPlayers,
  twitchUser,
  onClaimRoster,
  onRegisterNew,
  onCancel,
  isSubmitting = false,
  errorMessage,
}) => {
  const [activeTab, setActiveTab] = useState<'claim' | 'new'>(
    unclaimedPlayers.length > 0 ? 'claim' : 'new'
  );

  // Tab 1 state
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    unclaimedPlayers[0]?.id || ''
  );

  // Tab 2 state
  const [name, setName] = useState(twitchUser.displayName || '');
  const [country, setCountry] = useState('US');
  const [playstyle, setPlaystyle] = useState('DAS');

  if (!isOpen) return null;

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) return;
    await onClaimRoster(selectedPlayerId);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanCountry = (country.trim().toUpperCase() || 'US').slice(0, 2);
    await onRegisterNew({
      name: cleanName,
      country: cleanCountry,
      playstyle,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      data-testid="identity-claim-modal"
    >
      <div
        style={{
          background: 'var(--color-bg-surface, #121820)',
          border: '1px solid var(--color-border, #263342)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border, #263342)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-elevated, #1a222d)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={22} color="var(--color-gold-bright, #fbbf24)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
              Competitor Identity Resolution
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary, #94a3b8)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
            }}
            title="Cancel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Twitch Profile Pill */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: 'rgba(168, 85, 247, 0.08)',
            borderBottom: '1px solid rgba(168, 85, 247, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          {twitchUser.profileImageUrl ? (
            <img
              src={twitchUser.profileImageUrl}
              alt={twitchUser.displayName}
              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
            />
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#a855f7',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {twitchUser.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Connected as: </span>
            <strong style={{ color: '#ffffff' }}>{twitchUser.displayName}</strong>
            <span style={{ color: '#a855f7', marginLeft: '0.4rem' }}>@{twitchUser.login}</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border, #263342)',
            background: 'var(--color-bg-base, #0a0e14)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('claim')}
            style={{
              flex: 1,
              padding: '0.85rem',
              border: 'none',
              borderBottom: activeTab === 'claim' ? '2px solid var(--color-gold-bright, #f59e0b)' : 'none',
              background: activeTab === 'claim' ? 'var(--color-bg-surface, #121820)' : 'transparent',
              color: activeTab === 'claim' ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            data-testid="tab-claim-roster"
          >
            <UserCheck size={18} />
            Claim Existing Roster ({unclaimedPlayers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            style={{
              flex: 1,
              padding: '0.85rem',
              border: 'none',
              borderBottom: activeTab === 'new' ? '2px solid var(--color-gold-bright, #f59e0b)' : 'none',
              background: activeTab === 'new' ? 'var(--color-bg-surface, #121820)' : 'transparent',
              color: activeTab === 'new' ? '#ffffff' : 'var(--color-text-secondary, #94a3b8)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            data-testid="tab-register-new"
          >
            <UserPlus size={18} />
            Register as Walk-In
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '1.5rem' }}>
          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#f87171',
                fontSize: '0.88rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'claim' ? (
            <form onSubmit={handleClaim}>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '1rem' }}>
                If you registered with tournament organizers in advance, select your competitor name below to claim
                your roster slot. Your run will start immediately as <strong>Claimed (Pending Review)</strong>.
              </p>

              {unclaimedPlayers.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No unclaimed players on this tournament roster. Please register as a walk-in competitor.
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Select Your Roster Profile
                  </label>
                  <select
                    value={selectedPlayerId}
                    onChange={e => setSelectedPlayerId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--color-bg-base, #0a0e14)',
                      border: '1px solid var(--color-border, #263342)',
                      color: '#ffffff',
                      fontSize: '0.95rem',
                    }}
                    data-testid="claim-roster-select"
                  >
                    {unclaimedPlayers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.country ? `[${p.country}]` : ''} {p.playstyle ? `(${p.playstyle})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #263342)',
                    background: 'transparent',
                    color: 'var(--color-text-secondary, #94a3b8)',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedPlayerId || isSubmitting}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--color-gold-bright, #f59e0b)',
                    color: '#000000',
                    fontWeight: 800,
                    cursor: selectedPlayerId && !isSubmitting ? 'pointer' : 'not-allowed',
                  }}
                  data-testid="submit-claim-button"
                >
                  {isSubmitting ? 'Claiming...' : 'Claim Profile & Proceed'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary, #94a3b8)', marginBottom: '1rem' }}>
                New walk-in competitor? Create your competitor alias below. You will be registered on the roster and
                placed as <strong>Provisional New</strong> until confirmed by tournament judges.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    marginBottom: '0.4rem',
                  }}
                >
                  Competitive Alias / Screen Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. SharkyDAS"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'var(--color-bg-base, #0a0e14)',
                    border: '1px solid var(--color-border, #263342)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                  data-testid="register-name-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Country Code (ISO 2-Letter)
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="US"
                    maxLength={2}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--color-bg-base, #0a0e14)',
                      border: '1px solid var(--color-border, #263342)',
                      color: '#ffffff',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                    data-testid="register-country-input"
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      marginBottom: '0.4rem',
                    }}
                  >
                    NES Playstyle
                  </label>
                  <select
                    value={playstyle}
                    onChange={e => setPlaystyle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--color-bg-base, #0a0e14)',
                      border: '1px solid var(--color-border, #263342)',
                      color: '#ffffff',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                    data-testid="register-playstyle-select"
                  >
                    <option value="DAS">DAS</option>
                    <option value="Rolling">Rolling</option>
                    <option value="Hypertap">Hypertap</option>
                    <option value="Tapping">Tapping</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #263342)',
                    background: 'transparent',
                    color: 'var(--color-text-secondary, #94a3b8)',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isSubmitting}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--color-gold-bright, #f59e0b)',
                    color: '#000000',
                    fontWeight: 800,
                    cursor: name.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                  }}
                  data-testid="submit-register-button"
                >
                  {isSubmitting ? 'Registering...' : 'Register & Proceed'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
