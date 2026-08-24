import { describe, expect, it } from 'vitest';
import {
    classifyAdjacentChar,
    classifyOffsets,
    computeDecimalPaste,
    computeEdit,
    deriveStateFromParts,
    findCaretOffset,
    formatNormalizedValue,
    isEndPosition,
    resolveCaretTarget,
    resolveKeydownOperation,
    sanitizeDigits,
    splitPastedDecimal,
    toSubunitString,
} from './positionalCurrencyEditing';

const usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const eurDeFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const jpyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const bhdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'BHD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
});

const partsFor = (formatter, value, symbol) => formatNormalizedValue(value, formatter, symbol);
const offsetsFor = (formatter, value, symbol) => classifyOffsets(partsFor(formatter, value, symbol));

describe('sanitizeDigits: strips to a signed digit string', () => {
    it('preserves a leading minus sign', () => {
        expect(sanitizeDigits('-$12.34')).toBe('-1234');
    });

    it('returns an empty string for empty input', () => {
        expect(sanitizeDigits('')).toBe('');
    });
});

describe('formatNormalizedValue: substitutes a custom symbol without disturbing other parts', () => {
    it('leaves parts untouched when no symbol is given', () => {
        const parts = partsFor(usdFormatter, 12.34);

        expect(parts.map((part) => part.value).join('')).toBe('$12.34');
    });

    it('substitutes only the currency part', () => {
        const parts = partsFor(usdFormatter, 12.34, 'Bucks');

        expect(parts.map((part) => part.value).join('')).toBe('Bucks12.34');
        expect(parts.find((part) => part.type === 'currency').value).toBe('Bucks');
    });
});

describe('classifyOffsets: maps each character offset to its formatToParts type', () => {
    it('classifies a simple en-US positive value', () => {
        expect(offsetsFor(usdFormatter, 12.34)).toEqual([
            'other',
            'integer',
            'integer',
            'decimal',
            'fraction',
            'fraction',
        ]);
    });

    it('classifies an en-US negative value with the sign before the currency symbol', () => {
        expect(offsetsFor(usdFormatter, -12.34)).toEqual([
            'minusSign',
            'other',
            'integer',
            'integer',
            'decimal',
            'fraction',
            'fraction',
        ]);
    });

    it('classifies grouped thousands as "group"', () => {
        expect(offsetsFor(usdFormatter, 1234.56)).toEqual([
            'other',
            'integer',
            'group',
            'integer',
            'integer',
            'integer',
            'decimal',
            'fraction',
            'fraction',
        ]);
    });

    it('classifies a de-DE value with a suffixed symbol and comma decimal', () => {
        // "1.234,56 €"
        expect(offsetsFor(eurDeFormatter, 1234.56)).toEqual([
            'integer',
            'group',
            'integer',
            'integer',
            'integer',
            'decimal',
            'fraction',
            'fraction',
            'other',
            'other',
        ]);
    });

    it('classifies a de-DE negative value with the minus sign first', () => {
        const offsets = offsetsFor(eurDeFormatter, -12.34);
        const parts = partsFor(eurDeFormatter, -12.34);

        expect(parts[0].type).toBe('minusSign');
        expect(offsets[0]).toBe('minusSign');
    });

    it('classifies a zero-decimal currency with no decimal or fraction parts', () => {
        const offsets = offsetsFor(jpyFormatter, 1234);

        expect(offsets).not.toContain('decimal');
        expect(offsets).not.toContain('fraction');
        expect(offsets).toContain('integer');
    });

    it('classifies a three-decimal currency fraction', () => {
        const offsets = offsetsFor(bhdFormatter, 12.345);

        expect(offsets.filter((type) => type === 'fraction')).toHaveLength(3);
    });
});

describe('isEndPosition: true only when no digits remain at or after the caret', () => {
    it('is true at the very end of a simple value', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(isEndPosition(offsets, offsets.length)).toBe(true);
    });

    it('is true right after the last fraction digit even with a trailing suffix', () => {
        const offsets = offsetsFor(eurDeFormatter, 12.34);
        const lastFractionIndex = offsets.lastIndexOf('fraction');

        expect(isEndPosition(offsets, lastFractionIndex + 1)).toBe(true);
    });

    it('is false before the currency symbol', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(isEndPosition(offsets, 0)).toBe(false);
    });

    it('is false between fraction digits', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);
        const decimalIndex = offsets.indexOf('decimal');

        expect(isEndPosition(offsets, decimalIndex + 1)).toBe(false);
    });
});

