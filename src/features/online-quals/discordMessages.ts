import { summarizeQualScores, type QualFormatConfig } from '../qualifiers/qualSummary';

export type QualDiscordEvent = 'START' | 'SUBMIT' | 'VERIFIED';

export type { QualFormatConfig };

export const SITE_URL = 'https://matchfoundry.gg';

// Keeps a submission post well under Discord's 2,000-character message limit.
export const PLAYER_NOTES_MAX_LENGTH = 1000;

export interface QualDiscordMessageInput {
  tournamentName: string;
  tournamentSlug?: string;
  format: QualFormatConfig;
  playerName: string;
  twitchUsername?: string;
  authWord?: string;
  twitchVodUrl?: string;
  scores?: number[];
  judgeName?: string;
  playerNotes?: string;
}

const DISCORD_WEBHOOK_PATTERN = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/i;

/** Only real Discord webhook URLs are ever posted to (the server must not become a generic HTTP relay). */
export function isDiscordWebhookUrl(url: unknown): url is string {
  return typeof url === 'string' && DISCORD_WEBHOOK_PATTERN.test(url.trim());
}

/** Escapes Discord markdown so player/tournament names can't break or hijack message formatting. */
export function escapeDiscordMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>[\]()])/g, '\\$1');
}

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Qual result in the tournament's format:
 * - # of Maxes: max count plus kicker (kicker alone when there are no maxes)
 * - Average of X: the average plus every score
 * - Points: total plus a per-score breakdown (kicker alone when no points were earned)
 */
export function formatQualResult(format: QualFormatConfig, scores: number[]): string {
  const summary = summarizeQualScores(format, scores);
  if (!summary) return 'No scores recorded';

  if (summary.kind === 'MAXES') {
    const { maxoutCount, kickerScore } = summary;
    if (maxoutCount === 0) return `Kicker: **${fmt(kickerScore)}**`;
    return kickerScore > 0 ? `**${maxoutCount}x Max** (Kicker: ${fmt(kickerScore)})` : `**${maxoutCount}x Max**`;
  }

  if (summary.kind === 'AVERAGE') {
    return [`**${fmt(summary.average)}** average (Ao${summary.targetCount})`, ...summary.scores.map(s => `- ${fmt(s)}`)].join('\n');
  }

  if (summary.totalPoints === 0) return `Kicker: **${fmt(summary.kickerScore)}**`;
  return [
    `**${summary.totalPoints} pts**`,
    ...summary.breakdown.map(({ score, points }) => `- ${fmt(score)} (${points} pts)`),
  ].join('\n');
}

export function buildQualDiscordMessage(event: QualDiscordEvent, input: QualDiscordMessageInput): string {
  const player = `**${escapeDiscordMarkdown(input.playerName)}**`;
  const tourney = `**${escapeDiscordMarkdown(input.tournamentName)}**`;

  if (event === 'START') {
    const watch = input.twitchUsername ? ` Watch live: https://twitch.tv/${input.twitchUsername}` : '';
    const authWord = input.authWord ? ` (Authword: \`${input.authWord}\`)` : '';
    return `🎮 ${player} started an official qual for ${tourney}!${watch}${authWord}`;
  }

  const result = formatQualResult(input.format, input.scores || []);
  if (event === 'SUBMIT') {
    const vod = input.twitchVodUrl ? `\nVOD: ${input.twitchVodUrl}` : '';
    // Angle brackets stop Discord from adding a link preview card under every submission.
    const standings = input.tournamentSlug ? `\nQualifiers: <${SITE_URL}/${input.tournamentSlug}/leaderboard>` : '';
    const notes = input.playerNotes?.trim()
      ? `\nNotes:\n${input.playerNotes
          .trim()
          .split(/\r?\n/)
          .map(line => `> ${escapeDiscordMarkdown(line)}`)
          .join('\n')}`
      : '';
    return `🏆 ${player} submitted their qual for ${tourney}: ${result}${vod}${notes}${standings}`;
  }

  const judge = input.judgeName ? ` by ${escapeDiscordMarkdown(input.judgeName)}` : '';
  return `✓ ${player}'s qual for ${tourney} was verified${judge}: ${result}`;
}
