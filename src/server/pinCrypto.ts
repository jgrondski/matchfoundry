import crypto from 'crypto';

// Defensively load .env in Node runtime if process.env hasn't been populated
if (typeof process !== 'undefined' && typeof (process as any).loadEnvFile === 'function') {
  if (!process.env.SYSTEM_ADMIN_RECOVERY_PIN && !process.env.PIN_ENCRYPTION_KEY) {
    try {
      (process as any).loadEnvFile();
    } catch {
      // Ignore if .env doesn't exist
    }
  }
}

export type AdminRole = 'SYSTEM_ADMIN' | 'TOURNAMENT_ADMIN' | 'MASTER_ADMIN';

export interface SessionPayload {
  role: AdminRole;
  tournamentId?: string;
  tournamentSlug?: string;
  tournamentIds?: string[];
  tournamentSlugs?: string[];
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_DEV_KEY = 'tournament-manager-secret-dev-pin-encryption-key-32b';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Derives a deterministic 32-byte Buffer from any string key using SHA-256.
 */
function deriveKey(rawKey?: string): Buffer {
  const secret = rawKey || process.env.PIN_ENCRYPTION_KEY || DEFAULT_DEV_KEY;
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext PIN using AES-256-GCM.
 * Format: `<ivHex>:<authTagHex>:<ciphertextHex>`
 */
export function encryptPin(plaintextPin: string, secretKey?: string): string {
  if (!plaintextPin) {
    throw new Error('Cannot encrypt empty PIN');
  }

  const key = deriveKey(secretKey);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintextPin, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted PIN payload.
 * Throws if corrupted, tampered, or wrong key.
 */
export function decryptPin(encryptedPayload: string, secretKey?: string): string {
  if (!encryptedPayload) {
    throw new Error('Cannot decrypt empty payload');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted PIN payload format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = deriveKey(secretKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Safely compares two strings using constant-time comparison to prevent timing attacks.
 */
export function safeCompareStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Checks if the provided PIN matches the immutable System Admin Recovery PIN from environment.
 * Supports SYSTEM_ADMIN_RECOVERY_PIN and legacy MASTER_ADMIN_RECOVERY_PIN.
 */
export function isSystemRecoveryPin(candidatePin: string): boolean {
  let recoveryPin = (process.env.SYSTEM_ADMIN_RECOVERY_PIN || process.env.MASTER_ADMIN_RECOVERY_PIN || '').trim();
  // Defensively strip surrounding quotes if loaded literally
  if (
    (recoveryPin.startsWith('"') && recoveryPin.endsWith('"')) ||
    (recoveryPin.startsWith("'") && recoveryPin.endsWith("'"))
  ) {
    recoveryPin = recoveryPin.slice(1, -1).trim();
  }
  if (!recoveryPin || !candidatePin) return false;
  return safeCompareStrings(candidatePin.trim(), recoveryPin);
}

// Backwards-compatibility alias
export const isMasterRecoveryPin = isSystemRecoveryPin;

/**
 * Generates an HMAC-SHA256 signed session token containing role and scope.
 */
export function createSessionToken(
  params: {
    role: AdminRole;
    tournamentId?: string;
    tournamentSlug?: string;
    tournamentIds?: string[];
    tournamentSlugs?: string[];
    customDurationMs?: number;
  },
  secretKey?: string
): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (params.customDurationMs ?? SESSION_DURATION_MS);

  // Normalize legacy MASTER_ADMIN to SYSTEM_ADMIN in new tokens
  const normalizedRole = params.role === 'MASTER_ADMIN' ? 'SYSTEM_ADMIN' : params.role;

  const payload: SessionPayload = {
    role: normalizedRole,
    ...(params.tournamentId ? { tournamentId: params.tournamentId } : {}),
    ...(params.tournamentSlug ? { tournamentSlug: params.tournamentSlug } : {}),
    ...(params.tournamentIds && params.tournamentIds.length > 0 ? { tournamentIds: params.tournamentIds } : {}),
    ...(params.tournamentSlugs && params.tournamentSlugs.length > 0 ? { tournamentSlugs: params.tournamentSlugs } : {}),
    issuedAt,
    expiresAt,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64url');

  const key = deriveKey(secretKey);
  const signature = crypto
    .createHmac('sha256', key)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and parses a signed session token. Returns null if invalid or expired.
 */
export function verifySessionToken(token: string, secretKey?: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, providedSig] = parts;
  const key = deriveKey(secretKey);

  const expectedSig = crypto
    .createHmac('sha256', key)
    .update(payloadB64)
    .digest('base64url');

  if (!safeCompareStrings(providedSig, expectedSig)) {
    return null;
  }

  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr) as SessionPayload;

    if (!payload.expiresAt || typeof payload.expiresAt !== 'number') {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }

    // Treat legacy MASTER_ADMIN in existing tokens as SYSTEM_ADMIN
    if ((payload.role as string) === 'MASTER_ADMIN') {
      payload.role = 'SYSTEM_ADMIN';
    }

    return payload;
  } catch {
    return null;
  }
}
