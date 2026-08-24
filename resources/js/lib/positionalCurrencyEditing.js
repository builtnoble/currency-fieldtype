/**
 * Pure, DOM-free helpers for the currency field's decimal-position-aware
 * editing. Kept separate from useCurrencyMasking.js so this logic (and its
 * classification of Intl.NumberFormat.formatToParts() output) can be unit
 * tested in isolation without any DOM or maska dependency.
 */

// Strip everything except digits (preserving a leading minus sign) so
// currency symbols, separators, and spaces are ignored. This treats the
// whole field as one undifferentiated digit buffer, which is what makes
// cents-first entry at the end of the field work.
export const sanitizeDigits = (val) => {
    const raw = String(val ?? '');
    const digits = raw.replace(/[^\d]/g, '');

    return digits && raw.includes('-') ? `-${digits}` : digits;
};

/**
 * Format a normalized decimal amount into Intl.NumberFormat parts, with an
 * optional custom symbol substituted for the currency token. This is the
 * single source of truth for that substitution so the displayed string and
 * the caret-position classification below can never drift out of sync.
 *
 * @param {number} normalized
 * @param {Intl.NumberFormat} formatter
 * @param {string} [symbol]
 * @returns {Intl.NumberFormatPart[]}
 */
export const formatNormalizedValue = (normalized, formatter, symbol) => {
    const parts = formatter.formatToParts(normalized);

    if (!symbol) {
        return parts;
    }

    return parts.map((part) => (part.type === 'currency' ? { type: 'currency', value: symbol } : part));
};

/**
 * Classify every UTF-16 code unit of the formatted string by which
 * formatToParts() part it belongs to, so caret offsets (selectionStart's
 * own indexing) can be mapped to a semantic position without hardcoding
 * locale-specific characters like "." or ",".
 *
 * @param {Intl.NumberFormatPart[]} parts
 * @returns {Array<'integer'|'fraction'|'group'|'decimal'|'minusSign'|'other'>}
 */
export const classifyOffsets = (parts) => {
    const knownTypes = ['integer', 'fraction', 'group', 'decimal', 'minusSign'];

    return parts.flatMap((part) => {
        const type = knownTypes.includes(part.type) ? part.type : 'other';

        return Array.from({ length: part.value.length }, () => type);
    });
};

/**
 * "End of field" means no digit-bearing characters remain at or after the
 * caret; trailing decorative characters (e.g. a suffixed " €") still count
 * as the end, so this is not simply `caret === offsetTypes.length`.
 */
export const isEndPosition = (offsetTypes, caret) => {
    for (let i = caret; i < offsetTypes.length; i++) {
        if (offsetTypes[i] === 'integer' || offsetTypes[i] === 'fraction') {
            return false;
        }
    }

    return true;
};

/**
 * Parse the current displayed value's classification into structured
 * { sign, whole, fraction } digit strings.
 *
 * @param {Array<string>} offsetTypes
 * @param {Intl.NumberFormatPart[]} parts
 */
export const deriveStateFromParts = (offsetTypes, parts) => {
    const digitsFor = (type) =>
        parts
            .filter((part) => part.type === type)
            .map((part) => part.value)
            .join('');

    return {
        sign: offsetTypes.includes('minusSign') ? '-' : '',
        whole: digitsFor('integer') || '0',
        fraction: digitsFor('fraction'),
    };
};

const countType = (offsetTypes, type) => offsetTypes.filter((entry) => entry === type).length;

/**
 * Resolve which section and digit-index an edit at the given caret offset
 * targets, as a count of same-section digits strictly before the caret
 * (skipping group, decimal, minusSign, and other non-digit characters).
 * This same value serves both as an insertion point ("insert before the
 * digitIndex-th digit") and, from resolveKeydownOperation, as the shared
 * basis for delete-before (removes digitIndex - 1) and delete-after
 * (removes digitIndex).
 *
 * @returns {{ section: 'whole'|'fraction', digitIndex: number }}
 */
export const resolveCaretTarget = (offsetTypes, caret) => {
    const before = offsetTypes.slice(0, caret);
    const section = before.includes('decimal') ? 'fraction' : 'whole';
    const matchType = section === 'fraction' ? 'fraction' : 'integer';

    let digitIndex = 0;

    for (let i = 0; i < caret; i++) {
        if (offsetTypes[i] === matchType) {
            digitIndex++;
        }
    }

    return { section, digitIndex };
};

