/**
 * The link to open for a tournament's Matcherino page, or null when none is set or it is not
 * a web address. A bare "matcherino.com/t/x" gets https:// added. Anything other than http(s)
 * (javascript:, data:, ...) is rejected so a saved value can never run script when clicked.
 */
export function getMatcherinoHref(raw?: string | null): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Settings-form message for an entered Matcherino link, or null when it is blank or valid. */
export function getMatcherinoUrlError(raw: string): string | null {
  if (!raw.trim()) return null;
  return getMatcherinoHref(raw) ? null : 'Enter a web address, e.g. https://matcherino.com/t/your-event';
}
