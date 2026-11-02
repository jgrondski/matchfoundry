import type { Playstyle } from '../tournament/types';

/** The playstyles a player can be given. Every playstyle picker renders exactly this list. */
export const PLAYSTYLE_OPTIONS: ReadonlyArray<{ value: Playstyle; label: string }> = [
  { value: 'Rolling', label: 'Rolling / Roll' },
  { value: 'DAS', label: 'DAS' },
  { value: 'Hypertap', label: 'Hypertap / Tap' },
  { value: 'Hybrid', label: 'Hybrid' },
];
