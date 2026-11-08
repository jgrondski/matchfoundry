import { describe, it, expect } from 'vitest';
import {
  editWebhookField,
  isWebhookFieldDirty,
  syncWebhookField,
  webhookFieldFromSaved,
  webhookFieldUpdate,
} from '../components/settings/webhookField';

const URL_A = 'https://discord.com/api/webhooks/1/aaa';
const URL_B = 'https://discord.com/api/webhooks/2/bbb';

describe('Settings form Discord webhook field', () => {
  it('does not send or wipe the webhook when the form mounted before the URL arrived', () => {
    let field = webhookFieldFromSaved(undefined);
    field = syncWebhookField(field, URL_A);

    expect(field.value).toBe(URL_A);
    expect(isWebhookFieldDirty(field, URL_A)).toBe(false);
    expect(webhookFieldUpdate(field)).toEqual({});
  });

  it('leaves the webhook out of a save when the field still lags the saved URL', () => {
    const field = webhookFieldFromSaved(undefined);

    expect(isWebhookFieldDirty(field, URL_A)).toBe(false);
    expect(webhookFieldUpdate(field)).toEqual({});
  });

  it('still sends an empty value when someone clears the field on purpose', () => {
    const field = editWebhookField('');

    expect(isWebhookFieldDirty(field, URL_A)).toBe(true);
    expect(webhookFieldUpdate(field)).toEqual({ discordWebhookUrl: '' });
  });

  it('sends a new URL and keeps what was typed when the saved URL changes underneath', () => {
    const field = syncWebhookField(editWebhookField(URL_B), URL_A);

    expect(field.value).toBe(URL_B);
    expect(isWebhookFieldDirty(field, URL_A)).toBe(true);
    expect(webhookFieldUpdate(field)).toEqual({ discordWebhookUrl: URL_B });
  });

  it('is not dirty when typing returns the field to the saved URL', () => {
    expect(isWebhookFieldDirty(editWebhookField(` ${URL_A} `), URL_A)).toBe(false);
  });
});
