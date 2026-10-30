import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  createJourneyTournaments,
  deleteTestData,
  E2E_PLAYER_PREFIX,
  loginSystemAdmin,
  type JourneyTournaments,
} from './support/testTournaments';

const SYSTEM_ADMIN_PIN = (process.env.SYSTEM_ADMIN_RECOVERY_PIN || '').trim();
if (!SYSTEM_ADMIN_PIN) {
  throw new Error('SYSTEM_ADMIN_RECOVERY_PIN is not set. Add it to .env before running e2e tests.');
}
const generateTestPin = () => String(Math.floor(100000 + Math.random() * 900000));
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Golden User Journeys: Security & Access Control', () => {
  // Each run builds its own tournaments through the API and deletes them afterwards,
  // so the journeys never depend on (or alter) seeded data.
  let api: APIRequestContext;
  let adminToken: string;
  let primary: JourneyTournaments['primary'];
  let secondary: JourneyTournaments['secondary'];
  let online: JourneyTournaments['online'];

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
    adminToken = await loginSystemAdmin(api, SYSTEM_ADMIN_PIN);
    ({ primary, secondary, online } = await createJourneyTournaments(api, adminToken));
  });

  test.afterAll(async () => {
    await deleteTestData(api, adminToken);
    await api.dispose();
  });

  test('Journey 1: Public Spectator Friction-Zero Journey', async ({ page, context }) => {
    // Ensure clean spectator session
    await context.clearCookies();
    await page.goto('/');

    // 1. Spectator sees the public directory and no privileged organizer buttons
    await expect(page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active Tournaments', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /create new tournament/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /simulate sample tournament/i })).not.toBeVisible();

    // Spectator top nav shows "Staff Login" and no global management tabs
    await expect(page.getByRole('link', { name: /staff login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^organizations$/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /^players$/i })).not.toBeVisible();

    // 2. Spectator clicks "Live Brackets" on the primary tournament card using data-testid
    const primaryCard = page.getByTestId(`tournament-card-${primary.slug}`);
    await expect(primaryCard).toBeVisible();

    const liveBracketsBtn = primaryCard.getByRole('link', { name: /live brackets/i });
    await expect(liveBracketsBtn).toBeVisible();
    await liveBracketsBtn.click();

    // 3. Arrive on spectator bracket page without any login prompt or modal blocking
    await expect(page).toHaveURL(new RegExp(`/${primary.slug}/`));
    await expect(page.getByRole('heading', { name: /staff & admin login/i })).not.toBeVisible();
    await expect(page.getByPlaceholder('Enter PIN or Key')).not.toBeVisible();

    // Header has return link to all tournaments and Staff Login
    const backToAllLink = page.getByTitle('Return to All Tournaments Directory');
    await expect(backToAllLink).toBeVisible();
    await expect(page.getByRole('link', { name: /staff login/i })).toBeVisible();

    // 4. Return to all tournaments directory
    await backToAllLink.click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Active Tournaments', exact: true })).toBeVisible();
  });

  test('Journey 2: Route Gating & System Admin Emergency Recovery PIN', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // 1. Unauthenticated spectator attempts to access protected settings directly
    await page.goto(`/${primary.slug}/manage/settings`);

    // 2. Route gate triggers and redirects to admin login preserving redirect URL
    await expect(page).toHaveURL(new RegExp(`/admin\\?.*redirect=%2F${primary.slug}%2Fmanage%2Fsettings`));
    await expect(page.getByRole('heading', { name: /staff & admin login/i })).toBeVisible();

    // 3. Enter System Admin Emergency Recovery PIN
    const pinInput = page.getByPlaceholder('Enter PIN or Key');
    await expect(pinInput).toBeVisible();
    await pinInput.fill(SYSTEM_ADMIN_PIN);

    const unlockBtn = page.getByRole('button', { name: /unlock administration/i });
    await unlockBtn.click();

    // 4. Redirects to original destination with System Admin authorization
    await expect(page).toHaveURL(new RegExp(`/${primary.slug}/manage/settings`));
    await expect(page.getByText('Access Security & PIN Management')).toBeVisible();
    await expect(page.getByText('System Admin Scope')).toBeVisible();

    // 5. System Admin has global access links in Tournament Sidebar
    const orgsLink = page.getByRole('link', { name: 'Organizations', exact: true });
    await expect(orgsLink).toBeVisible();
    const globalPlayersLink = page.getByRole('link', { name: 'Global Players' });
    await expect(globalPlayersLink).toBeVisible();

    // 6. Test global navigation without losing credentials
    await orgsLink.click();
    await expect(page).toHaveURL('/organizations');
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();

    // Return to main tournament switcher via top nav
    await page.getByRole('link', { name: /tournaments/i }).first().click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('System Admin Workspace:')).toBeVisible();
    await expect(page.getByRole('button', { name: /create new tournament/i })).toBeVisible();
  });

  test('Journey 3: Tournament Admin Scoped Delegation & Isolation', async ({ page, context }) => {
    await context.clearCookies();
    const DELEGATED_TOURNAMENT_PIN = generateTestPin();

    // Step A: Log in as System Admin to set the Tournament PIN
    await page.goto('/admin');
    await page.getByPlaceholder('Enter PIN or Key').fill(SYSTEM_ADMIN_PIN);
    await page.getByRole('button', { name: /unlock administration/i }).click();
    await expect(page).toHaveURL('/');

    // Navigate to the primary tournament's settings
    await page.goto(`/${primary.slug}/manage/settings`);
    await expect(page.getByText('Access Security & PIN Management')).toBeVisible();

    // Update Tournament PIN to delegated key
    const newPinInput = page.getByPlaceholder('Enter new 4-8 digit PIN');
    await expect(newPinInput).toBeVisible();
    await newPinInput.fill(DELEGATED_TOURNAMENT_PIN);

    const updatePinBtn = page.getByRole('button', { name: 'Update PIN', exact: true });
    await updatePinBtn.click();
    await expect(page.getByText('Tournament PIN successfully updated!')).toBeVisible();

    // Reveal PIN to confirm
    const revealBtn = page.getByRole('button', { name: /reveal pin/i });
    await revealBtn.click();
    await expect(page.getByText(DELEGATED_TOURNAMENT_PIN)).toBeVisible();

    // Step B: Log out of System Admin session from settings
    // Since settings is a protected route, logging out triggers route gate redirect to /admin
    const logoutBtn = page.getByRole('button', { name: /log out/i });
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/admin/);

    // Step C: Log in as Tournament Admin with scoped key
    // Select the primary tournament in the scope dropdown
    const scopeSelect = page.locator('select');
    await scopeSelect.selectOption({ label: `${primary.name} (${primary.slug})` });

    await page.getByPlaceholder('Enter PIN or Key').fill(DELEGATED_TOURNAMENT_PIN);
    await page.getByRole('button', { name: /unlock administration/i }).click();

    // Should authenticate and land on the primary tournament's manage page
    await expect(page).toHaveURL(new RegExp(`/${primary.slug}/manage/`));

    // Sidebar displays Tournament Admin status, reveals Global Players, and isolates organizations
    await expect(page.getByRole('button', { name: /log out \(admin\)/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^organizations$/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /^global players$/i })).toBeVisible();

    // Verify Tournament Admin can view /players without escalation bounce
    await page.getByRole('link', { name: /^global players$/i }).click();
    await expect(page).toHaveURL('/players');
    await expect(page.getByRole('heading', { name: 'Global Player Pool' })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate fake players/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /clear all/i })).not.toBeVisible();

    // Step D: Verify scoped presentation on '/'
    await page.goto('/');
    await expect(page.getByText(`Admin: ${primary.slug}`)).toBeVisible();
    await expect(page.getByText('Your Managed Tournament')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active Tournaments', exact: true })).toBeVisible();

    // Cannot create or simulate tournaments (System Admin only)
    await expect(page.getByRole('button', { name: /create new tournament/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /simulate sample tournament/i })).not.toBeVisible();

    // Step E: Attempt unauthorized escalation to global admin view
    await page.goto('/organizations');
    // Guard redirects to /admin requesting System Admin authorization
    await expect(page).toHaveURL(/\/admin\?.*needSystem=true/);
    await expect(page.getByText('System Admin Key Required')).toBeVisible();
  });

  test('Journey 4: Shared Tournament PIN Authorization & Manager Dropdown Filtering', async ({ page, context }) => {
    await context.clearCookies();

    const SHARED_PIN = generateTestPin();

    // Step A: Log in as System Admin to configure a shared PIN across the primary and secondary tournaments
    await page.goto('/admin');
    await page.getByPlaceholder('Enter PIN or Key').fill(SYSTEM_ADMIN_PIN);
    await page.getByRole('button', { name: /unlock administration/i }).click();
    await expect(page).toHaveURL('/');

    // Configure SHARED_PIN on the primary tournament
    await page.goto(`/${primary.slug}/manage/settings`);
    await expect(page.getByText('Access Security & PIN Management')).toBeVisible();
    await page.getByPlaceholder('Enter new 4-8 digit PIN').fill(SHARED_PIN);
    await page.getByRole('button', { name: 'Update PIN', exact: true }).click();
    await expect(page.getByText('Tournament PIN successfully updated!')).toBeVisible();

    // Configure SHARED_PIN on the secondary tournament (triggers shared PIN warning popup)
    await page.goto(`/${secondary.slug}/manage/settings`);
    await expect(page.getByText('Access Security & PIN Management')).toBeVisible();
    await page.getByPlaceholder('Enter new 4-8 digit PIN').fill(SHARED_PIN);
    await page.getByRole('button', { name: 'Update PIN', exact: true }).click();

    // 1. Shared PIN warning popup appears listing the primary tournament
    const warningModal = page.getByTestId('shared-pin-warning-modal');
    await expect(warningModal).toBeVisible();
    await expect(warningModal.getByText('Shared Tournament PIN Warning')).toBeVisible();
    await expect(warningModal.getByText(primary.name)).toBeVisible();

    // 2. Test Cancel: modal closes and PIN is NOT saved yet
    await page.getByTestId('shared-pin-cancel-btn').click();
    await expect(warningModal).not.toBeVisible();

    // 3. Click Update PIN again and Continue
    await page.getByRole('button', { name: 'Update PIN', exact: true }).click();
    await expect(warningModal).toBeVisible();
    await page.getByTestId('shared-pin-continue-btn').click();
    await expect(warningModal).not.toBeVisible();
    await expect(page.getByText(/Tournament PIN successfully updated!/)).toBeVisible();

    // Step B: Log out from System Admin session
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/admin/);

    // Step C: Log in with the shared PIN once
    await page.getByPlaceholder('Enter PIN or Key').fill(SHARED_PIN);
    await page.getByRole('button', { name: /unlock administration/i }).click();

    // Redirects to first matching tournament or /
    await expect(page).not.toHaveURL(/\/admin/);

    // Step D: Navigate to the primary tournament's manage view and verify manager sidebar dropdown
    await page.goto(`/${primary.slug}/manage/qualifiers`);
    await expect(page).toHaveURL(new RegExp(`/${primary.slug}/manage/qualifiers`));

    // Click the tournament selector dropdown button
    const switcherContainer = page.locator('[data-tournament-menu]');
    await expect(switcherContainer).toBeVisible();
    const dropdownTrigger = switcherContainer.getByRole('button').first();
    await dropdownTrigger.click();

    // Dropdown only includes tournaments the admin can actually manage (2 tournaments)
    const dropdownMenu = page.getByTestId('tournament-dropdown-menu');
    await expect(dropdownMenu).toBeVisible();
    await expect(dropdownMenu.getByText('Tournaments (2)')).toBeVisible();
    await expect(dropdownMenu.getByRole('button', { name: new RegExp(escapeRegExp(primary.name), 'i') })).toBeVisible();
    await expect(dropdownMenu.getByRole('button', { name: new RegExp(escapeRegExp(secondary.name), 'i') })).toBeVisible();
    // The online tournament has no PIN and MUST NOT be in the manager dropdown
    await expect(dropdownMenu.getByRole('button', { name: new RegExp(escapeRegExp(online.name), 'i') })).not.toBeVisible();

    // Step E: Switch to the secondary tournament via the dropdown - seamless entry without login prompt
    await dropdownMenu.getByRole('button', { name: new RegExp(escapeRegExp(secondary.name), 'i') }).click();
    await expect(page).toHaveURL(new RegExp(`/${secondary.slug}/manage/qualifiers`));
    await expect(page.getByRole('heading', { name: /staff & admin login/i })).not.toBeVisible();

    // Step F: Verify '/' shows both under "Your Managed Tournaments (2)"
    await page.goto('/');
    await expect(page.getByText('Admin: 2 Tournaments')).toBeVisible();
    const managedSection = page.locator('section', { hasText: 'Your Managed Tournaments' });
    await expect(managedSection).toBeVisible();
    await expect(managedSection.getByTestId(`tournament-card-${primary.slug}`)).toBeVisible();
    await expect(managedSection.getByTestId(`tournament-card-${secondary.slug}`)).toBeVisible();
    await expect(managedSection.getByTestId(`tournament-card-${online.slug}`)).not.toBeVisible();

    // Step G: Unauthorized access to the online tournament redirects to /admin
    await page.goto(`/${online.slug}/manage/settings`);
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Journey 5: Remote Competitor Online Qualification & Judge Adjudication (Phase 10 Golden Journey 4)', async ({ page, context }) => {
    await context.clearCookies();
    const runnerHandle = `${E2E_PLAYER_PREFIX}Runner_${Math.floor(10000 + Math.random() * 90000)}`;

    // 1. Remote competitor navigates directly to the public competitor portal for the online tournament
    await page.goto(`/${online.slug}/qualify`);
    await expect(page.getByTestId('competitor-portal')).toBeVisible();
    await expect(page.getByTestId('competitor-checkin-card')).toBeVisible();

    // 2. Competitor enters player name and twitch handle
    await page.getByTestId('player-name-input').fill(runnerHandle);
    await page.getByTestId('twitch-handle-input').fill(runnerHandle);

    // 3. Launch official qualifier pre-flight briefing
    await page.getByTestId('start-preflight-button').click();

    // Checklist modal appears
    const preFlightModal = page.getByTestId('pre-flight-modal');
    await expect(preFlightModal).toBeVisible();

    // Check all checklist items
    const checkLabels = preFlightModal.locator('label');
    const labelCount = await checkLabels.count();
    for (let i = 0; i < labelCount; i++) {
      await checkLabels.nth(i).click();
    }

    // Confirm & Begin official run
    const beginBtn = page.getByTestId('confirm-begin-button');
    await expect(beginBtn).toBeEnabled();
    await beginBtn.click();
    await expect(preFlightModal).not.toBeVisible();

    // 6. Active session HUD displays immutable NES Authword
    const authwordCard = page.getByTestId('authword-hud-card');
    await expect(authwordCard).toBeVisible();
    const authwordText = await page.getByTestId('assigned-authword').textContent();
    expect(authwordText?.trim()).toMatch(/^[A-Z0-9.\-!♥]{6,8}$/);

    // 7. Fill out scores and paste Twitch broadcast VOD link
    const scoreInput = page.getByTestId('score-input-0');
    await expect(scoreInput).toBeVisible();
    await scoreInput.fill('1124500');

    const vodInput = page.getByTestId('twitch-vod-input');
    await expect(vodInput).toBeVisible();
    await vodInput.fill('https://twitch.tv/videos/9876543210?t=00h45m12s');

    // Submit official score
    const submitBtn = page.getByTestId('submit-qual-button');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Confirmed receipt card displays with player name in heading; competitor-identity-bar is removed
    await expect(page.getByTestId('awaiting-verification-card')).toBeVisible();
    await expect(page.getByText(`${runnerHandle}: Official Qual Submitted`)).toBeVisible();
    await expect(page.getByTestId('competitor-identity-bar')).not.toBeVisible();
    await expect(page.getByText('1,124,500')).toBeVisible();

    // 8. Public Leaderboard reflects provisional standing [⏳ Awaiting Verification]
    await page.goto(`/${online.slug}/leaderboard`);
    const competitorRow = page.locator('tr', { hasText: runnerHandle });
    await expect(competitorRow).toBeVisible();
    await expect(competitorRow.getByText('Awaiting Verification')).toBeVisible();

    // 9. Staff Admin navigates to Qual Review
    await page.goto(`/${online.slug}/manage/review`);
    await expect(page).toHaveURL(new RegExp(`/admin\\?.*redirect=%2F${online.slug}%2Fmanage%2Freview`));
    await page.getByPlaceholder('Enter PIN or Key').fill(SYSTEM_ADMIN_PIN);
    await page.getByRole('button', { name: /unlock administration/i }).click();

    // Lands on Qual Review view
    await expect(page).toHaveURL(new RegExp(`/${online.slug}/manage/review`));
    await expect(page.getByRole('heading', { name: 'Qual Review' })).toBeVisible();

    // Find submission row in ReviewQueueTable
    const reviewRow = page.locator('tr', { hasText: runnerHandle });
    await expect(reviewRow).toBeVisible();
    await reviewRow.getByRole('button', { name: /review/i }).click();

    // 10. Judge Adjudication Dialog opens
    const adjDialog = page.getByRole('dialog');
    await expect(adjDialog).toBeVisible();
    await expect(adjDialog.getByText(new RegExp(`Adjudicate Run: ${runnerHandle}`, 'i'))).toBeVisible();
    await expect(adjDialog.getByText(authwordText!.trim())).toBeVisible();

    // Judge clicks "Verify Qual"
    await adjDialog.getByRole('button', { name: /verify qual/i }).click();
    await expect(adjDialog).not.toBeVisible();

    // 11. Public Leaderboard updates to official "✓ Verified" status
    await page.goto(`/${online.slug}/leaderboard`);
    const verifiedRow = page.locator('tr', { hasText: runnerHandle });
    await expect(verifiedRow).toBeVisible();
    await expect(verifiedRow.getByText(/verified/i)).toBeVisible();
    await expect(verifiedRow.getByText('Awaiting Verification')).not.toBeVisible();
  });

});