describe('deriveStateFromParts: extracts sign/whole/fraction digit strings', () => {
    it('extracts a positive value', () => {
        const parts = partsFor(usdFormatter, 12.34);

        expect(deriveStateFromParts(classifyOffsets(parts), parts)).toEqual({ sign: '', whole: '12', fraction: '34' });
    });

    it('extracts a negative value', () => {
        const parts = partsFor(usdFormatter, -12.34);

        expect(deriveStateFromParts(classifyOffsets(parts), parts)).toEqual({ sign: '-', whole: '12', fraction: '34' });
    });

    it('extracts grouped whole digits without the group separator', () => {
        const parts = partsFor(usdFormatter, 1234.56);

        expect(deriveStateFromParts(classifyOffsets(parts), parts)).toEqual({
            sign: '',
            whole: '1234',
            fraction: '56',
        });
    });

    it('extracts a zero-decimal value with an empty fraction', () => {
        const parts = partsFor(jpyFormatter, 1234);

        expect(deriveStateFromParts(classifyOffsets(parts), parts)).toEqual({ sign: '', whole: '1234', fraction: '' });
    });
});

describe('resolveCaretTarget: maps a caret offset to a section and digit index', () => {
    it('resolves a position within the whole part', () => {
        // "$12.34", caret between "1" and "2"
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(resolveCaretTarget(offsets, 2)).toEqual({ section: 'whole', digitIndex: 1 });
    });

    it('resolves a position before the currency symbol as the start of whole', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(resolveCaretTarget(offsets, 0)).toEqual({ section: 'whole', digitIndex: 0 });
    });

    it('resolves a position within the fraction', () => {
        // "$12.34", caret between "3" and "4"
        const offsets = offsetsFor(usdFormatter, 12.34);
        const decimalIndex = offsets.indexOf('decimal');

        expect(resolveCaretTarget(offsets, decimalIndex + 2)).toEqual({ section: 'fraction', digitIndex: 1 });
    });

    it('resolves a position right after the decimal point as the start of fraction', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);
        const decimalIndex = offsets.indexOf('decimal');

        expect(resolveCaretTarget(offsets, decimalIndex + 1)).toEqual({ section: 'fraction', digitIndex: 0 });
    });

    it('skips group separators when counting whole digits', () => {
        // "$1,234.56", caret right after the group separator
        const offsets = offsetsFor(usdFormatter, 1234.56);
        const groupIndex = offsets.indexOf('group');

        expect(resolveCaretTarget(offsets, groupIndex + 1)).toEqual({ section: 'whole', digitIndex: 1 });
    });

    it('resolves a position after a leading minus sign as the start of whole', () => {
        const offsets = offsetsFor(usdFormatter, -12.34);

        expect(resolveCaretTarget(offsets, 1)).toEqual({ section: 'whole', digitIndex: 0 });
    });
});

describe('classifyAdjacentChar: finds the nearest non-group character adjacent to the caret', () => {
    it('finds the digit before the caret, skipping a group separator', () => {
        // "$1,234.56", caret right after the group separator
        const offsets = offsetsFor(usdFormatter, 1234.56);
        const groupIndex = offsets.indexOf('group');

        expect(classifyAdjacentChar(offsets, groupIndex + 1, 'before')).toBe('integer');
    });

    it('returns null when nothing precedes the caret', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(classifyAdjacentChar(offsets, 0, 'before')).toBe(null);
    });

    it('returns null when nothing follows the caret', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(classifyAdjacentChar(offsets, offsets.length, 'after')).toBe(null);
    });

    it('finds the minus sign immediately before the caret', () => {
        const offsets = offsetsFor(usdFormatter, -12.34);

        expect(classifyAdjacentChar(offsets, 1, 'before')).toBe('minusSign');
    });

    it('finds the minus sign immediately after the caret in a suffixed-symbol locale', () => {
        const offsets = offsetsFor(eurDeFormatter, -12.34);

        expect(classifyAdjacentChar(offsets, 0, 'after')).toBe('minusSign');
    });

    it('finds the decimal separator adjacent to the caret', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);
        const decimalIndex = offsets.indexOf('decimal');

        expect(classifyAdjacentChar(offsets, decimalIndex + 1, 'before')).toBe('decimal');
        expect(classifyAdjacentChar(offsets, decimalIndex, 'after')).toBe('decimal');
    });

    it('finds the currency symbol adjacent to the caret', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(classifyAdjacentChar(offsets, 1, 'before')).toBe('other');
    });
});

