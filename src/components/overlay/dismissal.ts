export type DismissReason = 'backdrop' | 'escape' | 'button';
export type DismissResult = 'close' | 'confirm' | 'ignore';

export interface DismissState {
  dirty: boolean;
  busy: boolean;
  dismissible: boolean;
}

/** Pure decision table for every overlay close attempt. */
export function resolveDismissal(reason: DismissReason, state: DismissState): DismissResult {
  if (state.busy) return 'ignore';
  if (reason !== 'button' && !state.dismissible) return 'ignore';
  return state.dirty ? 'confirm' : 'close';
}
