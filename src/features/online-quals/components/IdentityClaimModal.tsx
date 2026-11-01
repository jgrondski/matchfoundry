import React, { useState, useId, useRef } from 'react';
import { UserCheck, UserPlus, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Overlay } from '../../../components/overlay';
import { IconButton, cn } from '../../../components/ui';

const tabClass = (active: boolean) =>
  cn(
    'flex flex-1 cursor-pointer items-center justify-center gap-2 border-0 p-3.5 text-sm font-bold',
    active ? 'border-b-2 border-gold-bright bg-surface text-white' : 'bg-transparent text-fg-secondary'
  );

const labelClass = 'mb-1.5 block text-sm font-semibold text-white';

const fieldClass = 'w-full rounded-md border border-line bg-canvas p-3 text-base text-white';

const cancelClass = (isSubmitting: boolean) =>
  cn(
    'rounded-md border border-line bg-transparent px-5 py-2.5 font-semibold text-fg-secondary',
    isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer'
  );

const submitClass = (enabled: boolean) =>
  cn(
    'rounded-md border-0 bg-gold-bright px-6 py-2.5 font-extrabold text-black',
    enabled ? 'cursor-pointer' : 'cursor-not-allowed'
  );

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
  const initialSelectedPlayerId = useRef(unclaimedPlayers[0]?.id || '').current;
  const titleId = useId();

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
    <Overlay
      open
      onClose={onCancel}
      dirty={name !== (twitchUser.displayName || '') || country !== 'US' || playstyle !== 'DAS' || selectedPlayerId !== initialSelectedPlayerId}
      busy={isSubmitting}
      aria-labelledby={titleId}
      panelTestId="identity-claim-modal"
      panelClassName="flex max-w-140 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-elevated px-6 py-5">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={22} color="var(--color-gold-bright, #fbbf24)" />
              <h3 id={titleId} className="m-0 text-lg font-extrabold text-white">
                Competitor Identity Resolution
              </h3>
            </div>
            <IconButton
              onClick={requestClose}
              disabled={isSubmitting}
              aria-label="Cancel"
              className="text-fg-secondary"
              title="Cancel"
            >
              <X size={20} />
            </IconButton>
          </div>

          {/* Twitch Profile Pill */}
          <div className="flex items-center gap-3 border-b border-purple-500/20 bg-purple-500/8 px-6 py-3.5">
            {twitchUser.profileImageUrl ? (
              <img
                src={twitchUser.profileImageUrl}
                alt={twitchUser.displayName}
                className="size-8 rounded-full"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-purple-500 text-sm font-bold text-white">
                {twitchUser.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="text-sm">
              <span className="text-fg-secondary">Connected as: </span>
              <strong className="text-white">{twitchUser.displayName}</strong>
              <span className="ml-1.5 text-purple-500">@{twitchUser.login}</span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-line bg-canvas">
            <button
              type="button"
              onClick={() => setActiveTab('claim')}
              className={tabClass(activeTab === 'claim')}
              data-testid="tab-claim-roster"
            >
              <UserCheck size={18} />
              Claim Existing Roster ({unclaimedPlayers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={tabClass(activeTab === 'new')}
              data-testid="tab-register-new"
            >
              <UserPlus size={18} />
              Register as New Competitor
            </button>
          </div>

          {/* Tab Body */}
          <div className="p-6">
            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-red/30 bg-red/10 px-4 py-3 text-sm text-red-bright">
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {activeTab === 'claim' ? (
              <form onSubmit={handleClaim}>
                <p className="mb-4 text-sm text-fg-secondary">
                  If you registered with tournament organizers in advance, select your competitor name below to claim
                  your roster slot. Your run will start immediately as <strong>Claimed (Pending Review)</strong>.
                </p>

                {unclaimedPlayers.length === 0 ? (
                  <div className="p-6 text-center text-fg-muted">
                    No unclaimed players on this tournament roster. Please register as a new competitor.
                  </div>
                ) : (
                  <div className="mb-6">
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Select Your Roster Profile
                    </label>
                    <select
                      value={selectedPlayerId}
                      onChange={e => setSelectedPlayerId(e.target.value)}
                      className={fieldClass}
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

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={requestClose}
                    disabled={isSubmitting}
                    className={cancelClass(isSubmitting)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedPlayerId || isSubmitting}
                    className={submitClass(Boolean(selectedPlayerId && !isSubmitting))}
                    data-testid="submit-claim-button"
                  >
                    {isSubmitting ? 'Claiming...' : 'Claim Profile & Proceed'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <p className="mb-4 text-sm text-fg-secondary">
                  New competitor? Create your competitor alias below. You will be registered on the roster and
                  placed as <strong>Provisional New</strong> until confirmed by tournament judges.
                </p>

                <div className="mb-4">
                  <label className={labelClass}>
                    Competitive Alias / Screen Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. SharkyDAS"
                    required
                    className={fieldClass}
                    data-testid="register-name-input"
                  />
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Country Code (ISO 2-Letter)
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="US"
                      maxLength={2}
                      className={fieldClass}
                      data-testid="register-country-input"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      NES Playstyle
                    </label>
                    <select
                      value={playstyle}
                      onChange={e => setPlaystyle(e.target.value)}
                      className={fieldClass}
                      data-testid="register-playstyle-select"
                    >
                      <option value="DAS">DAS</option>
                      <option value="Rolling">Rolling</option>
                      <option value="Hypertap">Hypertap</option>
                      <option value="Tapping">Tapping</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={requestClose}
                    disabled={isSubmitting}
                    className={cancelClass(isSubmitting)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className={submitClass(Boolean(name.trim() && !isSubmitting))}
                    data-testid="submit-register-button"
                  >
                    {isSubmitting ? 'Registering...' : 'Register & Proceed'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
};
