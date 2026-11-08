/**
 * State of the Settings form's Discord webhook field.
 *
 * The API omits the webhook for callers who aren't yet managers, so the form can mount with an
 * empty value and only later receive the real URL. Comparing the field with the saved value can't
 * tell that apart from someone clearing it, so `edited` records whether the user actually typed.
 */
export interface WebhookField {
  value: string;
  edited: boolean;
}

export function webhookFieldFromSaved(savedUrl: string | null | undefined): WebhookField {
  return { value: savedUrl || '', edited: false };
}

export function editWebhookField(value: string): WebhookField {
  return { value, edited: true };
}

/** Takes the latest saved URL unless the user has typed in the field. */
export function syncWebhookField(field: WebhookField, savedUrl: string | null | undefined): WebhookField {
  return field.edited ? field : webhookFieldFromSaved(savedUrl);
}

export function isWebhookFieldDirty(field: WebhookField, savedUrl: string | null | undefined): boolean {
  return field.edited && field.value.trim() !== (savedUrl || '').trim();
}

/** The part of a settings save that concerns the webhook: nothing at all unless the user typed. */
export function webhookFieldUpdate(field: WebhookField): { discordWebhookUrl?: string } {
  return field.edited ? { discordWebhookUrl: field.value } : {};
}
