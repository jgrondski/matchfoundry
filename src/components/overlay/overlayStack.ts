/** Tracks open overlays so only the topmost reacts to Escape, and locks page scroll while any is open. */
const stack: string[] = [];
let previousOverflow = '';

export function pushOverlay(id: string): void {
  if (stack.length === 0 && typeof document !== 'undefined') {
    previousOverflow = document.documentElement.style.overflow;
    // eslint-disable-next-line no-restricted-syntax -- runtime: page scroll lock
    document.documentElement.style.overflow = 'hidden';
  }
  stack.push(id);
}

export function removeOverlay(id: string): void {
  const index = stack.lastIndexOf(id);
  if (index >= 0) stack.splice(index, 1);
  if (stack.length === 0 && typeof document !== 'undefined') {
    // eslint-disable-next-line no-restricted-syntax -- runtime: page scroll lock
    document.documentElement.style.overflow = previousOverflow;
  }
}

export function isTopOverlay(id: string): boolean {
  return stack[stack.length - 1] === id;
}
