import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptPin,
  decryptPin,
  safeCompareStrings,
  createSessionToken,
  verifySessionToken,
  isSystemRecoveryPin,
  isMasterRecoveryPin,
} from '../pinCrypto';

describe('pinCrypto - AES-256-GCM Two-Way Encryption', () => {
  it('encrypts and decrypts a PIN with perfect parity', () => {
    const rawPin = '7492';
    const encrypted = encryptPin(rawPin);

    expect(encrypted).not.toEqual(rawPin);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    const decrypted = decryptPin(encrypted);
    expect(decrypted).toEqual(rawPin);
  });

  it('produces different ciphertexts for identical PINs (unique IVs)', () => {
    const rawPin = '1234';
    const enc1 = encryptPin(rawPin);
    const enc2 = encryptPin(rawPin);

    expect(enc1).not.toEqual(enc2);
    expect(decryptPin(enc1)).toEqual(rawPin);
    expect(decryptPin(enc2)).toEqual(rawPin);
  });

  it('throws on tampered or corrupted encrypted payload', () => {
    const rawPin = '8888';
    const encrypted = encryptPin(rawPin);
    const [iv, tag] = encrypted.split(':');

    // Corrupt ciphertext
    const tampered = `${iv}:${tag}:deadbeef`;
    expect(() => decryptPin(tampered)).toThrow();
  });

  it('throws when encrypting empty PIN', () => {
    expect(() => encryptPin('')).toThrow('Cannot encrypt empty PIN');
  });

  it('throws when decrypting invalid format', () => {
    expect(() => decryptPin('invalid-payload')).toThrow('Invalid encrypted PIN payload format');
  });
});

describe('pinCrypto - Constant-Time String Comparison', () => {
  it('correctly compares matching and non-matching strings', () => {
    expect(safeCompareStrings('secret123', 'secret123')).toBe(true);
    expect(safeCompareStrings('secret123', 'wrong')).toBe(false);
    expect(safeCompareStrings('secret123', 'secret124')).toBe(false);
    expect(safeCompareStrings('', '')).toBe(true);
  });
});

describe('pinCrypto - Session Tokens & Roles', () => {
  it('creates and verifies a valid SYSTEM_ADMIN session token', () => {
    const token = createSessionToken({ role: 'SYSTEM_ADMIN' });
    const payload = verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.role).toEqual('SYSTEM_ADMIN');
    expect(payload?.tournamentId).toBeUndefined();
    expect(payload?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('normalizes legacy MASTER_ADMIN role to SYSTEM_ADMIN in tokens', () => {
    const token = createSessionToken({ role: 'MASTER_ADMIN' });
    const payload = verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.role).toEqual('SYSTEM_ADMIN');
  });

  it('creates and verifies a scoped TOURNAMENT_ADMIN session token', () => {
    const tournamentId = 'tourney-123-abc';
    const token = createSessionToken({
      role: 'TOURNAMENT_ADMIN',
      tournamentId,
    });

    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.role).toEqual('TOURNAMENT_ADMIN');
    expect(payload?.tournamentId).toEqual(tournamentId);
  });

  it('rejects tampered session tokens', () => {
    const token = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: 't1' });
    const [, sig] = token.split('.');

    // Tamper payload to escalate to SYSTEM_ADMIN
    const tamperedPayload = Buffer.from(
      JSON.stringify({ role: 'SYSTEM_ADMIN', expiresAt: Date.now() + 10000 })
    ).toString('base64url');

    const tamperedToken = `${tamperedPayload}.${sig}`;
    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  it('rejects expired session tokens', () => {
    const token = createSessionToken({
      role: 'SYSTEM_ADMIN',
      customDurationMs: -1000, // already expired
    });

    expect(verifySessionToken(token)).toBeNull();
  });
});

describe('pinCrypto - System Admin Recovery PIN', () => {
  const origEnvSystem = process.env.SYSTEM_ADMIN_RECOVERY_PIN;
  const origEnvMaster = process.env.MASTER_ADMIN_RECOVERY_PIN;

  beforeEach(() => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = 'SUPER_SECRET_RECOVERY_2026';
    delete process.env.MASTER_ADMIN_RECOVERY_PIN;
  });

  afterEach(() => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = origEnvSystem;
    process.env.MASTER_ADMIN_RECOVERY_PIN = origEnvMaster;
  });

  it('validates correct recovery PIN via SYSTEM_ADMIN_RECOVERY_PIN', () => {
    expect(isSystemRecoveryPin('SUPER_SECRET_RECOVERY_2026')).toBe(true);
    expect(isSystemRecoveryPin('  SUPER_SECRET_RECOVERY_2026  ')).toBe(true);
    expect(isMasterRecoveryPin('SUPER_SECRET_RECOVERY_2026')).toBe(true);
  });

  it('validates legacy MASTER_ADMIN_RECOVERY_PIN fallback', () => {
    delete process.env.SYSTEM_ADMIN_RECOVERY_PIN;
    process.env.MASTER_ADMIN_RECOVERY_PIN = 'LEGACY_RECOVERY_PIN';

    expect(isSystemRecoveryPin('LEGACY_RECOVERY_PIN')).toBe(true);
    expect(isMasterRecoveryPin('LEGACY_RECOVERY_PIN')).toBe(true);
  });

  it('handles recovery PIN with surrounding double or single quotes gracefully', () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '"!Test-Recovery-Pin!"';
    expect(isSystemRecoveryPin('!Test-Recovery-Pin!')).toBe(true);

    process.env.SYSTEM_ADMIN_RECOVERY_PIN = "'single-quoted-secret'";
    expect(isSystemRecoveryPin('single-quoted-secret')).toBe(true);
  });

  it('rejects incorrect recovery PIN', () => {
    expect(isSystemRecoveryPin('WRONG_PIN')).toBe(false);
    expect(isSystemRecoveryPin('')).toBe(false);
  });
});
