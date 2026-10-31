import React, { useEffect } from 'react';
import { Tournament, TournamentTier, PlayerProfile } from '../../tournament/types';
import { BracketMatch } from '../../bracket/types';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { Trophy } from 'lucide-react';
import { colorWithAlpha } from '../../bracket/colorUtils';
import { TournamentQualTimerHud } from '../../qualifiers/components/TournamentQualTimerHud';
import { CHROMA_KEY_COLORS, DEFAULT_TIER_THEME, THEME_FALLBACK } from '../../../theme/palette';

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
      ? CHROMA_KEY_COLORS.green
      : chroma.toLowerCase() === 'magenta'
      ? CHROMA_KEY_COLORS.magenta
      : chroma.toLowerCase() === 'blue'
      ? CHROMA_KEY_COLORS.blue
      : `#${chroma}`
    : 'transparent';

  const primaryColor = resolvedTier?.primaryColor || DEFAULT_TIER_THEME.primaryColor;
  const cardColor = resolvedTier?.cardColor || THEME_FALLBACK.obsCardColor;

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
      className="w-screen h-screen flex items-center justify-center p-6"
      style={{ background: chromaBg }}
    >
      <div
        className="w-full max-w-160 rounded-lg overflow-hidden font-sans"
        style={{
          background: `linear-gradient(180deg, ${cardColor} 0%, #0c0d12 100%)`,
          border: `2px solid ${colorWithAlpha(primaryColor, 0.45)}`,
          boxShadow: `0 12px 40px rgba(0, 0, 0, 0.8), 0 0 24px ${colorWithAlpha(primaryColor, 0.2)}`,
        }}
      >
        {/* Header Bar */}
        <div
          className="py-3.5 px-5 flex items-center justify-between"
          style={{
            background: `linear-gradient(90deg, ${colorWithAlpha(primaryColor, 0.18)} 0%, rgba(0, 0, 0, 0.4) 100%)`,
            borderBottom: `1px solid ${colorWithAlpha(primaryColor, 0.3)}`,
          }}
        >
          <div className="flex items-center gap-2">
            <Trophy size={16} color={primaryColor} />
            <span className="text-sm font-extrabold text-white uppercase tracking-wide">
              {tournament.name}
            </span>
            {resolvedTier && (
              <span
                className="text-xs font-bold py-0.5 px-2 rounded-full"
                style={{
                  background: colorWithAlpha(primaryColor, 0.2),
                  color: primaryColor,
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.4)}`,
                }}
              >
                {resolvedTier.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <TournamentQualTimerHud tournament={tournament} isObsMode={true} readOnly={true} compact={true} />
            <span className="text-xs font-bold text-fg-muted">
              Best of {bestOf}
            </span>
            {isDraft && (
              <span className="text-2xs font-extrabold uppercase py-0.5 px-2 rounded-full bg-gold/25 text-gold-bright border border-gold/60 inline-flex items-center gap-1">
                <span className="size-1.25 rounded-full bg-gold-bright" />
                Projected Match
              </span>
            )}
          </div>
        </div>

        {/* Competitor Matchup Grid */}
        <div className="py-5 px-6 flex items-center gap-4">
          {/* Player 1 */}
          <div className="flex-1 flex items-center gap-3.5">
            {p1Profile ? (
              <PlayerAvatar player={p1Profile} size={44} country={p1Profile.country} />
            ) : (
              <div className="size-11 rounded-full bg-white/8 flex items-center justify-center text-fg-muted font-bold">
                1
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {targetMatch?.player1?.player?.seed && (
                  <span className="text-xs font-extrabold" style={{ color: primaryColor }}>
                    #{targetMatch.player1.player.seed}
                  </span>
                )}
                <span className="text-base font-extrabold text-white truncate">
                  {getEffectivePlayerName(p1Profile || p1) || (targetMatch?.slotA ? `Seed ${targetMatch.slotA}` : 'TBD')}
                </span>
              </div>
            </div>
          </div>

          {/* Center VS & Score Pill */}
          <div className="flex flex-col items-center gap-1.5 px-2">
            <div className="inline-flex items-center gap-2 bg-black/60 border border-white/12 rounded-md py-1.5 px-3.5 font-mono text-xl font-black text-white tracking-wider">
              <span className="text-white" style={{ color: p1Wins > p2Wins ? primaryColor : undefined }}>{p1Wins}</span>
              <span className="opacity-40 text-base">-</span>
              <span className="text-white" style={{ color: p2Wins > p1Wins ? primaryColor : undefined }}>{p2Wins}</span>
            </div>
            <div className="text-2xs font-bold text-fg-muted uppercase tracking-widest">
              {targetMatch?.roundIdentifier || 'Match'}
            </div>
          </div>

          {/* Player 2 */}
          <div className="flex-1 flex items-center justify-end gap-3.5 text-right">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <span className="text-base font-extrabold text-white truncate">
                  {getEffectivePlayerName(p2Profile || p2) || (targetMatch?.slotB ? `Seed ${targetMatch.slotB}` : 'TBD')}
                </span>
                {targetMatch?.player2?.player?.seed && (
                  <span className="text-xs font-extrabold" style={{ color: primaryColor }}>
                    #{targetMatch.player2.player.seed}
                  </span>
                )}
              </div>
            </div>
            {p2Profile ? (
              <PlayerAvatar player={p2Profile} size={44} country={p2Profile.country} />
            ) : (
              <div className="size-11 rounded-full bg-white/8 flex items-center justify-center text-fg-muted font-bold">
                2
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
