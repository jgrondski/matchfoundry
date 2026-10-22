import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, ExternalLink, BarChart3 } from 'lucide-react';
import type { OnlineQualSessionSummary } from '../../../api/qualifiers';

export interface AwaitingVerificationCardProps {
  session: OnlineQualSessionSummary;
  tournamentSlug: string;
  playerName?: string;
  onDone?: () => void;
}

export const AwaitingVerificationCard: React.FC<AwaitingVerificationCardProps> = ({
  session,
  tournamentSlug,
  playerName,
  onDone,
}) => {
  const displayName = playerName || session.playerName;
  const headerTitle = displayName
    ? `${displayName}: Official Qual Submitted`
    : 'Official Qual Submitted';

  return (
    <div
      style={{
        background: 'var(--color-bg-surface, #121820)',
        border: '2px solid rgba(34, 197, 94, 0.4)',
        borderRadius: '14px',
        padding: '2rem',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
      data-testid="awaiting-verification-card"
    >
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4ade80',
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={26} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#ffffff' }}>
            {headerTitle}
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
            Your submission has been securely recorded and locked against further edits.
          </p>
        </div>
      </div>

      {/* Provisional Leaderboard Status Pill */}
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <Clock size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.9rem', color: '#fef3c7', lineHeight: 1.5 }}>
          <strong>Provisional Placement:</strong> Your run is displayed on the public leaderboard marked{' '}
          <span
            style={{
              background: '#090d13',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: '0.82rem',
            }}
          >
            ⏳ Awaiting Verification
          </span>
          . Tournament adjudicators will verify your NES Authword and stream recording.
        </div>
      </div>

      {/* Submission Audit Summary Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          background: 'var(--color-bg-base, #0a0e14)',
          border: '1px solid var(--color-border, #263342)',
          borderRadius: '10px',
          padding: '1.25rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
            Assigned Authword
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '1.25rem',
              fontWeight: 900,
              color: 'var(--color-gold-bright, #fbbf24)',
              letterSpacing: '0.1em',
              marginTop: '0.2rem',
            }}
          >
            {session.authWord}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
            Submitted Scores
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '1.15rem',
              fontWeight: 700,
              color: '#ffffff',
              marginTop: '0.2rem',
            }}
          >
            {session.scores.length > 0 ? session.scores.map(s => s.toLocaleString()).join(', ') : 'None'}
          </div>
        </div>

        {session.twitchVodUrl && (
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
              Broadcast VOD Link
            </div>
            <a
              href={session.twitchVodUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#38bdf8',
                fontSize: '0.88rem',
                textDecoration: 'none',
                marginTop: '0.25rem',
                wordBreak: 'break-all',
              }}
            >
              <span>{session.twitchVodUrl}</span>
              <ExternalLink size={14} style={{ flexShrink: 0 }} />
            </a>
          </div>
        )}
      </div>

      {/* Action Links */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="btn btn-secondary"
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            data-testid="qual-done-button"
          >
            Done / Qualify Another Player
          </button>
        )}
        <Link
          to={`/${tournamentSlug}/leaderboard`}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            background: 'var(--color-gold-bright, #f59e0b)',
            color: '#000000',
            fontWeight: 800,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.92rem',
          }}
          data-testid="view-leaderboard-link"
        >
          <BarChart3 size={18} />
          View Live Leaderboard
        </Link>
      </div>
    </div>
  );
};