describe('resolveKeydownOperation: maps a key + caret position to an edit operation', () => {
    it('resolves a digit key to an insert-digit operation', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(resolveKeydownOperation({ key: '9', offsetTypes: offsets, caret: 2 })).toEqual({
            type: 'insert-digit',
            digit: '9',
            target: { section: 'whole', digitIndex: 1 },
        });
    });

    it('resolves Backspace next to a whole digit to delete-before', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(resolveKeydownOperation({ key: 'Backspace', offsetTypes: offsets, caret: 2 })).toEqual({
            type: 'delete-before',
            target: { section: 'whole', digitIndex: 1 },
        });
    });

    it('resolves Delete next to a fraction digit to delete-after', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);
        const decimalIndex = offsets.indexOf('decimal');

        expect(resolveKeydownOperation({ key: 'Delete', offsetTypes: offsets, caret: decimalIndex + 1 })).toEqual({
            type: 'delete-after',
            target: { section: 'fraction', digitIndex: 0 },
        });
    });

    it('resolves Backspace right after the minus sign to toggle-sign', () => {
        const offsets = offsetsFor(usdFormatter, -12.34);

        expect(resolveKeydownOperation({ key: 'Backspace', offsetTypes: offsets, caret: 1 })).toEqual({
            type: 'toggle-sign',
        });
    });

    it('resolves Delete right before the minus sign to toggle-sign', () => {
        const offsets = offsetsFor(usdFormatter, -12.34);

        expect(resolveKeydownOperation({ key: 'Delete', offsetTypes: offsets, caret: 0 })).toEqual({
            type: 'toggle-sign',
        });
    });

    it('resolves Backspace right after the decimal point to delete the last whole digit', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);
        const decimalIndex = offsets.indexOf('decimal');

        expect(resolveKeydownOperation({ key: 'Backspace', offsetTypes: offsets, caret: decimalIndex + 1 })).toEqual({
            type: 'delete-before',
            target: { section: 'whole', digitIndex: 2 },
        });
    });

    it('resolves Delete right before the decimal point to delete the first fraction digit', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);
        const decimalIndex = offsets.indexOf('decimal');

        expect(resolveKeydownOperation({ key: 'Delete', offsetTypes: offsets, caret: decimalIndex })).toEqual({
            type: 'delete-after',
            target: { section: 'fraction', digitIndex: 0 },
        });
    });

    it('resolves Backspace next to the currency symbol to null (no-op)', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(resolveKeydownOperation({ key: 'Backspace', offsetTypes: offsets, caret: 1 })).toBe(null);
    });

    it('resolves an unrelated key to null', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(resolveKeydownOperation({ key: 'ArrowLeft', offsetTypes: offsets, caret: 2 })).toBe(null);
    });
});

