import React, { useState, useEffect, useId } from 'react';
import { Overlay } from '../../../components/overlay';
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
            style={{
              height: '4px',
              width: '100%',
              background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
            }}
          />

          {/* Modal Header */}
          <div style={headerStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: primaryColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Layers size={13} />
                  {resolvedTier ? `${resolvedTier.name} Tier Bracket` : 'Tournament Portal'}
                </span>
                <span style={{ color: 'var(--color-border-subtle)', fontSize: '0.75rem' }}>•</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Public Spectator Link
                </span>
              </div>
              <h2
                id={titleId}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Share2 size={20} color={primaryColor} />
                Share Tournament Bracket
              </h2>
            </div>

            <button
              type="button"
              onClick={requestClose}
              style={closeBtnStyle}
              title="Close (Esc)"
              aria-label="Close share bracket modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div style={bodyStyle}>
            {/* Section 1: Canonical Public Link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Canonical Spectator URL</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.4rem 0.65rem 0.4rem 0.85rem',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    color: 'var(--color-gold-bright)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cleanDisplayUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(publicUrl, 'main-url')}
                  className="btn btn-primary"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    gap: '0.35rem',
                  }}
                >
                  {copiedKey === 'main-url' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'main-url' ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.1rem 0 0 0.1rem' }}>
                Visitors on this URL receive an interactive, real-time read-only bracket without edit permissions.
              </span>
            </div>

            {/* Section 2: QR Code for Venue Spectators */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--color-border-subtle)',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <QrCode size={16} color={primaryColor} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Venue Smartphone QR Code
                </span>
              </div>

              {/* QR Image Box */}
              <div
                style={{
                  padding: '0.65rem',
                  borderRadius: 'var(--radius-md)',
                  background: '#ffffff',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${tournament.name} ${resolvedTier?.name || ''} bracket`}
                    style={{ width: '180px', height: '180px', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    Generating QR...
                  </div>
                )}
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '300px' }}>
                Scan with any iPhone or Android camera to open this bracket on mobile.
              </span>
            </div>

            {/* Section 3: Quick Broadcast & Community Snippets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <label style={labelStyle}>Quick Community Snippets</label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
                {/* Twitch Chat Snippet */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(twitchCommandText, 'twitch-cmd')}
                  style={snippetBtnStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <MessageSquare size={14} color="#a855f7" />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Twitch Chat Command
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    <span>{copiedKey === 'twitch-cmd' ? 'Copied to clipboard!' : twitchCommandText}</span>
                    {copiedKey === 'twitch-cmd' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  </div>
                </button>

                {/* Discord Markdown */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(discordMarkdownText, 'discord-md')}
                  style={snippetBtnStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Sparkles size={14} color="#38bdf8" />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Discord Markdown Link
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    <span>{copiedKey === 'discord-md' ? 'Copied to clipboard!' : '[Tournament] Link'}</span>
                    {copiedKey === 'discord-md' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={footerStyle}>
            <a
              href={twitterIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <ExternalLink size={13} />
              <span>Post to X / Twitter</span>
            </a>

            <button
              type="button"
              onClick={requestClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
            >
              Done
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};

const headerStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid var(--color-border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  background: 'rgba(255, 255, 255, 0.02)',
  gap: '1rem',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '0.4rem',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const footerStyle: React.CSSProperties = {
  padding: '0.9rem 1.5rem',
  borderTop: '1px solid var(--color-border)',
  background: 'rgba(255, 255, 255, 0.02)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-text-muted)',
};

const snippetBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '0.35rem',
  padding: '0.65rem 0.85rem',
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid var(--color-border-subtle)',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.15s ease',
};
