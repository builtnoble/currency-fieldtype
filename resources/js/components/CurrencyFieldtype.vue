<script setup>
import { Fieldtype } from '@statamic/cms';
import { Input } from '@statamic/cms/ui';
import { vMaska } from 'maska/vue';
import {
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
} from '@/composables/positionalCurrencyEditing';
import { useCurrencyMasking } from '@/composables/useCurrencyMasking';

const emit = defineEmits(Fieldtype.emits);
const props = defineProps(Fieldtype.props);

const { expose, update } = Fieldtype.use(emit, props);

defineExpose(expose);

const { options, precision, currencyFormatter, symbol } = useCurrencyMasking(props.meta, {
    onUnmaskedValue: (unmaskedValue) => update(unmaskedValue),
});

// Classifies the input's current displayed value by re-deriving it from its
// own digits, matching exactly what postProcess would (re)produce, so the
// classification always matches what's actually on screen.
const classifyCurrentValue = (input) => {
    const digits = sanitizeDigits(input.value);
    const normalized = digits && digits !== '-' ? Number(digits) / 10 ** precision : 0;

    return classifyOffsets(formatNormalizedValue(normalized, currencyFormatter, symbol));
};

// Commits a computed { sign, whole, fraction } state to the input: builds
// the new display string and caret offset from the same shared formatting
// helper the field's own postProcess uses, then dispatches a real
// InputEvent so maska's own onInput/onMaska pipeline re-processes it
// normally (confirmed idempotent) and update() fires through the existing
// wiring rather than a separate code path.
//
// update() triggers a Vue re-render that reassigns the input's raw DOM
// value from the fieldtype's underlying model (the unmasked digit string,
// not the formatted display string) before maska's own directive re-run
// reformats it back; that intermediate assignment resets the caret to the
// end. That settles across a couple of microtasks, always before the next
// paint, so re-applying the caret once more via requestAnimationFrame is a
// reliable (not timing-fragile) point to land it correctly.
const applyEdit = (input, state, caretTarget, inputType, data = null) => {
    const subunitString = toSubunitString(state);
    const normalized = Number(subunitString) / 10 ** precision;
    const parts = formatNormalizedValue(normalized, currencyFormatter, symbol);
    const offsetTypes = classifyOffsets(parts);

    input.value = parts.map((part) => part.value).join('');

    const caretOffset = findCaretOffset(offsetTypes, caretTarget);
    input.setSelectionRange(caretOffset, caretOffset);

    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType, data }));

    requestAnimationFrame(() => {
        if (document.activeElement === input) {
            input.setSelectionRange(caretOffset, caretOffset);
        }
    });
};

const handleKeydown = (event) => {
    if (event.metaKey || event.ctrlKey || event.isComposing) {
        return;
    }

    const isDigitKey = /^\d$/.test(event.key);
    const isDeleteKey = event.key === 'Backspace' || event.key === 'Delete';

    if (!isDigitKey && !isDeleteKey) {
        return;
    }

    const input = event.target;

    // A genuinely empty field has nothing to be positional about (and
    // classifyCurrentValue's digits-based reformatting would otherwise
    // synthesize a "$0.00" representation that doesn't match the real,
    // blank DOM value); defer to the existing shift-mode pipeline.
    if (input.value === '') {
        return;
    }

    // Selection replacement is out of scope for positional editing; defer
    // to the existing shift-mode pipeline.
    if (input.selectionStart !== input.selectionEnd) {
        return;
    }

    const offsetTypes = classifyCurrentValue(input);
    const caret = input.selectionStart;

    if (isEndPosition(offsetTypes, caret)) {
        return;
    }

    const operation = resolveKeydownOperation({ key: event.key, offsetTypes, caret });

    // A positional context with no defined effect (e.g. Backspace next to
    // the currency symbol): block the browser's own attempt rather than
    // letting it insert/delete somewhere nonsensical.
    event.preventDefault();

    if (!operation) {
        return;
    }

    const digits = sanitizeDigits(input.value);
    const normalized = digits && digits !== '-' ? Number(digits) / 10 ** precision : 0;
    const currentParts = formatNormalizedValue(normalized, currencyFormatter, symbol);
    const currentState = deriveStateFromParts(offsetTypes, currentParts);
    const result = computeEdit(currentState, operation, precision);

    const inputType =
        operation.type === 'insert-digit'
            ? 'insertText'
            : operation.type === 'delete-before'
              ? 'deleteContentBackward'
              : 'deleteContentForward';

    applyEdit(
        input,
        { sign: result.sign, whole: result.whole, fraction: result.fraction },
        result.caret,
        inputType,
        operation.type === 'insert-digit' ? operation.digit : null,
    );
};

const handlePaste = (event) => {
    const input = event.target;

    if (input.value === '') {
        return;
    }

    if (input.selectionStart !== input.selectionEnd) {
        return;
    }

    const offsetTypes = classifyCurrentValue(input);
    const caret = input.selectionStart;

    if (isEndPosition(offsetTypes, caret)) {
        return;
    }

    const pastedText = event.clipboardData?.getData('text') ?? '';
    const decimalSplit = splitPastedDecimal(pastedText);
    const pastedDigits = pastedText.replace(/[^\d]/g, '');

    event.preventDefault();

    if (!pastedDigits) {
        return;
    }

    const digits = sanitizeDigits(input.value);
    const normalized = digits && digits !== '-' ? Number(digits) / 10 ** precision : 0;
    const currentParts = formatNormalizedValue(normalized, currencyFormatter, symbol);
    const currentState = deriveStateFromParts(offsetTypes, currentParts);
    const target = resolveCaretTarget(offsetTypes, caret);

    let result;

    if (decimalSplit) {
        // The pasted text has its own decimal point: split it at the caret
        // rather than inserting every digit sequentially, so pasting
        // "192.34" respects its own whole/fraction structure instead of
        // being flattened into one big whole-part digit run.
        result = computeDecimalPaste(currentState, decimalSplit, target, precision);
    } else {
        let state = currentState;
        let runningTarget = target;

        for (const digit of pastedDigits) {
            const stepResult = computeEdit(state, { type: 'insert-digit', digit, target: runningTarget }, precision);
            state = { sign: stepResult.sign, whole: stepResult.whole, fraction: stepResult.fraction };
            runningTarget = stepResult.caret;
        }

        result = { ...state, caret: runningTarget };
    }

    applyEdit(
        input,
        { sign: result.sign, whole: result.whole, fraction: result.fraction },
        result.caret,
        'insertFromPaste',
        pastedDigits,
    );
};
</script>

<template>
    <Input v-maska="options" :model-value="value" @keydown="handleKeydown" @paste="handlePaste" />
</template>