describe('computeEdit: applies an edit operation to whole/fraction/sign state', () => {
    const state = { sign: '', whole: '12', fraction: '34' };

    it('inserts a digit into the whole part', () => {
        expect(
            computeEdit(state, { type: 'insert-digit', digit: '9', target: { section: 'whole', digitIndex: 1 } }, 2),
        ).toEqual({
            sign: '',
            whole: '192',
            fraction: '34',
            caret: { section: 'whole', digitIndex: 2 },
        });
    });

    it('replaces a lone zero placeholder rather than prepending', () => {
        const zeroState = { sign: '', whole: '0', fraction: '23' };

        expect(
            computeEdit(
                zeroState,
                { type: 'insert-digit', digit: '5', target: { section: 'whole', digitIndex: 0 } },
                2,
            ),
        ).toEqual({
            sign: '',
            whole: '5',
            fraction: '23',
            caret: { section: 'whole', digitIndex: 1 },
        });
    });

    it('inserts a digit into the fraction, trimming overflow from the right', () => {
        expect(
            computeEdit(state, { type: 'insert-digit', digit: '9', target: { section: 'fraction', digitIndex: 1 } }, 2),
        ).toEqual({
            sign: '',
            whole: '12',
            fraction: '39',
            caret: { section: 'fraction', digitIndex: 2 },
        });
    });

    it('deletes a digit before the caret in the whole part', () => {
        expect(computeEdit(state, { type: 'delete-before', target: { section: 'whole', digitIndex: 1 } }, 2)).toEqual({
            sign: '',
            whole: '2',
            fraction: '34',
            caret: { section: 'whole', digitIndex: 0 },
        });
    });

    it('normalizes an emptied whole part to "0"', () => {
        const singleDigitState = { sign: '', whole: '9', fraction: '00' };

        expect(
            computeEdit(singleDigitState, { type: 'delete-before', target: { section: 'whole', digitIndex: 1 } }, 2),
        ).toEqual({
            sign: '',
            whole: '0',
            fraction: '00',
            caret: { section: 'whole', digitIndex: 0 },
        });
    });

    it('deletes a digit in the fraction and pads a trailing zero', () => {
        expect(
            computeEdit(state, { type: 'delete-before', target: { section: 'fraction', digitIndex: 1 } }, 2),
        ).toEqual({
            sign: '',
            whole: '12',
            fraction: '40',
            caret: { section: 'fraction', digitIndex: 0 },
        });
    });

    it('deletes the digit after the caret in the fraction (Delete key)', () => {
        expect(computeEdit(state, { type: 'delete-after', target: { section: 'fraction', digitIndex: 0 } }, 2)).toEqual(
            {
                sign: '',
                whole: '12',
                fraction: '40',
                caret: { section: 'fraction', digitIndex: 0 },
            },
        );
    });

    it('toggles the sign on', () => {
        expect(computeEdit(state, { type: 'toggle-sign' }, 2)).toEqual({
            sign: '-',
            whole: '12',
            fraction: '34',
            caret: { section: 'whole', digitIndex: 0 },
        });
    });

    it('toggles the sign off', () => {
        const negativeState = { sign: '-', whole: '12', fraction: '34' };

        expect(computeEdit(negativeState, { type: 'toggle-sign' }, 2)).toEqual({
            sign: '',
            whole: '12',
            fraction: '34',
            caret: { section: 'whole', digitIndex: 0 },
        });
    });

    it('handles zero-decimal precision with an empty fraction', () => {
        const jpyState = { sign: '', whole: '1234', fraction: '' };

        expect(
            computeEdit(jpyState, { type: 'insert-digit', digit: '5', target: { section: 'whole', digitIndex: 2 } }, 0),
        ).toEqual({
            sign: '',
            whole: '12534',
            fraction: '',
            caret: { section: 'whole', digitIndex: 3 },
        });
    });
});

describe('toSubunitString: concatenates sign/whole/fraction', () => {
    it('concatenates a positive value', () => {
        expect(toSubunitString({ sign: '', whole: '12', fraction: '34' })).toBe('1234');
    });

    it('concatenates a negative value', () => {
        expect(toSubunitString({ sign: '-', whole: '12', fraction: '34' })).toBe('-1234');
    });
});

describe('findCaretOffset: inverse of resolveCaretTarget against a new value', () => {
    it('round-trips through resolveCaretTarget for a whole-part position', () => {
        const offsets = offsetsFor(usdFormatter, 192.34);

        expect(findCaretOffset(offsets, { section: 'whole', digitIndex: 2 })).toBe(3);
        expect(resolveCaretTarget(offsets, 3)).toEqual({ section: 'whole', digitIndex: 2 });
    });

    it('round-trips through resolveCaretTarget for a fraction-part position', () => {
        const offsets = offsetsFor(usdFormatter, 12.39);
        const decimalIndex = offsets.indexOf('decimal');

        expect(findCaretOffset(offsets, { section: 'fraction', digitIndex: 2 })).toBe(decimalIndex + 3);
        expect(resolveCaretTarget(offsets, decimalIndex + 3)).toEqual({ section: 'fraction', digitIndex: 2 });
    });

    it('positions right after the last whole digit when the index reaches the total count', () => {
        const offsets = offsetsFor(usdFormatter, 12.34);

        expect(findCaretOffset(offsets, { section: 'whole', digitIndex: 2 })).toBe(3);
    });

    it('positions right after the decimal point for a zero-decimal fraction target', () => {
        const offsets = offsetsFor(jpyFormatter, 1234);
        const target = findCaretOffset(offsets, { section: 'fraction', digitIndex: 0 });

        expect(target).toBe(offsets.length);
    });
});

