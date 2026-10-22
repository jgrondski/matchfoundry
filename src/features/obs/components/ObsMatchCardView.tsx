import React, { useEffect } from 'react';
import { Tournament, TournamentTier, PlayerProfile } from '../../tournament/types';
import { BracketMatch } from '../../bracket/types';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { Trophy } from 'lucide-react';
import { colorWithAlpha } from '../../bracket/colorUtils';
import { TournamentQualTimerHud } from '../../qualifiers/components/TournamentQualTimerHud';

export interface ObsMatchCardViewProps {
  tournament: Tournament;
  tier?: TournamentTier;
  match?: BracketMatch;
  matchId?: string;
  chroma?: string | null;
}

export const ObsMatchCardView: React.FC<ObsMatchCardViewProps> = ({
  tournament,
  tier,
  match,
  matchId,
  chroma = null,
}) => {
  useEffect(() => {
    document.body.classList.add('obs-overlay-mode');
    return () => {
      document.body.classList.remove('obs-overlay-mode');
    };
  }, []);

  // Find match if matchId provided
  const targetMatch: BracketMatch | undefined = React.useMemo(() => {
    if (match) return match;
    if (!matchId) return undefined;
    if (tier?.bracket?.matchesById?.[matchId]) {
      return tier.bracket.matchesById[matchId];
    }
    for (const t of tournament.tiers) {
      if (t.bracket?.matchesById?.[matchId]) {
        return t.bracket.matchesById[matchId];
      }
    }
    return undefined;
  }, [match, matchId, tier, tournament]);

  const resolvedTier: TournamentTier | undefined = React.useMemo(() => {
    if (tier) return tier;
    if (!targetMatch) return tournament.tiers[0];
    return tournament.tiers.find(t => t.id === targetMatch.tierId) || tournament.tiers[0];
  }, [tier, targetMatch, tournament]);

  const scoreRecord = targetMatch ? tournament.matchScores[targetMatch.id] : undefined;
  const isDraft = !tournament.isLocked;

  const chromaBg = chroma
    ? chroma.startsWith('#')
      ? chroma
      : chroma.toLowerCase() === 'green'
      ? '#00ff00'
      : chroma.toLowerCase() === 'magenta'
      ? '#ff00ff'
      : chroma.toLowerCase() === 'blue'
      ? '#0000ff'
      : `#${chroma}`
    : 'transparent';

  const primaryColor = resolvedTier?.primaryColor || '#ffc905';
  const cardColor = resolvedTier?.cardColor || '#141824';

  const p1 = targetMatch?.player1?.player;
  const p2 = targetMatch?.player2?.player;
  const p1Wins = scoreRecord?.player1Wins ?? 0;
  const p2Wins = scoreRecord?.player2Wins ?? 0;
  const bestOf = scoreRecord?.bestOf || targetMatch?.bestOf || resolvedTier?.bestOf || 3;

  const p1Profile: PlayerProfile | undefined = p1
    ? (tournament.playersPool || []).find(p => p.id === p1.id) || {
        id: p1.id,
        name: p1.name,
        country: p1.country,
        personalBest: 0,
        playstyle: 'Rolling',
      }
    : undefined;

  const p2Profile: PlayerProfile | undefined = p2
    ? (tournament.playersPool || []).find(p => p.id === p2.id) || {
        id: p2.id,
        name: p2.name,
        country: p2.country,
        personalBest: 0,
        playstyle: 'Rolling',
      }
    : undefined;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: chromaBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          background: `linear-gradient(180deg, ${cardColor} 0%, #0c0d12 100%)`,
          border: `2px solid ${colorWithAlpha(primaryColor, 0.45)}`,
          borderRadius: '16px',
          boxShadow: `0 12px 40px rgba(0, 0, 0, 0.8), 0 0 24px ${colorWithAlpha(primaryColor, 0.2)}`,
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: `linear-gradient(90deg, ${colorWithAlpha(primaryColor, 0.18)} 0%, rgba(0, 0, 0, 0.4) 100%)`,
            borderBottom: `1px solid ${colorWithAlpha(primaryColor, 0.3)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={16} color={primaryColor} />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {tournament.name}
            </span>
            {resolvedTier && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.12rem 0.5rem',
                  borderRadius: '999px',
                  background: colorWithAlpha(primaryColor, 0.2),
                  color: primaryColor,
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.4)}`,
                }}
              >
                {resolvedTier.name}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TournamentQualTimerHud tournament={tournament} isObsMode={true} readOnly={true} compact={true} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted, #94a3b8)' }}>
              Best of {bestOf}
            </span>
            {isDraft && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '0.12rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(245, 158, 11, 0.25)',
                  color: 'var(--color-gold-bright, #ffc905)',
                  border: '1px solid rgba(245, 158, 11, 0.6)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-gold-bright, #ffc905)' }} />
                Projected Match
              </span>
            )}
          </div>
        </div>

        {/* Competitor Matchup Grid */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Player 1 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {p1Profile ? (
              <PlayerAvatar player={p1Profile} size={44} country={p1Profile.country} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 700 }}>
                1
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                {targetMatch?.player1?.player?.seed && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: primaryColor }}>
                    #{targetMatch.player1.player.seed}
                  </span>
                )}
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getEffectivePlayerName(p1Profile || p1) || (targetMatch?.slotA ? `Seed ${targetMatch.slotA}` : 'TBD')}
                </span>
              </div>
            </div>
          </div>

          {/* Center VS & Score Pill */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: '0 0.5rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '0.35rem 0.85rem',
                fontFamily: 'monospace',
                fontSize: '1.35rem',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ color: p1Wins > p2Wins ? primaryColor : '#ffffff' }}>{p1Wins}</span>
              <span style={{ opacity: 0.4, fontSize: '1rem' }}>-</span>
              <span style={{ color: p2Wins > p1Wins ? primaryColor : '#ffffff' }}>{p2Wins}</span>
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {targetMatch?.roundIdentifier || 'Match'}
            </div>
          </div>

          {/* Player 2 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.85rem', textAlign: 'right' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getEffectivePlayerName(p2Profile || p2) || (targetMatch?.slotB ? `Seed ${targetMatch.slotB}` : 'TBD')}
                </span>
                {targetMatch?.player2?.player?.seed && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: primaryColor }}>
                    #{targetMatch.player2.player.seed}
                  </span>
                )}
              </div>
            </div>
            {p2Profile ? (
              <PlayerAvatar player={p2Profile} size={44} country={p2Profile.country} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 700 }}>
                2
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