/**
 * The nearest real (non-group) character adjacent to the caret in the
 * given direction, or null if none exists (e.g. Backspace at position 0).
 *
 * @param {Array<string>} offsetTypes
 * @param {number} caret
 * @param {'before'|'after'} direction
 */
export const classifyAdjacentChar = (offsetTypes, caret, direction) => {
    const step = direction === 'before' ? -1 : 1;
    let index = direction === 'before' ? caret - 1 : caret;

    while (index >= 0 && index < offsetTypes.length && offsetTypes[index] === 'group') {
        index += step;
    }

    if (index < 0 || index >= offsetTypes.length) {
        return null;
    }

    return offsetTypes[index];
};

/**
 * Map a keydown event's key and the current caret classification to a
 * concrete edit operation, or null if this key+position combination has no
 * defined effect (still preventDefault, no mutation, e.g. Backspace next to
 * a currency symbol).
 *
 * @param {{ key: string, offsetTypes: Array<string>, caret: number }} args
 */
export const resolveKeydownOperation = ({ key, offsetTypes, caret }) => {
    if (/^\d$/.test(key)) {
        return { type: 'insert-digit', digit: key, target: resolveCaretTarget(offsetTypes, caret) };
    }

    if (key !== 'Backspace' && key !== 'Delete') {
        return null;
    }

    const direction = key === 'Backspace' ? 'before' : 'after';
    const adjacent = classifyAdjacentChar(offsetTypes, caret, direction);

    if (adjacent === 'minusSign') {
        return { type: 'toggle-sign' };
    }

    if (adjacent === 'integer' || adjacent === 'fraction') {
        return {
            type: direction === 'before' ? 'delete-before' : 'delete-after',
            target: resolveCaretTarget(offsetTypes, caret),
        };
    }

    if (adjacent === 'decimal') {
        // Backspace right after the decimal removes the last whole digit;
        // Delete right before the decimal removes the first fraction
        // digit. Both cross the decimal boundary rather than acting on
        // whichever section the caret's raw position would naively imply.
        return direction === 'before'
            ? { type: 'delete-before', target: { section: 'whole', digitIndex: countType(offsetTypes, 'integer') } }
            : { type: 'delete-after', target: { section: 'fraction', digitIndex: 0 } };
    }

    // Adjacent to a currency symbol/literal, or nothing there at all.
    return null;
};

/**
 * Core state transition: applies one edit operation to the current
 * { sign, whole, fraction } state, returning the new state plus where the
 * caret should conceptually land (as a { section, digitIndex } target for
 * findCaretOffset to resolve against the newly-formatted value).
 *
 * @param {{ sign: ''|'-', whole: string, fraction: string }} state
 * @param {object} operation
 * @param {number} precision
 */
export const computeEdit = (state, operation, precision) => {
    if (operation.type === 'toggle-sign') {
        return {
            sign: state.sign === '-' ? '' : '-',
            whole: state.whole,
            fraction: state.fraction,
            caret: { section: 'whole', digitIndex: 0 },
        };
    }

    if (operation.type === 'insert-digit') {
        const { section, digitIndex } = operation.target;

        if (section === 'whole') {
            // Leading-zero placeholder: replace rather than prepend, so
            // $0.23 + insert "5" before the 0 gives $5.23, not $50.23.
            if (state.whole === '0' && digitIndex === 0) {
                return {
                    sign: state.sign,
                    whole: operation.digit,
                    fraction: state.fraction,
                    caret: { section: 'whole', digitIndex: 1 },
                };
            }

            const whole = state.whole.slice(0, digitIndex) + operation.digit + state.whole.slice(digitIndex);

            return {
                sign: state.sign,
                whole,
                fraction: state.fraction,
                caret: { section: 'whole', digitIndex: digitIndex + 1 },
            };
        }

        // section === 'fraction': fixed width, so inserting drops the
        // excess from the right edge once the length exceeds precision.
        let fraction = state.fraction.slice(0, digitIndex) + operation.digit + state.fraction.slice(digitIndex);
        const caretIndex = Math.min(digitIndex + 1, precision);

        if (fraction.length > precision) {
            fraction = fraction.slice(0, precision);
        }

        return {
            sign: state.sign,
            whole: state.whole,
            fraction,
            caret: { section: 'fraction', digitIndex: caretIndex },
        };
    }

    // delete-before removes the digit just before the caret (digitIndex -
    // 1); delete-after removes the digit just after it (digitIndex).
    const { section, digitIndex } = operation.target;
    const removeIndex = operation.type === 'delete-before' ? digitIndex - 1 : digitIndex;

    if (section === 'whole') {
        let whole = state.whole.slice(0, removeIndex) + state.whole.slice(removeIndex + 1);

        if (whole === '') {
            whole = '0';
        }

        return {
            sign: state.sign,
            whole,
            fraction: state.fraction,
            caret: { section: 'whole', digitIndex: removeIndex },
        };
    }

    // section === 'fraction': removing leaves a gap, padded back to fixed
    // width with a trailing zero.
    const fraction = (state.fraction.slice(0, removeIndex) + state.fraction.slice(removeIndex + 1)).padEnd(
        precision,
        '0',
    );

    return { sign: state.sign, whole: state.whole, fraction, caret: { section: 'fraction', digitIndex: removeIndex } };
};

