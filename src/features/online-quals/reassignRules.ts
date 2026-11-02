/** The qual a reassignment target already has in this tournament, if any. */
export interface ReassignTargetQual {
  status: string;
  scoreCount: number;
}

/**
 * Why a qual can't be reassigned onto `targetName`, or null when it can. Shared by the server
 * (which enforces it) and the reconcile dialog (which shows it before the judge submits).
 * A target's qual with no scores that is neither verified nor in progress holds nothing worth
 * keeping, so it doesn't block: the reassignment replaces it.
 */
export function getReassignBlockReason(targetName: string, qual: ReassignTargetQual | null | undefined): string | null {
  if (!qual) return null;
  if (qual.status === 'VERIFIED') {
    return `${targetName}'s qual is verified. Unverify it on the Review page before reassigning to them.`;
  }
  if (qual.status === 'IN_PROGRESS') {
    return `${targetName} has an online run in progress. Wait for them to submit, or discard that run, before reassigning to them.`;
  }
  if (qual.scoreCount > 0) {
    const scores = `${qual.scoreCount} score${qual.scoreCount === 1 ? '' : 's'}`;
    return `${targetName} already has a qual with ${scores}. Remove ${targetName}'s scores on the Review page, or remove ${targetName} from the roster, before reassigning to them.`;
  }
  return null;
}

/** True when reassigning onto this target will replace (delete) the target's empty qual. */
export function reassignReplacesEmptyQual(qual: ReassignTargetQual | null | undefined): boolean {
  return Boolean(qual) && getReassignBlockReason('', qual) === null;
}
