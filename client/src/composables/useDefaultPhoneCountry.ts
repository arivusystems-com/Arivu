import { computed, unref, type MaybeRef } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useLocale } from '@/composables/useLocale';
import {
  extractRecordCountry,
  resolveDefaultPhoneCountry,
} from '@/utils/phoneInput';

type CountryContext = Record<string, unknown> | null | undefined;

/**
 * Resolves default phone country for PhoneInput using regional priority chain.
 */
export function useDefaultPhoneCountry(contextSource?: MaybeRef<CountryContext>) {
  const authStore = useAuthStore();
  const { locale, currency, timeZone } = useLocale();

  const defaultPhoneCountry = computed(() => {
    const context = unref(contextSource);
    const orgSettings = authStore.organization?.settings;
    return resolveDefaultPhoneCountry({
      recordCountry: extractRecordCountry(context),
      orgDefaultPhoneCountry: orgSettings?.defaultPhoneCountry,
      orgLocale: locale.value,
      orgTimeZone: orgSettings?.timeZone || timeZone.value,
      orgCurrency: currency.value,
    });
  });

  return { defaultPhoneCountry };
}
