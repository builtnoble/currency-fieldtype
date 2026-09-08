import { describe, expect, it, vi } from 'vitest';
import { useCurrencyMasking } from './useCurrencyMasking';

const buildMasking = (overrides = {}, callbacks = {}) =>
    useCurrencyMasking({ currency: 'USD', locale: 'en-US', precision: 2, ...overrides }, callbacks);

describe('precision resolution: normalizes the configured decimal places', () => {
    it('defaults to 2 when precision is not provided', () => {
        const { options } = useCurrencyMasking({ currency: 'USD', locale: 'en-US' });

        expect(options.number.fraction).toBe(2);
    });

    it('coerces a numeric string precision', () => {
        const { options } = buildMasking({ precision: '3' });

        expect(options.number.fraction).toBe(3);
    });

    it('allows negative amounts by disabling the unsigned mask option', () => {
        const { options } = buildMasking();

        expect(options.number.unsigned).toBe(false);
    });
});

describe('locale handling: passes the configured locale through to formatting', () => {
    it('exposes the configured locale to maska for its own live-typing formatting', () => {
        const { options } = buildMasking({ locale: 'de-DE' });

        expect(options.number.locale).toBe('de-DE');
    });

    it('formats with a comma decimal separator for a comma-decimal locale', () => {
        const { options } = buildMasking({ locale: 'de-DE', currency: 'EUR' });

        const formatted = options.postProcess('1234');

        expect(formatted).toContain(',34');
        expect(formatted).not.toContain('.34');
    });

    it('places a suffixed currency symbol for a locale that appends it', () => {
        const { options } = buildMasking({ locale: 'de-DE', currency: 'EUR' });

        const formatted = options.postProcess('1234');

        expect(formatted).toMatch(/€$/u);
        expect(formatted).not.toMatch(/^€/u);
    });

    it('returns the currencyFormatter configured with the given locale', () => {
        const { currencyFormatter } = buildMasking({ locale: 'de-DE', currency: 'EUR' });

        expect(currencyFormatter.resolvedOptions().locale).toBe('de-DE');
    });

    it('formats negative amounts correctly for a comma-decimal locale', () => {
        const { options } = buildMasking({ locale: 'de-DE', currency: 'EUR' });

        const formatted = options.postProcess('-1234');

        expect(formatted).toContain('-');
        expect(formatted).toContain(',34');
    });
});

describe('preProcess: strips the current field value to raw digits', () => {
    // preProcess receives the full current input value on every keystroke
    // (not just the newly typed character), and that value always contains
    // a decimal point once the field is non-empty (e.g. "$0.00"). Splitting
    // on that separator to align a fraction, as if it were a one-off pasted
    // value, misinterprets that per-keystroke value and breaks cents-first
    // typing (see git history on this file for the regression it caused).
    // Plain digit-stripping is what lets maska's own accumulation drive
    // cents-first entry correctly.
    it('strips symbols, separators, and grouping to raw digits', () => {
        const { options } = buildMasking();

        expect(options.preProcess('$1,234.56')).toBe('123456');
    });

    it('preserves a leading minus sign', () => {
        const { options } = buildMasking();

        expect(options.preProcess('-$12.34')).toBe('-1234');
    });

    it('returns an empty string for empty input', () => {
        const { options } = buildMasking();

        expect(options.preProcess('')).toBe('');
    });
});

describe('postProcess: formats raw subunit digits as locale-aware currency', () => {
    it('returns an empty string for empty input', () => {
        const { options } = buildMasking();

        expect(options.postProcess('')).toBe('');
    });

    it('returns an empty string for a lone minus sign', () => {
        const { options } = buildMasking();

        expect(options.postProcess('-')).toBe('');
    });

    it('formats positive digits as currency', () => {
        const { options } = buildMasking();

        expect(options.postProcess('1234')).toBe('$12.34');
    });

    it('formats negative digits as negative currency', () => {
        const { options } = buildMasking();

        const formatted = options.postProcess('-1234');

        expect(formatted).toContain('-');
        expect(formatted).toContain('12.34');
    });

    it('substitutes a custom symbol while preserving locale-specific placement', () => {
        const { options } = buildMasking({ symbol: 'Bucks' });

        const formatted = options.postProcess('1234');

        expect(formatted).toContain('Bucks');
        expect(formatted).not.toContain('$');
    });
});

describe('onMaska: emits deduplicated unmasked values', () => {
    it('calls onUnmaskedValue when the unmasked value changes', () => {
        const onUnmaskedValue = vi.fn();
        const { options } = buildMasking({}, { onUnmaskedValue });

        options.onMaska({ detail: { unmasked: '1234' } });

        expect(onUnmaskedValue).toHaveBeenCalledWith('1234');
    });

    it('ignores duplicate events for the same unmasked value', () => {
        const onUnmaskedValue = vi.fn();
        const { options } = buildMasking({}, { onUnmaskedValue });

        options.onMaska({ detail: { unmasked: '1234' } });
        options.onMaska({ detail: { unmasked: '1234' } });

        expect(onUnmaskedValue).toHaveBeenCalledTimes(1);
    });

    it('emits again once the unmasked value changes', () => {
        const onUnmaskedValue = vi.fn();
        const { options } = buildMasking({}, { onUnmaskedValue });

        options.onMaska({ detail: { unmasked: '1234' } });
        options.onMaska({ detail: { unmasked: '5678' } });

        expect(onUnmaskedValue).toHaveBeenCalledTimes(2);
        expect(onUnmaskedValue).toHaveBeenLastCalledWith('5678');
    });

    it('accepts a flat detail shape in addition to a CustomEvent-like shape', () => {
        const onUnmaskedValue = vi.fn();
        const { options } = buildMasking({}, { onUnmaskedValue });

        options.onMaska({ unmasked: '1234' });

        expect(onUnmaskedValue).toHaveBeenCalledWith('1234');
    });

    it('does not throw when no onUnmaskedValue callback is provided', () => {
        const { options } = buildMasking();

        expect(() => options.onMaska({ detail: { unmasked: '1234' } })).not.toThrow();
    });
});