describe('splitPastedDecimal: splits pasted text on its own decimal separator', () => {
    it('splits a plain decimal string', () => {
        expect(splitPastedDecimal('192.34')).toEqual({ whole: '192', fraction: '34', isNegative: false });
    });

    it('detects a negative sign anywhere in the pasted text', () => {
        expect(splitPastedDecimal('-192.34')).toEqual({ whole: '192', fraction: '34', isNegative: true });
    });

    it('strips non-digit characters from each side', () => {
        expect(splitPastedDecimal('$1,192.34')).toEqual({ whole: '1192', fraction: '34', isNegative: false });
    });

    it('splits on the last separator when a comma is used as the decimal point', () => {
        expect(splitPastedDecimal('1.192,34')).toEqual({ whole: '1192', fraction: '34', isNegative: false });
    });

    it('returns null for a plain digit sequence with no separator', () => {
        expect(splitPastedDecimal('19234')).toBe(null);
    });
});

describe('computeDecimalPaste: splits a decimal paste at the caret position', () => {
    it('inserts the pasted whole digits and replaces the fraction (caret before the decimal)', () => {
        const state = { sign: '', whole: '1', fraction: '00' };
        const split = { whole: '192', fraction: '34', isNegative: false };

        expect(computeDecimalPaste(state, split, { section: 'whole', digitIndex: 1 }, 2)).toEqual({
            sign: '',
            whole: '1192',
            fraction: '34',
            caret: { section: 'whole', digitIndex: 4 },
        });
    });

    it('inserts the pasted whole digits at a position within an existing whole part', () => {
        const state = { sign: '', whole: '12', fraction: '34' };
        const split = { whole: '9', fraction: '56', isNegative: false };

        expect(computeDecimalPaste(state, split, { section: 'whole', digitIndex: 1 }, 2)).toEqual({
            sign: '',
            whole: '192',
            fraction: '56',
            caret: { section: 'whole', digitIndex: 2 },
        });
    });

    it('appends the pasted whole digits to the end of whole when the caret is in the fraction', () => {
        const state = { sign: '', whole: '12', fraction: '34' };
        const split = { whole: '9', fraction: '56', isNegative: false };

        expect(computeDecimalPaste(state, split, { section: 'fraction', digitIndex: 1 }, 2)).toEqual({
            sign: '',
            whole: '129',
            fraction: '56',
            caret: { section: 'whole', digitIndex: 3 },
        });
    });

    it('pads a pasted fraction shorter than the configured precision', () => {
        const state = { sign: '', whole: '1', fraction: '00' };
        const split = { whole: '2', fraction: '3', isNegative: false };

        expect(computeDecimalPaste(state, split, { section: 'whole', digitIndex: 1 }, 2)).toEqual({
            sign: '',
            whole: '12',
            fraction: '30',
            caret: { section: 'whole', digitIndex: 2 },
        });
    });

    it('truncates a pasted fraction longer than the configured precision', () => {
        const state = { sign: '', whole: '1', fraction: '00' };
        const split = { whole: '2', fraction: '345', isNegative: false };

        expect(computeDecimalPaste(state, split, { section: 'whole', digitIndex: 1 }, 2)).toEqual({
            sign: '',
            whole: '12',
            fraction: '34',
            caret: { section: 'whole', digitIndex: 2 },
        });
    });

    it('forces the sign negative when the pasted text has its own minus sign', () => {
        const state = { sign: '', whole: '1', fraction: '00' };
        const split = { whole: '2', fraction: '34', isNegative: true };

        expect(computeDecimalPaste(state, split, { section: 'whole', digitIndex: 1 }, 2)).toEqual({
            sign: '-',
            whole: '12',
            fraction: '34',
            caret: { section: 'whole', digitIndex: 2 },
        });
    });

    it('leaves the existing sign untouched when the pasted text has no minus sign', () => {
        const state = { sign: '-', whole: '1', fraction: '00' };
        const split = { whole: '2', fraction: '34', isNegative: false };

        expect(computeDecimalPaste(state, split, { section: 'whole', digitIndex: 1 }, 2).sign).toBe('-');
    });
});
