import { beforeAll, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { loadCoreLocaleMessages, loadPublicAuthLocaleMessages } from '../loadLocale';
import { stubCatalogFetch } from './stubCatalogFetch';

describe('loadLocale', () => {
  beforeAll(stubCatalogFetch);

  it('loads navigation.home in core bundle', async () => {
    const core = await loadCoreLocaleMessages('en');
    expect(core['navigation.home']).toBeTruthy();
    expect(Object.keys(core).length).toBeGreaterThan(1000);
  });

  it('public auth bundle does not include navigation.home', async () => {
    const publicMessages = await loadPublicAuthLocaleMessages('en');
    expect(publicMessages['navigation.home']).toBeUndefined();
    expect(publicMessages['auth.login'] || publicMessages['onboarding.profileTitle']).toBeTruthy();
  });

  it('vue-i18n resolves flat core keys after setLocaleMessage', async () => {
    const core = await loadCoreLocaleMessages('en');
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {},
    });
    i18n.global.setLocaleMessage('en', core);
    expect(i18n.global.t('navigation.home')).toBe(core['navigation.home']);
  });
});
