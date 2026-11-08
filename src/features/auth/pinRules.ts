/**
 * Rules for setting a new PIN. Login deliberately does not apply them, so a PIN set before
 * the minimum existed keeps working until someone changes it.
 */
export const MIN_PIN_LENGTH = 8;

export const PIN_TOO_SHORT_MESSAGE = `PIN must be at least ${MIN_PIN_LENGTH} characters`;

export function isPinLongEnough(pin: string): boolean {
  return pin.trim().length >= MIN_PIN_LENGTH;
}