/**
 * Concatenate { sign, whole, fraction } into the plain signed-digit string
 * options.postProcess() expects (matching the server-side "no decimal
 * separator = already-sanitized subunit digits" convention).
 */
export const toSubunitString = ({ sign, whole, fraction }) => `${sign}${whole}${fraction}`;

/**
 * Split arbitrary (unformatted) pasted text into whole/fraction digit
 * strings by its last "." or "," character, treated as the decimal
 * separator. Mirrors how the server (Currency::parseToSubunit) interprets
 * arbitrary decimal-style input, so a paste containing its own decimal
 * point is split the same way client- and server-side. Returns null if the
 * pasted text has no decimal separator at all (a plain digit sequence,
 * handled by repeated insert-digit operations instead).
 *
 * @param {string} text
 * @returns {{ whole: string, fraction: string, isNegative: boolean } | null}
 */
export const splitPastedDecimal = (text) => {
    const raw = String(text ?? '');
    const separatorIndex = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));

    if (separatorIndex === -1) {
        return null;
    }

    return {
        whole: raw.slice(0, separatorIndex).replace(/\D/g, ''),
        fraction: raw.slice(separatorIndex + 1).replace(/\D/g, ''),
        isNegative: raw.includes('-'),
    };
};

/**
 * Apply a decimal-splitting paste to the current state: the pasted whole
 * digits are inserted into the whole section at the target position (or
 * appended to the end of the whole if the caret was in the fraction, since
 * there's no meaningful position within the whole once past the decimal
 * point), and the fraction is replaced entirely by the pasted fraction
 * (padded/truncated to precision) rather than merged positionally, since
 * the pasted value's fraction represents the intended new fraction, not an
 * insertion into the old one.
 *
 * @param {{ sign: ''|'-', whole: string, fraction: string }} state
 * @param {{ whole: string, fraction: string, isNegative: boolean }} split
 * @param {{ section: 'whole'|'fraction', digitIndex: number }} target
 * @param {number} precision
 */
export const computeDecimalPaste = (state, split, target, precision) => {
    const insertIndex = target.section === 'whole' ? target.digitIndex : state.whole.length;
    const whole = state.whole.slice(0, insertIndex) + split.whole + state.whole.slice(insertIndex);
    const fraction = split.fraction.slice(0, precision).padEnd(precision, '0');

    return {
        sign: split.isNegative ? '-' : state.sign,
        whole,
        fraction,
        caret: { section: 'whole', digitIndex: insertIndex + split.whole.length },
    };
};

/**
 * Inverse of resolveCaretTarget: given the classification of a *newly*
 * formatted value and a { section, digitIndex } target, find the DOM
 * offset the caret should be placed at (immediately before the
 * digitIndex-th digit of that section, or immediately after that
 * section's last digit if digitIndex reaches or exceeds its digit count).
 */
export const findCaretOffset = (offsetTypes, target) => {
    const { section, digitIndex } = target;
    const matchType = section === 'whole' ? 'integer' : 'fraction';
    const decimalIndex = offsetTypes.indexOf('decimal');

    if (section === 'fraction' && decimalIndex === -1) {
        // No decimal part at all (a zero-decimal currency has no fraction
        // section to position within), so the only sensible place is the
        // end of the digit-bearing content.
        return offsetTypes.length;
    }

    const searchStart = section === 'whole' ? 0 : decimalIndex + 1;

    let count = 0;

    for (let i = searchStart; i < offsetTypes.length; i++) {
        if (offsetTypes[i] === matchType) {
            if (count === digitIndex) {
                return i;
            }

            count++;
        }
    }

    const lastMatchIndex = offsetTypes.lastIndexOf(matchType);

    return lastMatchIndex === -1 ? searchStart : lastMatchIndex + 1;
};
