import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { ReviewQueueCardList } from '../components/ReviewQueueCardList';

const submittedAt = Date.UTC(2026, 10, 1, 15, 42);

function session(overrides: Partial<ReviewQueueSessionSummary> = {}): ReviewQueueSessionSummary {
  return {
    tournamentId: 't-1',
    playerId: 'p-1',
    playerName: 'Card Player',
    submissionSource: 'ONLINE',
    status: 'SUBMITTED',
    authWord: 'ROCKET',
    twitchVodUrl: null,
    submittedTwitchId: null,
    submittedTwitchUsername: 'cardplayer',
    identityStatus: 'VERIFIED_MATCH',
    timerLog: { startedAt: submittedAt - 3600_000, elapsedSeconds: 3600, pauses: [] },
    scores: [900000],
    judgeNotes: null,
    submissionIds: ['s-1'],
    runId: 'r-1',
    submittedAt,
    verifiedBy: null,
    verifiedAt: null,
    ...overrides,
  };
}

const render = (
  sessions: ReviewQueueSessionSummary[],
  onDiscardRun?: (s: ReviewQueueSessionSummary) => void
) =>
  renderToStaticMarkup(
    <ReviewQueueCardList
      sessions={sessions}
      onOpenAdjudicate={() => {}}
      onOpenIdentityModal={() => {}}
      onDiscardRun={onDiscardRun}
      qualWindowMinutes={90}
    />
  );

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('ReviewQueueCardList', () => {
  it('renders every session name with a Review button', () => {
    const html = render([
      session({ playerId: 'p-1', playerName: 'Alpha Card' }),
      session({ playerId: 'p-2', playerName: 'Bravo Card', runId: 'r-2' }),
      session({ playerId: 'p-3', playerName: 'Charlie Card', runId: 'r-3', status: 'VERIFIED' }),
    ]);
    expect(html).toContain('Alpha Card');
    expect(html).toContain('Bravo Card');
    expect(html).toContain('Charlie Card');
    expect(count(html, '>Review</button>')).toBe(3);
  });

  it('shows Discard only for an IN_PROGRESS session when onDiscardRun is passed', () => {
    const sessions = [
      session({ playerId: 'p-1', playerName: 'Running Card', status: 'IN_PROGRESS', submittedAt: null }),
      session({ playerId: 'p-2', playerName: 'Submitted Card', runId: 'r-2' }),
    ];
    const withDiscard = render(sessions, () => {});
    expect(count(withDiscard, 'data-testid="discard-run-button"')).toBe(1);
    expect(withDiscard.indexOf('Discard')).toBeGreaterThan(withDiscard.indexOf('Running Card'));
    expect(withDiscard.indexOf('Discard')).toBeLessThan(withDiscard.indexOf('Submitted Card'));

    const withoutDiscard = render(sessions);
    expect(withoutDiscard).not.toContain('discard-run-button');
    expect(withoutDiscard).not.toContain('Discard');
  });

  it('renders a VOD link with rel="noopener noreferrer" when the session has a VOD URL', () => {
    const html = render([session({ twitchVodUrl: 'https://twitch.tv/videos/42' })]);
    expect(html).toContain('href="https://twitch.tv/videos/42"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('renders no VOD link without a VOD URL', () => {
    const html = render([session({ twitchVodUrl: null })]);
    expect(html).not.toContain('<a ');
  });

  it('renders the table empty-state text when there are no sessions', () => {
    expect(render([])).toContain('No Qualifiers Found.');
  });
});
