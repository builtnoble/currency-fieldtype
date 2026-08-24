import { reactive } from 'vue';
import { formatNormalizedValue, sanitizeDigits } from '@/composables/positionalCurrencyEditing';

/**
 * Build maska options for currency input using Statamic field metadata.
 *
 * The returned config formats typed digits as locale-aware currency for display,
 * while `onMaska` emits the current unmasked value via `onUnmaskedValue`. If a
 * custom symbol is provided, it replaces only the currency token via `formatToParts()`
 * so locale-specific symbol position and spacing are preserved.
 *
 * Also returns `precision`, `currencyFormatter`, and `symbol` alongside `options`
 * so callers (CurrencyFieldtype.vue) can drive decimal-position-aware editing
 * without re-deriving them.
 *
 * @param {{ currency: string, locale: string, precision?: number|string, symbol?: string }} meta
 * @param {{ onUnmaskedValue?: (unmaskedValue: string) => void }} [callbacks]
 *
 * @returns {{ options: import('vue').UnwrapNestedRefs<object>, precision: number, currencyFormatter: Intl.NumberFormat, symbol?: string }}
 */
export const useCurrencyMasking = (
    { currency, locale, precision: decimalPlaces, symbol },
    { onUnmaskedValue } = {},
) => {
    // Avoid duplicate onMaska emissions for the same normalized input value.
    let lastUnmaskedValue;

    // Normalize configured decimal places once and reuse it everywhere.
    // `number.fraction` controls maska's numeric mask behavior, while
    // `postProcess` uses the same value to convert raw digit input
    // (for example, "123456") into a decimal currency amount ("1234.56").
    const precision = Number.isFinite(Number(decimalPlaces)) ? Number(decimalPlaces) : 2;

    /** @type {Intl.NumberFormat} */
    const currencyFormatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });

    const options = reactive({
        number: {
            locale,
            fraction: precision,
            unsigned: false,
        },
        preProcess: (val) => sanitizeDigits(val),
        postProcess: (val) => {
            const digits = sanitizeDigits(val);

            if (!digits || digits === '-') {
                return '';
            }

            const normalized = Number(digits) / 10 ** precision;

            return formatNormalizedValue(normalized, currencyFormatter, symbol)
                .map((part) => part.value)
                .join('');
        },
        onMaska: (eventOrDetail) => {
            const detail = eventOrDetail?.detail ?? eventOrDetail;
            const unmaskedValue = detail?.unmasked ?? '';

            // Maska can emit multiple events during a single input/update cycle.
            if (unmaskedValue === lastUnmaskedValue) {
                return;
            }

            lastUnmaskedValue = unmaskedValue;

            if (typeof onUnmaskedValue !== 'function') {
                return;
            }

            onUnmaskedValue(unmaskedValue);
        },
    });

    return { options, precision, currencyFormatter, symbol };
};
