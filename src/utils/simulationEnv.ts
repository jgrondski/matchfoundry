/**
 * Simulation (sample tournaments, seeded quals, simulated matches, fake players) is a dev/QA tool.
 * It is allowed locally and on Vercel Preview (feature branch) deploys, never on Production.
 */

// Injected by vite.config.ts `define` at build time from VERCEL_ENV.
declare const __SIMULATION_ENABLED__: boolean | undefined;

/** Client-side flag, fixed at build time. Defaults to enabled when the define is absent. */
export const SIMULATION_ENABLED: boolean =
  typeof __SIMULATION_ENABLED__ === 'undefined' ? true : __SIMULATION_ENABLED__;

/** Server-side check, evaluated per request from the runtime environment. */
export function isSimulationAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV !== 'production';
}

export const SIMULATION_DISABLED_MESSAGE = 'Simulation is disabled in production.';
