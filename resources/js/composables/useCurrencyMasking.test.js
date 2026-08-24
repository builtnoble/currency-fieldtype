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

describe('preProcess: aligns fractional digits to the configured precision', () => {
    it('leaves a value without a decimal separator untouched (already-sanitized digits)', () => {
        const { options } = buildMasking();

        expect(options.preProcess('1234')).toBe('1234');
    });

    it('pads an under-precision fraction', () => {
        const { options } = buildMasking();

        expect(options.preProcess('12.3')).toBe('1230');
    });

    it('truncates an over-precision fraction', () => {
        const { options } = buildMasking();

        expect(options.preProcess('12.345')).toBe('1234');
    });

    it('preserves a leading minus sign with a decimal separator', () => {
        const { options } = buildMasking();

        expect(options.preProcess('-12.3')).toBe('-1230');
    });

    it('preserves a leading minus sign without a decimal separator', () => {
        const { options } = buildMasking();

        expect(options.preProcess('-1234')).toBe('-1234');
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
