import React, { useState, useEffect, useId } from 'react';
import { Overlay } from '../../../components/overlay';
import { Button, buttonClasses } from '../../../components/ui';
import QRCode from 'qrcode';
import { Tournament, TournamentTier } from '../../tournament/types';
import { getDefaultTierColors, colorWithAlpha } from '../colorUtils';
import {
  X,
  Copy,
  Check,
  QrCode,
  Share2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ShareBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  tier?: TournamentTier;
}

export const ShareBracketModal: React.FC<ShareBracketModalProps> = ({
  isOpen,
  onClose,
  tournament,
  tier,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const resolvedTier = tier || tournament.tiers[0];
  const defaults = resolvedTier
    ? getDefaultTierColors(resolvedTier)
    : {
        primaryColor: '#ffc905',
        secondaryColor: '#705b33',
        cardColor: '#161922',
        textColor: '#94A3B8',
        backgroundColor: '#020203',
      };
  const primaryColor = resolvedTier?.primaryColor || defaults.primaryColor || '#f59e0b';
  const secondaryColor = resolvedTier?.secondaryColor || defaults.secondaryColor || '#705b33';
  const cardColor = resolvedTier?.cardColor || defaults.cardColor || '#161922';

  // Construct canonical public spectator URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = resolvedTier
    ? `${origin}/${tournament.slug}/${resolvedTier.slug}`
    : `${origin}/${tournament.slug}/brackets`;
  const cleanDisplayUrl = resolvedTier
    ? `${origin.replace(/^https?:\/\//, '')}/${tournament.slug}/${resolvedTier.slug}`
    : `${origin.replace(/^https?:\/\//, '')}/${tournament.slug}/brackets`;

  // Generate high-resolution QR code Data URL on mount/open
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(publicUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#090d16',
        light: '#ffffff',
      },
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Failed to generate QR code', err));
  }, [isOpen, publicUrl]);

  const titleId = useId();

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const twitchCommandText = `!bracket ${publicUrl}`;
  const discordMarkdownText = resolvedTier
    ? `[🏆 ${tournament.name} • ${resolvedTier.name} Bracket](${publicUrl})`
    : `[🏆 ${tournament.name} • Live Bracket](${publicUrl})`;
  const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    resolvedTier
      ? `Check out the live bracket for ${tournament.name} (${resolvedTier.name} Tier)!`
      : `Check out the live bracket for ${tournament.name}!`
  )}&url=${encodeURIComponent(publicUrl)}`;

  return (
    <Overlay
      open
      onClose={onClose}
      aria-labelledby={titleId}
      panelClassName="flex max-w-130 max-h-[92vh] flex-col overflow-hidden rounded-lg"
      panelStyle={{
        background: cardColor,
        border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-border)')}`,
        boxShadow: `0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px ${colorWithAlpha(primaryColor, 0.15)}`,
      }}
    >
      {({ requestClose }) => (
        <>
          {/* Ambient Top Glow Stripe */}
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
            }}
          />

          {/* Modal Header */}
          <div className="py-5 px-6 border-b border-line flex justify-between items-start bg-white/2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-extrabold uppercase tracking-widest flex items-center gap-1"
                  style={{ color: primaryColor }}
                >
                  <Layers size={13} />
                  {resolvedTier ? `${resolvedTier.name} Tier Bracket` : 'Tournament Portal'}
                </span>
                <span className="text-line-subtle text-xs">•</span>
                <span className="text-xs font-semibold text-fg-secondary">
                  Public Spectator Link
                </span>
              </div>
              <h2
                id={titleId}
                className="text-xl font-extrabold text-white m-0 tracking-tight flex items-center gap-2"
              >
                <Share2 size={20} color={primaryColor} />
                Share Tournament Bracket
              </h2>
            </div>

            <button
              type="button"
              onClick={requestClose}
              className="bg-white/5 border border-line text-fg-muted cursor-pointer p-1.5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0"
              title="Close (Esc)"
              aria-label="Close share bracket modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="py-5 px-6 overflow-y-auto flex flex-col gap-5">
            {/* Section 1: Canonical Public Link */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Canonical Spectator URL</label>
              <div className="flex items-center gap-2 bg-black/40 border border-line rounded-md py-1.5 pr-2.5 pl-3.5">
                <span className="flex-1 font-mono text-sm text-gold-bright truncate">
                  {cleanDisplayUrl}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => copyToClipboard(publicUrl, 'main-url')}
                >
                  {copiedKey === 'main-url' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'main-url' ? 'Copied!' : 'Copy Link'}</span>
                </Button>
              </div>
              <span className="text-xs text-fg-muted mt-0.5 mr-0 mb-0 ml-0.5">
                Visitors on this URL receive an interactive, real-time read-only bracket without edit permissions.
              </span>
            </div>

            {/* Section 2: QR Code for Venue Spectators */}
            <div className="flex flex-col items-center p-5 rounded-md bg-black/25 border border-line-subtle gap-3">
              <div className="flex items-center gap-2">
                <QrCode size={16} color={primaryColor} />
                <span className="text-caption font-bold text-fg">
                  Venue Smartphone QR Code
                </span>
              </div>

              {/* QR Image Box */}
              <div className="p-2.5 rounded-md bg-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${tournament.name} ${resolvedTier?.name || ''} bracket`}
                    className="size-45 block"
                  />
                ) : (
                  <div className="size-45 flex items-center justify-center text-[#666]">
                    Generating QR...
                  </div>
                )}
              </div>

              <span className="text-xs text-fg-muted text-center max-w-75">
                Scan with any iPhone or Android camera to open this bracket on mobile.
              </span>
            </div>

            {/* Section 3: Quick Broadcast & Community Snippets */}
            <div className="flex flex-col gap-2.5">
              <label className={labelClass}>Quick Community Snippets</label>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
                {/* Twitch Chat Snippet */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(twitchCommandText, 'twitch-cmd')}
                  className={snippetBtnClass}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} color="#a855f7" />
                    <span className="text-caption font-bold text-fg">
                      Twitch Chat Command
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <span>{copiedKey === 'twitch-cmd' ? 'Copied to clipboard!' : twitchCommandText}</span>
                    {copiedKey === 'twitch-cmd' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  </div>
                </button>

                {/* Discord Markdown */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(discordMarkdownText, 'discord-md')}
                  className={snippetBtnClass}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} color="#38bdf8" />
                    <span className="text-caption font-bold text-fg">
                      Discord Markdown Link
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <span>{copiedKey === 'discord-md' ? 'Copied to clipboard!' : '[Tournament] Link'}</span>
                    {copiedKey === 'discord-md' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="py-3.5 px-6 border-t border-line bg-white/2 flex justify-between items-center">
            <a
              href={twitterIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({
                variant: 'secondary',
                className: 'text-caption gap-1.5 hover:bg-highlight hover:border-fg-secondary',
              })}
            >
              <ExternalLink size={13} />
              <span>Post to X / Twitter</span>
            </a>

            <Button variant="secondary" onClick={requestClose} className="text-caption py-2 px-4.5">
              Done
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};

const labelClass = 'text-xs font-bold uppercase tracking-wider text-fg-muted';
const snippetBtnClass =
  'flex flex-col items-start gap-1.5 py-2.5 px-3.5 rounded-sm bg-white/3 border border-line-subtle cursor-pointer text-left transition-all duration-150';
