if (typeof process.loadEnvFile === 'function' && !process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {}
}

import { getDb } from '../src/db';
import { seedDefaultOrganizations } from '../src/api/organizations';
import { importAuthenticPlayers } from './importPlayers';
import { simulateSampleTournament } from '../src/server/api';
import { listFullTournaments } from '../src/api/tournaments';

export async function runDatabaseSeed(): Promise<void> {
  console.log('🌱 Starting comprehensive database seeding...\n');
  const startTime = Date.now();

  try {
    // 1. Seed Organizations
    console.log('🏛️  Seeding default organizations...');
    await seedDefaultOrganizations();
    console.log('   ✅ Organizations seeded successfully.\n');

    // 2. Seed Authentic Competitors
    console.log('👥 Seeding authentic competitor directory...');
    await importAuthenticPlayers();

    // 3. Check for existing tournaments; if none, generate and simulate a sample tournament
    console.log('🏆 Checking tournament catalog...');
    const existingTournaments = await listFullTournaments();
    if (existingTournaments.length === 0) {
      console.log('   No existing tournaments found. Simulating initial championship tournament...');
      const sample = await simulateSampleTournament();
      console.log(`   ✅ Sample tournament created: "${sample.name}" (${sample.slug}) with ${sample.tiers.length} tiers.`);

      // Seed Golden Journey test fixtures (Omen Open, Omen DAS, Omen AO3)
      const { createTournament, getFullTournament, saveFullTournament } = await import('../src/api/tournaments');
      const { listPlayers } = await import('../src/api/players');
      const { runFullSimulation } = await import('../src/features/tournament/simulation');
      const dbPlayers = await listPlayers();
      const profiles = dbPlayers.slice(0, 32).map(p => ({
        id: p.id,
        name: p.name,
        country: p.country || 'US',
        avatarType: p.avatarType,
        personalBest: p.personalBest,
        playstyle: p.playstyle,
        isDisqualified: false,
      }));

      const goldenTourneys = [
        { name: 'Omen Open', slug: 'omen-open' },
        { name: 'Omen DAS', slug: 'omen-d' },
        { name: 'Omen AO3', slug: 'omen-ao3' },
      ];

      for (const def of goldenTourneys) {
        const { tournament } = await createTournament({
          name: def.name,
          slug: def.slug,
          qualFormat: 'HIGH_SCORE',
          tiers: [
            {
              name: 'Gold Tier',
              slug: 'gold',
              bracketType: 'TRADITIONAL',
              numPlayers: 16,
              priorityOrder: 1,
              eliminationType: 'DOUBLE',
              bracketRouting: 'TRADITIONAL',
              bestOf: 5,
              primaryColor: '#ffc905',
              secondaryColor: '#705b33',
            },
          ],
        });
        const full = await getFullTournament(tournament.id);
        if (full) {
          const simulated = runFullSimulation(full, profiles);
          await saveFullTournament(simulated);
          console.log(`   ✅ Seeded journey tournament: "${def.name}" (${def.slug})`);
        }
      }
    } else {
      console.log(`   ℹ️ Found ${existingTournaments.length} existing tournament(s). Preserving existing tournament catalog.`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Database seed finished cleanly in ${duration}s!`);
  } catch (error) {
    console.error('\n❌ Database seeding failed:', error);
    throw error;
  }
}

// Direct CLI execution guard with Windows path normalization
const isDirectExecution = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed.ts');
if (isDirectExecution || import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runDatabaseSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
