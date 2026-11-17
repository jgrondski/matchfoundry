import {
  BarChart3,
  Trophy,
  Sheet,
  GitBranch,
  Scale,
  CheckCircle2,
  Video,
  Users,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { SeedingMethod } from '../features/tournament/types';

export type AdminNavKey =
  | 'leaderboard'
  | 'standings'
  | 'sheet'
  | 'bracket'
  | 'judge'
  | 'review'
  | 'obs'
  | 'players'
  | 'settings';

export interface AdminNavItem {
  key: AdminNavKey;
  label: string;
  icon: LucideIcon;
  to: string;
}

interface AdminNavOptions {
  slug: string;
  seedingMethod?: SeedingMethod;
  /** Tier the bracket, sheet and judge links open on. Omitted opens each page's default tier. */
  tierSlug?: string;
  /** False points Qualifiers, Standings and Brackets at their public pages. */
  isAuthorized?: boolean;
}

/**
 * The tournament admin pages in sidebar order. The sidebar and the front-page tournament card
 * both build from this list, so the two always offer the same destinations.
 */
export function getAdminNavItems({
  slug,
  seedingMethod,
  tierSlug,
  isAuthorized = true,
}: AdminNavOptions): AdminNavItem[] {
  const tierQuery = tierSlug ? `?tier=${tierSlug}` : '';
  return [
    {
      key: 'leaderboard',
      label: seedingMethod === 'MANUAL' ? 'Seeding' : 'Qualifiers',
      icon: BarChart3,
      to: isAuthorized ? `/${slug}/manage/qualifiers` : `/${slug}/leaderboard`,
    },
    {
      key: 'standings',
      label: 'Standings',
      icon: Trophy,
      to: isAuthorized ? `/${slug}/manage/standings` : `/${slug}/standings`,
    },
    {
      key: 'sheet',
      label: 'Master Sheet',
      icon: Sheet,
      to: `/${slug}/manage/sheet${tierQuery}`,
    },
    {
      key: 'bracket',
      label: 'Brackets',
      icon: GitBranch,
      to: isAuthorized
        ? (tierSlug ? `/${slug}/manage/bracket/${tierSlug}` : `/${slug}/manage/bracket`)
        : (tierSlug ? `/${slug}/${tierSlug}` : `/${slug}/brackets`),
    },
    {
      key: 'judge',
      label: 'Floor Judge',
      icon: Scale,
      to: `/${slug}/manage/judge${tierQuery}`,
    },
    {
      key: 'review',
      label: 'Qual Review',
      icon: CheckCircle2,
      to: `/${slug}/manage/review`,
    },
    {
      key: 'obs',
      label: 'OBS Hub',
      icon: Video,
      to: `/${slug}/obs`,
    },
    {
      key: 'players',
      label: 'Players',
      icon: Users,
      to: `/${slug}/manage/players`,
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: Settings,
      to: `/${slug}/manage/settings`,
    },
  ];
}
