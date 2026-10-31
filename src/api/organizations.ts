import { organizations, tournaments } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db';
import { Organization } from '../features/tournament/types';
import { CreateOrganizationInput } from '../features/organizations/types';
import { DEFAULT_ORGANIZATIONS } from '../features/organizations/store';
import { DEFAULT_TIER_THEME } from '../theme/palette';

export async function seedDefaultOrganizations(): Promise<void> {
  const db = getDb();
  for (const org of DEFAULT_ORGANIZATIONS) {
    await db
      .insert(organizations)
      .values({
        id: org.id,
        name: org.name,
        slug: org.slug,
        shortName: org.shortName || org.slug.toUpperCase(),
        description: org.description || null,
        website: org.website || null,
        brandColor: org.brandColor || null,
        themeColors: org.themeColors || null,
        tierThemes: org.tierThemes || null,
        branding: org.branding || null,
        discordWebhookUrl: org.discordWebhookUrl || null,
        defaultRules: org.defaultRules || null,
      })
      .onConflictDoNothing();
  }
}

export function formatOrganizationRecord(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortName: row.shortName || row.name,
    description: row.description || undefined,
    website: row.website || undefined,
    brandColor: row.brandColor || undefined,
    themeColors: row.themeColors || undefined,
    tierThemes: row.tierThemes || undefined,
    branding: row.branding || undefined,
    discordWebhookUrl: row.discordWebhookUrl || undefined,
    defaultRules: row.defaultRules || undefined,
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
  };
}

export async function listOrganizations(): Promise<Organization[]> {
  const db = getDb();
  await seedDefaultOrganizations();
  const rows = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  return rows.map(formatOrganizationRecord);
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const db = getDb();
  await seedDefaultOrganizations();
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return row ? formatOrganizationRecord(row) : null;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const db = getDb();
  await seedDefaultOrganizations();
  const [row] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return row ? formatOrganizationRecord(row) : null;
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const db = getDb();
  await seedDefaultOrganizations();

  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const shortName = input.shortName || input.name;
  const theme = input.themeColors || input.branding?.themeColors || {
    primaryColor: input.brandColor || DEFAULT_TIER_THEME.primaryColor,
    secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
    cardColor: DEFAULT_TIER_THEME.cardColor,
    textColor: DEFAULT_TIER_THEME.textColor,
    backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
  };
  const tierThemes = input.tierThemes && input.tierThemes.length > 0 ? input.tierThemes : [
    {
      id: `theme_${Date.now()}_primary`,
      name: 'Primary Tier',
      themeColors: theme,
    },
  ];

  const orgId = input.id || `org_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  const [row] = await db
    .insert(organizations)
    .values({
      id: orgId,
      name: input.name,
      slug: slug || `org-${Date.now()}`,
      shortName,
      description: input.description || null,
      website: input.website || null,
      brandColor: input.brandColor || theme.primaryColor,
      themeColors: theme,
      tierThemes,
      branding: {
        logoUrl: input.logoUrl || input.branding?.logoUrl,
        bannerUrl: input.bannerUrl || input.branding?.bannerUrl,
        themeColors: theme,
        brandColor: input.brandColor || theme.primaryColor,
      },
      discordWebhookUrl: input.discordWebhookUrl || null,
      defaultRules: input.defaultRules || null,
    })
    .returning();

  return formatOrganizationRecord(row);
}

export async function updateOrganization(
  id: string,
  updates: Partial<Organization>
): Promise<Organization | null> {
  const db = getDb();
  const existing = await getOrganizationById(id);
  if (!existing) return null;

  const updatedTheme = updates.themeColors || updates.branding?.themeColors || existing.themeColors;

  const [row] = await db
    .update(organizations)
    .set({
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.shortName !== undefined && { shortName: updates.shortName }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.website !== undefined && { website: updates.website }),
      ...(updates.brandColor !== undefined && { brandColor: updates.brandColor }),
      ...(updatedTheme && { themeColors: updatedTheme }),
      ...(updates.tierThemes && { tierThemes: updates.tierThemes }),
      ...(updates.branding && { branding: updates.branding }),
      ...(updates.discordWebhookUrl !== undefined && { discordWebhookUrl: updates.discordWebhookUrl }),
      ...(updates.defaultRules && { defaultRules: updates.defaultRules }),
    })
    .where(eq(organizations.id, id))
    .returning();

  return row ? formatOrganizationRecord(row) : null;
}

export async function deleteOrganization(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  // Check if there are associated tournaments
  const associated = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.organizationId, id))
    .limit(1);

  if (associated.length > 0) {
    return {
      success: false,
      error: 'Cannot delete organization because active tournaments are attached to it.',
    };
  }

  await db.delete(organizations).where(eq(organizations.id, id));
  return { success: true };
}
