import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, ExternalLink, BarChart3 } from 'lucide-react';
import type { OnlineQualSessionSummary } from '../../../api/qualifiers';
import { Button } from '../../../components/ui';

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
      className="flex flex-col gap-6 rounded-lg border-2 border-green-500/40 bg-surface p-8 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      data-testid="awaiting-verification-card"
    >
      {/* Top Banner */}
      <div className="flex items-center gap-3.5">
        <div className="flex size-11.5 shrink-0 items-center justify-center rounded-full border border-green-500/40 bg-green-500/15 text-green-400">
          <CheckCircle2 size={26} />
        </div>
        <div>
          <h3 className="m-0 text-xl font-black text-white">
            {headerTitle}
          </h3>
          <p className="mx-0 mt-1 mb-0 text-sm text-fg-secondary">
            Your submission has been securely recorded and locked against further edits.
          </p>
        </div>
      </div>

      {/* Provisional Leaderboard Status Pill */}
      <div className="flex items-center gap-3 rounded-md border border-gold/35 bg-gold/10 px-5 py-4">
        <Clock size={20} color="#fbbf24" className="shrink-0" />
        <div className="text-sm leading-normal text-[#fef3c7]">
          <strong>Provisional Placement:</strong> Your run is displayed on the public leaderboard marked{' '}
          <span className="rounded-xs border border-gold/40 bg-canvas px-2 py-0.5 font-mono text-caption font-bold text-gold-bright">
            ⏳ Awaiting Verification
          </span>
          . Tournament adjudicators will verify your NES Authword and stream recording.
        </div>
      </div>

      {/* Submission Audit Summary Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 rounded-md border border-line bg-canvas p-5">
        <div>
          <div className="text-caption uppercase text-fg-secondary">
            Assigned Authword
          </div>
          <div className="mt-1 font-mono text-xl font-black tracking-widest text-gold-bright">
            {session.authWord}
          </div>
        </div>

        <div>
          <div className="text-caption uppercase text-fg-secondary">
            Submitted Scores
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-white">
            {session.scores.length > 0 ? session.scores.map(s => s.toLocaleString()).join(', ') : 'None'}
          </div>
        </div>

        {session.twitchVodUrl && (
          <div className="col-span-2">
            <div className="text-caption uppercase text-fg-secondary">
              Broadcast VOD Link
            </div>
            <a
              href={session.twitchVodUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 break-all text-sm text-sky-400 no-underline"
            >
              <span>{session.twitchVodUrl}</span>
              <ExternalLink size={14} className="shrink-0" />
            </a>
          </div>
        )}
      </div>

      {/* Action Links */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
        {onDone && (
          <Button
            type="button"
            onClick={onDone}
            variant="secondary"
            className="gap-2 rounded-md px-5 py-3 text-base font-bold"
            data-testid="qual-done-button"
          >
            Done / Qualify Another Player
          </Button>
        )}
        <Link
          to={`/${tournamentSlug}/leaderboard`}
          className="inline-flex items-center gap-2 rounded-md bg-gold-bright px-6 py-3 text-base font-extrabold text-black no-underline"
          data-testid="view-leaderboard-link"
        >
          <BarChart3 size={18} />
          View Live Leaderboard
        </Link>
      </div>
    </div>
  );
};
