import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StreamCrashModal } from '../components/StreamCrashModal';
import { AuthwordHudCard } from '../components/AuthwordHudCard';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createPlayer } from '../../../api/players';
import { saveFullTournament } from '../../../api/tournaments';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import {
  startOnlineQualSession,
  requestOnlineQualReset,
  getOnlineQualSession,
  voidAndResetOnlineQualSession,
} from '../../../api/qualifiers';
import type { Tournament, QualTimerLog } from '../../tournament/types';

describe('Journey 4: Stream Crash Technical Reset & Session Recovery (ATDD)', () => {
  let tourney: Tournament;
  let playerId: string;

  beforeEach(async () => {
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();

    tourney = createEmptyTournament({
      slug: 'omen-reset-tourney',
      name: 'Omen Reset Tourney',
      qualMode: 'ONLINE',
      qualWindowMinutes: 90,
      customAuthWords: ['CUSTOM1', 'CUSTOM2'],
      tiers: [createDefaultTier(1, { id: 'tier-1', playerCount: 8 })],
    });
    tourney.id = crypto.randomUUID();
    tourney.organizationId = 'org_ctwc';
    await saveFullTournament(tourney);

    const player = await createPlayer({
      name: 'StreamCrashGamer',
      country: 'US',
      twitchId: 'tw_crashgamer',
      twitchUsername: 'crashgamer',
    });
    playerId = player.id;
  });

  describe('1. StreamCrashModal Component Presentation', () => {
    it('renders explanation textarea, warnings, and action buttons', () => {
      const html = renderToStaticMarkup(
        <StreamCrashModal
          isOpen={true}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
          isSubmitting={false}
        />
      );

      expect(html).toContain('Report Stream Crash / Reset Request');
      expect(html).toContain('Description of Technical Failure *');
      expect(html).toContain('e.g. OBS crashed 14 minutes in');
      expect(html).toContain('Cancel');
      expect(html).toContain('Send Reset Request to Judges');
    });

    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <StreamCrashModal
          isOpen={false}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toBe('');
    });
  });

  describe('2. Active Run Reset Request & HUD Banner', () => {
    it('renders reset request pending banner on the AuthwordHudCard when resetRequested is true', () => {
      const timerLogWithReset: QualTimerLog = {
        startedAt: Date.now() - 15 * 60 * 1000,
        elapsedSeconds: 15 * 60,
        pauses: [],
        overTime: false,
        resetRequested: true,
        resetReason: 'OBS frozen at 15 minutes, capture card detached',
      };

      const html = renderToStaticMarkup(
        <AuthwordHudCard
          authWord="ROCKET"
          timerLog={timerLogWithReset}
        />
      );

      expect(html).toContain('Reset Request Pending:');
      expect(html).toContain('OBS frozen at 15 minutes, capture card detached');
      expect(html).toContain('Awaiting tournament judge review or session restart.');
    });
  });

  describe('3. End-to-End Technical Reset Lifecycle (Backend Database Integration)', () => {
    it('executes full Journey 4: launch -> crash report -> pending recovery -> judge void & restart', async () => {
      // 1. Competitor launches official run
      const session1 = await startOnlineQualSession(tourney.id, {
        playerId,
        submittedTwitchId: 'tw_crashgamer',
        submittedTwitchUsername: 'crashgamer',
        identityStatus: 'VERIFIED_MATCH',
      });

      expect(session1.status).toBe('IN_PROGRESS');
      const initialAuthWord = session1.authWord;
      expect(initialAuthWord).toBeDefined();

      // 2. Competitor browser reload recovers identical session (Assertion 1.5)
      const recovered1 = await getOnlineQualSession(tourney.id, { playerId });
      expect(recovered1?.authWord).toBe(initialAuthWord);
      expect(recovered1?.timerLog.resetRequested).toBeUndefined();

      // 3. Competitor reports stream crash at 12 minutes (Journey 4, Step 2)
      const afterReport = await requestOnlineQualReset(tourney.id, {
        playerId,
        reason: 'OBS encoder error at 12 minutes. Broadcast died.',
      });

      expect(afterReport.timerLog.resetRequested).toBe(true);
      expect(afterReport.timerLog.resetReason).toContain('OBS encoder error');
      expect(afterReport.judgeNotes).toContain('OBS encoder error');

      // 4. Reloading browser preserves the reset request state
      const recoveredPending = await getOnlineQualSession(tourney.id, { playerId });
      expect(recoveredPending?.timerLog.resetRequested).toBe(true);
      expect(recoveredPending?.timerLog.resetReason).toContain('OBS encoder error');

      // 5. Judge inspects stream and executes session void & restart (Journey 4, Step 4)
      const restartedSession = await voidAndResetOnlineQualSession(tourney.id, {
        playerId,
        judgeNote: 'Confirmed OBS freeze on stream broadcast. Approved restart.',
      });

      expect(restartedSession.status).toBe('IN_PROGRESS');
      // Fresh NES Authword issued
      expect(restartedSession.authWord).not.toBe(initialAuthWord);
      // Reset request cleared
      expect(restartedSession.timerLog.resetRequested).toBeUndefined();
      // Fresh timer started
      expect(restartedSession.timerLog.elapsedSeconds).toBe(0);
      expect(restartedSession.judgeNotes).toContain('Confirmed OBS freeze');

      // 6. Verification: Database has exactly one active session row for this player
      const activeSessionCheck = await getOnlineQualSession(tourney.id, { playerId });
      expect(activeSessionCheck?.authWord).toBe(restartedSession.authWord);
      expect(activeSessionCheck?.submissionIds.length).toBe(1);
    });
  });
});
