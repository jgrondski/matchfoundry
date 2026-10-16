import type { QualTimerLog } from '../tournament/types';

/**
 * NES Tetris High-Score Name Entry Character Set:
 * Uppercase A-Z, digits 0-9, '.', '-', '!', '♥'
 * Strictly 6 to 8 characters, no spaces permitted.
 */
export const NES_AUTHWORD_REGEX = /^[A-Z0-9.\-!♥]{6,8}$/;

export function isValidNesAuthword(word: string): boolean {
  if (typeof word !== 'string') return false;
  return NES_AUTHWORD_REGEX.test(word);
}

export function sanitizeNesAuthword(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9.\-!♥]/g, '');
  if (cleaned.length < 6) return null;
  return cleaned.slice(0, 8);
}

export const CURATED_NES_AUTHWORDS: readonly string[] = [
  'ROCKET', 'TETRIS', 'MAXOUT', 'PALACE', 'GALAXY', 'METEOR', 'PULSAR', 'FALCON',
  'DRAGON', 'KNIGHT', 'CASTLE', 'WIZARD', 'VORTEX', 'QUASAR', 'NEBULA', 'PHOTON',
  'MAGNET', 'COBALT', 'SILVER', 'GOLDEN', 'BRONZE', 'TROPHY', 'ARCADE', 'LEGEND',
  'VICTOR', 'SHIELD', 'BEACON', 'SUMMIT', 'CANYON', 'GLACIER', 'TUNDRA', 'FOREST',
  'JUNGLE', 'ISLAND', 'HARBOR', 'ANCHOR', 'VOYAGE', 'COMPASS', 'PLANET', 'SATURN',
  'URANUS', 'COMETS', 'ORBITS', 'COSMIC', 'ASTRAL', 'SOLAR!', 'LUNAR!', 'STELLA',
  'ZENITH', 'APOLLO', 'ATHENA', 'HERMES', 'HELIOS', 'CHRONO', 'MATRIX', 'VECTOR',
  'VERTEX', 'PRISMS', 'CRYSTAL', 'QUARTZ', 'GARNET', 'JASPER', 'TOPAZ!', 'MARBLE',
  'GRANITE', 'BASALT', 'COPPER', 'NICKEL', 'CHROME', 'TITAN!', 'RADIUM', 'ARGON!',
  'XENON!', 'HELIUM', 'CARBON', 'OXYGEN', 'PLASMA', 'FUSION', 'DYNAMO', 'TURBO!',
  'ENGINE', 'PISTON', 'CLUTCH', 'TORQUE', 'ROTORS', 'GEARS!', 'SWITCH', 'BUTTON',
  'JOYPAD', 'SCREEN', 'SPRITE', 'PIXELS', 'SHADERS', 'FRAMES', 'BUFFER', 'MEMORY',
  'SOCKET', 'CABLES', 'SIGNAL', 'STREAM', 'CAMERA', 'ACTION', 'FINALS', 'CHAMP!',
  'MASTER', 'EXPERT', 'ROOKIE', 'PLAYER', 'GAMERS', 'SCORES', 'POINTS', 'LEVELS',
  'LINES!', 'TETRIS!', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TUCKED', 'SPINS!', 'DROPS!',
  'HYPERT', 'ROLLER', 'TAPPED', 'DAS10!', 'SPEEDY', 'SWIFT!', 'NIMBLE', 'CLEVER',
  'BRIGHT', 'SHARP!', 'BRAVE!', 'NOBLE!', 'HEROIC', 'MIGHTY', 'FIERCE', 'STEADY',
  'CALMLY', 'FOCUS!', 'VISION', 'RHYTHM', 'TEMPO!', 'MELODY', 'CHORDS', 'SONATA',
  'PRESTO', 'FINALE', 'ENCORE', 'APPLAU', 'CHEERS', 'BANNERS', 'HERALD', 'CROWNS',
  'SCEPTR', 'THRONE', 'EMPIRE', 'REALMS', 'DOMAIN', 'PORTAL', 'BRIDGE', 'TOWERS',
  'FORTRS', 'CITADL', 'BASTIN', 'BUNKER', 'VAULTS', 'CHAMBR', 'TEMPLE', 'SHRINE',
  'ORACLE', 'SPHINX', 'PYRAMD', 'OBLISK', 'STATUE', 'PILLAR', 'ARCHES', 'DOMES!',
  'GARDEN', 'MEADOW', 'VALLEY', 'RIDGES', 'CLIFFS', 'GROTTO', 'CAVERN', 'GEYSER',
  'LAGOON', 'CORALS', 'REEFS!', 'TRENCH', 'ABYSS!', 'BREEZE', 'ZEPHYR', 'SQUALL',
  'TEMPST', 'CYCLON', 'TYPHON', 'MONSON', 'BLIZRD', 'FROSTY', 'ICICLE', 'AURORA',
  'SUNSET', 'DAWN!!', 'DUSK!!', 'SHADOW', 'MIRAGE', 'ECHOES', 'RIPPLE', 'TORRNT',
  'RAPIDS', 'CASCAD', 'STREAMS', 'RIVERS', 'OCEANS', 'SWELLS', 'CRESTS', 'TIDES!',
  'CONDOR', 'EAGLES', 'HAWKS!', 'OSPREY', 'RAVEN!', 'ROBIN!', 'FINCH!', 'PARROT',
  'TOUCAN', 'PUFFIN', 'PELICN', 'HERONS', 'CRANES', 'SWANS!', 'BADGER', 'BEAVER',
  'OTTERS', 'MARMOT', 'BOBCAT', 'COUGAR', 'JAGUAR', 'PANTHR', 'TIGERS', 'LIONS!',
  'WOLVES', 'FOXES!', 'BISON!', 'MOOSE!', 'ANTLER', 'GAZELL', 'IMPALA', 'ZEBRAS',
  'GIRAFF', 'RHINOS', 'HIPPOS', 'CAMELS', 'ALPACA', 'LLAMAS', 'KOALAS', 'WOMBAT',
  'WALLBY', 'KANGRO', 'DOLPHN', 'WHALES', 'ORCAS!', 'SHARKS', 'MANTAS', 'TURTLE',
  'IGUANA', 'GECKOS', 'COBRAS', 'VIPERS', 'PYTHON', 'BEETLE', 'MANTIS', 'CICADA',
  'HORNET', 'BUMBLE', 'FIREFL', 'DRAGONF', 'MONRCH', 'SPIDER', 'SCORPN', 'CRABS!',
  'LOBSTR', 'SHRIMP', 'OYSTER', 'MUSSEL', 'CLAMS!', 'SNAILS', 'URCHIN', 'STARFS',
  'MAPLE!', 'CEDARS', 'WILLOW', 'SPRUCE', 'POPLAR', 'CYPRES', 'SEQUOI', 'REDWOD',
  'BONSAI', 'BAMBOO', 'CACTUS', 'ORCHID', 'LOTUS!', 'LILIES', 'TULIPS', 'DAISYS',
  'VIOLET', 'CLOVER', 'FERNS!', 'MOSSES', 'ACORNS', 'PINECO', 'APPLES', 'ORANGE',
  'LEMONS', 'LIMES!', 'MANGOS', 'PAPAYA', 'BANANA', 'CHERRY', 'GRAPES', 'PEACHS',
  'PLUMS!', 'MELONS', 'BERRYS', 'ALMOND', 'WALNUT', 'PECANS', 'CASHEW', 'PEANUT',
  'COFFEE', 'COCOA!', 'SPICES', 'PEPPER', 'GINGER', 'CINNAM', 'NUTMEG', 'VANILA',
  'HONEY!', 'MAPLE♥', 'SUGAR!', 'BUTTER', 'CHEESE', 'BREADS', 'WAFFLE', 'PANCKE',
  'MUFFIN', 'BAGELS', 'PRETZL', 'COOKIE', 'BROWNI', 'DONUTS', 'PASTRY', 'TART!!',
];

