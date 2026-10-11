import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCatalogFetch } from './stubCatalogFetch';

describe('upgradeI18nAfterLogin flow', () => {
  beforeEach(async () => {
    stubCatalogFetch();
    const { clearLocaleCache } = await import('../loadLocale');
    clearLocaleCache();
    vi.resetModules();
  });

  it('upgrades from public to core after login', async () => {
    const { initI18n, upgradeI18nAfterLogin, i18n } = await import('../index');

    await initI18n({ scope: 'public' });
    expect(i18n.global.te('navigation.home')).toBe(false);

    await upgradeI18nAfterLogin({});
    expect(i18n.global.t('navigation.home')).not.toBe('navigation.home');
    expect(i18n.global.t('navigation.home')).toBeTruthy();
  });

  it('does not skip upgrade when only public scope is loaded', async () => {
    const mod = await import('../index');
    await mod.initI18n({ scope: 'public' });
    await mod.upgradeI18nAfterLogin({});
    expect(mod.i18n.global.te('navigation.home')).toBe(true);
  });
});
