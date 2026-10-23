import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, Playstyle, AvatarType } from '../../tournament/types';
import { User, Check, X, AlertTriangle, Upload } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { PlaystyleChip } from './PlaystyleChip';
import { CountrySelect } from './CountrySelect';
import { processAvatarImage } from '../../../utils/image';

interface PlayerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Omit<PlayerProfile, 'id'>) => void;
  initialPlayer?: PlayerProfile | null;
  existingNames: string[];
}

export const PlayerEditModal: React.FC<PlayerEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPlayer,
  existingNames,
}) => {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [twitchUsername, setTwitchUsername] = useState('');
  const [country, setCountry] = useState('');
  const [avatarType, setAvatarType] = useState<AvatarType>('flag');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarThumbnailUrl, setAvatarThumbnailUrl] = useState<string | undefined>(undefined);
  const [personalBest, setPersonalBest] = useState<string>('1000000');
  const [playstyle, setPlaystyle] = useState<Playstyle>('Rolling');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialPlayer) {
      setName(initialPlayer.name);
      setDisplayName(initialPlayer.displayName || '');
      setNickname(initialPlayer.nickname || '');
      setTwitchUsername(initialPlayer.twitchUsername || '');
      setCountry(initialPlayer.country || '');
      setAvatarType(initialPlayer.avatarType || 'flag');
      setAvatarUrl(initialPlayer.avatarUrl);
      setAvatarThumbnailUrl(initialPlayer.avatarThumbnailUrl);
      setPersonalBest(String(initialPlayer.personalBest || 1000000));
      setPlaystyle(initialPlayer.playstyle || 'Rolling');
      setNotes(initialPlayer.notes || '');
      setError(null);
    } else {
      setName('');
      setDisplayName('');
      setNickname('');
      setTwitchUsername('');
      setCountry('US');
      setAvatarType('flag');
      setAvatarUrl(undefined);
      setAvatarThumbnailUrl(undefined);
      setPersonalBest('1000000');
      setPlaystyle('Rolling');
      setNotes('');
      setError(null);
    }
  }, [initialPlayer, isOpen]);


  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Player name is required.');
      return;
    }

    // Check unique name
    const isDuplicate = existingNames.some(
      n => n.toLowerCase() === trimmedName.toLowerCase() &&
           (!initialPlayer || initialPlayer.name.toLowerCase() !== trimmedName.toLowerCase())
    );
    if (isDuplicate) {
      setError(`A competitor named "${trimmedName}" already exists.`);
      return;
    }

    const pbNum = parseInt(personalBest.replace(/\D/g, ''), 10) || 0;
    const cleanTwitch = twitchUsername.trim().replace(/^@/, '');

    onSave({
      name: trimmedName,
      displayName: displayName.trim() || undefined,
      nickname: nickname.trim() || undefined,
      twitchUsername: cleanTwitch || undefined,
      country: country.trim().toUpperCase() || undefined,
      avatarType,
      avatarUrl: avatarType === 'custom' ? avatarUrl : undefined,
      avatarThumbnailUrl: avatarType === 'custom' ? avatarThumbnailUrl : undefined,
      personalBest: pbNum,
      playstyle,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-surface-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '520px',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
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
            background: 'var(--color-bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-gold-bright)',
              }}
            >
              <User size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                {initialPlayer ? `Edit Competitor: ${initialPlayer.name}` : 'Add New Competitor'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                {initialPlayer ? 'Update profile in master player directory' : 'Register new competitor in global directory'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Name & Country */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Player Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blue Scuti"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Country
                </label>
                <CountrySelect value={country} onChange={setCountry} />
              </div>
            </div>

            {/* Preferred Name & Nickname */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Preferred Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scuti"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  Displayed on brackets, cards &amp; streams (defaults to Player Name)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Nickname (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. The Prodigy"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  Moniker displayed in quotes in Master Catalog
                </div>
              </div>
            </div>

            {/* Twitch Username */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                Twitch Channel (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.82rem',
                    color: '#c084fc',
                    fontWeight: 700,
                  }}
                >
                  twitch.tv/
                </span>
                <input
                  type="text"
                  placeholder="username"
                  value={twitchUsername}
                  onChange={e => setTwitchUsername(e.target.value.replace(/^@/, ''))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 5.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                Twitch handle for live qualifier tracking &amp; broadcast profile links
              </div>
            </div>

            {/* Avatar Section */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <PlayerAvatar player={{ name, country, avatarType, avatarUrl }} size={36} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Avatar Display
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {avatarType === 'custom' && avatarUrl ? 'Custom uploaded avatar' : 'Flag badge (default)'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const res = await processAvatarImage(file);
                      setAvatarUrl(res.avatarDataUrl);
                      setAvatarThumbnailUrl(res.thumbnailDataUrl);
                      setAvatarType('custom');
                    } catch {
                      setError('Failed to process avatar image');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: avatarType === 'custom' ? 'var(--color-primary-dark, #3b82f6)' : 'var(--color-bg-base)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Upload size={14} />
                  <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                </button>

                {avatarType === 'custom' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarType('flag');
                      setAvatarUrl(undefined);
                      setAvatarThumbnailUrl(undefined);
                    }}
                    style={{
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Reset to Flag
                  </button>
                )}
              </div>
            </div>

            {/* Playstyle & Personal Best */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Playstyle
                  </label>
                  <PlaystyleChip style={playstyle} />
                </div>
                <select
                  value={playstyle}
                  onChange={e => setPlaystyle(e.target.value as Playstyle)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="Rolling">Rolling / Roll</option>
                  <option value="DAS">DAS</option>
                  <option value="Hypertap">Hypertap / Tap</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                  Personal Best (Manual)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1,200,000"
                  value={personalBest}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    setPersonalBest(cleaned);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  Strict manual PB field (never auto-overwritten)
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
                Notes / Bio (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Regional qualifier notes, team affiliation, setup notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-base)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </div>

          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn btn-primary"
              style={{
                padding: '0.55rem 1.5rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-gold)',
                opacity: !name.trim() ? 0.5 : 1,
                cursor: !name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={16} />
              {initialPlayer ? 'Save Changes' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
