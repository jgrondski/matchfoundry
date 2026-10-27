import type { QualFormat } from '../tournament/types';

/** Short display label for a qualifier format, e.g. "# of Maxes", "Average of 3", "Points". */
export function qualFormatLabel(qualFormat: QualFormat | string, qualAverageCount?: number): string {
  if (qualFormat === 'POINTS') return 'Points';
  if (qualFormat === 'AVERAGE_OF_X') return `Average of ${qualAverageCount || 2}`;
  return '# of Maxes';
}
