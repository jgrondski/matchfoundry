import React, { useState, useEffect, useRef, useId } from 'react';
import { PlayerProfile, Playstyle, AvatarType } from '../../tournament/types';
import { User, Check, X, AlertTriangle, Upload } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { PlaystyleChip } from './PlaystyleChip';
import { CountrySelect } from './CountrySelect';
import { processAvatarImage } from '../../../utils/image';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton, cn } from '../../../components/ui';

const labelClass = 'mb-1.5 block text-caption font-semibold text-fg';
const inputClass = 'w-full rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-sm text-fg';
const hintClass = 'mt-1 text-2xs text-fg-muted';

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
  const initialRef = useRef<Record<string, unknown>>({});
  const titleId = useId();

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
      initialRef.current = {
        name: initialPlayer.name,
        displayName: initialPlayer.displayName || '',
        nickname: initialPlayer.nickname || '',
        twitchUsername: initialPlayer.twitchUsername || '',
        country: initialPlayer.country || '',
        avatarType: initialPlayer.avatarType || 'flag',
        avatarUrl: initialPlayer.avatarUrl,
        avatarThumbnailUrl: initialPlayer.avatarThumbnailUrl,
        personalBest: String(initialPlayer.personalBest || 1000000),
        playstyle: initialPlayer.playstyle || 'Rolling',
        notes: initialPlayer.notes || '',
      };
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
      initialRef.current = {
        name: '',
        displayName: '',
        nickname: '',
        twitchUsername: '',
        country: 'US',
        avatarType: 'flag',
        avatarUrl: undefined,
        avatarThumbnailUrl: undefined,
        personalBest: '1000000',
        playstyle: 'Rolling',
        notes: '',
      };
    }
  }, [initialPlayer, isOpen]);

  const currentValues = {
    name,
    displayName,
    nickname,
    twitchUsername,
    country,
    avatarType,
    avatarUrl,
    avatarThumbnailUrl,
    personalBest,
    playstyle,
    notes,
  };
  const isDirty = JSON.stringify(currentValues) !== JSON.stringify(initialRef.current);


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
    <Overlay
      open
      onClose={onClose}
      dirty={isDirty}
      aria-labelledby={titleId}
      panelClassName="max-w-130 overflow-hidden rounded-lg border border-line bg-elevated shadow-xl"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold-bright">
                <User size={18} />
              </div>
              <div>
                <h3 id={titleId} className="m-0 text-lg font-bold text-fg">
                  {initialPlayer ? `Edit Competitor: ${initialPlayer.name}` : 'Add New Competitor'}
                </h3>
                <p className="m-0 text-xs text-fg-muted">
                  {initialPlayer ? 'Update profile in master player directory' : 'Register new competitor in global directory'}
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-5 p-6">
              {error && (
                <div className="flex items-center gap-2 rounded-sm border border-red/40 bg-red/15 px-4 py-3 text-sm text-red-bright">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Name & Country */}
              <div className="grid grid-cols-[2fr_1fr] gap-4">
                <div>
                  <label className={labelClass}>
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
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Country
                  </label>
                  <CountrySelect value={country} onChange={setCountry} />
                </div>
              </div>

              {/* Preferred Name & Nickname */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Preferred Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scuti"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className={inputClass}
                  />
                  <div className={hintClass}>
                    Displayed on brackets, cards &amp; streams (defaults to Player Name)
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Nickname (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. The Prodigy"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className={inputClass}
                  />
                  <div className={hintClass}>
                    Moniker displayed in quotes in Master Catalog
                  </div>
                </div>
              </div>

              {/* Twitch Username */}
              <div>
                <label className={labelClass}>
                  Twitch Channel (Optional)
                </label>
                <div className="relative">
                  <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-caption font-bold text-purple-400">
                    twitch.tv/
                  </span>
                  <input
                    type="text"
                    placeholder="username"
                    value={twitchUsername}
                    onChange={e => setTwitchUsername(e.target.value.replace(/^@/, ''))}
                    className="w-full rounded-sm border border-line bg-canvas py-2.5 pr-3.5 pl-22.5 text-sm text-fg"
                  />
                </div>
                <div className={hintClass}>
                  Twitch handle for live qualifier tracking &amp; broadcast profile links
                </div>
              </div>

              {/* Avatar Section */}
              <div className="flex items-center justify-between gap-4 rounded-sm border border-line bg-white/2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <PlayerAvatar player={{ name, country, avatarType, avatarUrl }} size={36} />
                  <div>
                    <div className="text-sm font-semibold text-fg">
                      Avatar Display
                    </div>
                    <div className="text-xs text-fg-muted">
                      {avatarType === 'custom' && avatarUrl ? 'Custom uploaded avatar' : 'Flag badge (default)'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
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
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-caption font-semibold text-white',
                      avatarType === 'custom' ? 'bg-blue-500' : 'bg-canvas'
                    )}
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
                      className="cursor-pointer rounded-sm border border-line bg-transparent px-2.5 py-1.5 text-xs text-fg-muted"
                    >
                      Reset to Flag
                    </button>
                  )}
                </div>
              </div>

              {/* Playstyle & Personal Best */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-caption font-semibold text-fg">
                      Playstyle
                    </label>
                    {/* eslint-disable-next-line no-restricted-syntax -- runtime: PlaystyleChip prop is named style */}
                    <PlaystyleChip style={playstyle} />
                  </div>
                  <select
                    value={playstyle}
                    onChange={e => setPlaystyle(e.target.value as Playstyle)}
                    className={inputClass}
                  >
                    <option value="Rolling">Rolling / Roll</option>
                    <option value="DAS">DAS</option>
                    <option value="Hypertap">Hypertap / Tap</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
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
                    className={cn(inputClass, 'font-mono')}
                  />
                  <div className={hintClass}>
                    Strict manual PB field (never auto-overwritten)
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>
                  Notes / Bio (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Regional qualifier notes, team affiliation, setup notes..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full resize-y rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-sm text-fg"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-line bg-surface px-6 py-4">
              <Button
                variant="secondary"
                onClick={requestClose}
                className="px-5 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!name.trim()}
                className="px-6 py-2 text-sm shadow-gold"
              >
                <Check size={16} />
                {initialPlayer ? 'Save Changes' : 'Add Player'}
              </Button>
            </div>
          </form>
        </>
      )}
    </Overlay>
  );
};