/**
 * Generates an NES-compatible 6-8 character Authword.
 * Merges valid tournament customAuthWords with the curated dictionary,
 * avoiding any words in excludeWords if possible.
 */
export function generateNesAuthword(
  customWords?: string[] | null,
  excludeWords?: string[]
): string {
  const validCustom = (customWords || [])
    .map(w => sanitizeNesAuthword(w))
    .filter((w): w is string => w !== null);

  const pool = Array.from(new Set([...validCustom, ...CURATED_NES_AUTHWORDS]));
  const excludedSet = new Set(
    (excludeWords || []).map(w => w.trim().toUpperCase())
  );

  const available = pool.filter(w => !excludedSet.has(w));
  const candidates = available.length > 0 ? available : pool;

  // If customWords were explicitly provided and available, prefer them or sample uniformly
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex] || 'ROCKET';
}

/**
 * Creates a fresh QualTimerLog when a competitor initiates their online qualifier run.
 */
export function createInitialTimerLog(nowMs: number = Date.now()): QualTimerLog {
  return {
    startedAt: nowMs,
    elapsedSeconds: 0,
    pauses: [],
    overTime: false,
  };
}

/**
 * Computes live timer telemetry (elapsedSeconds, remainingSeconds, overTime)
 * from a QualTimerLog and the tournament's qualWindowMinutes.
 * Note: Timer expiry is strictly non-blocking; overTime is recorded as telemetry only.
 */
export function computeTimerTelemetry(
  timerLog: QualTimerLog,
  qualWindowMinutes: number = 90,
  nowMs: number = Date.now()
): {
  elapsedSeconds: number;
  remainingSeconds: number;
  overTime: boolean;
  isPaused: boolean;
  totalPauseSeconds: number;
} {
  const endReferenceMs = timerLog.submittedAt ?? nowMs;
  let pausedDurationMs = 0;
  let isPaused = false;

  for (const p of timerLog.pauses || []) {
    if (p.resumedAt && p.resumedAt >= p.pausedAt) {
      pausedDurationMs += p.resumedAt - p.pausedAt;
    } else if (!p.resumedAt) {
      isPaused = true;
      pausedDurationMs += Math.max(0, endReferenceMs - p.pausedAt);
    }
  }

  const rawElapsedMs = Math.max(0, endReferenceMs - timerLog.startedAt - pausedDurationMs);
  const computedElapsed = Math.floor(rawElapsedMs / 1000);
  const elapsedSeconds = Math.max(timerLog.elapsedSeconds || 0, computedElapsed);

  const windowSeconds = Math.max(1, qualWindowMinutes) * 60;
  const remainingSeconds = Math.max(0, windowSeconds - elapsedSeconds);
  const overTime = Boolean(timerLog.overTime || elapsedSeconds > windowSeconds);

  return {
    elapsedSeconds,
    remainingSeconds,
    overTime,
    isPaused,
    totalPauseSeconds: Math.floor(pausedDurationMs / 1000),
  };
}
