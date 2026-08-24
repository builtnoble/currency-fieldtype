<script setup>
import { Fieldtype } from '@statamic/cms';
import { Input } from '@statamic/cms/ui';
import { vMaska } from 'maska/vue';
import { useCurrencyMasking } from '@/composables/useCurrencyMasking';

const emit = defineEmits(Fieldtype.emits);
const props = defineProps(Fieldtype.props);

const { expose, update } = Fieldtype.use(emit, props);

defineExpose(expose);

const { options } = useCurrencyMasking(props.meta, {
    onUnmaskedValue: (unmaskedValue) => update(unmaskedValue),
});

// The displayed value is always fully re-derived from its raw digit count
// (cents-first entry, e.g. typing "1" turns "$0.00" into "$0.01"), so
// inserting/deleting a character at an arbitrary caret position produces
// garbled results — most noticeably when the caret lands before the
// currency symbol. Pinning the caret to the end keeps typing and
// backspacing operating on the rightmost digit, matching how the masking
// actually works.
const NON_MUTATING_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'Tab',
    'Shift',
    'Escape',
]);

const moveCaretToEnd = (input) => input.setSelectionRange(input.value.length, input.value.length);

// The minus sign isn't part of the digit buffer, so removing it should
// toggle the sign at its own position rather than being redirected to the
// end like a digit edit would be.
const isRemovingLeadingMinusSign = (event) => {
    const input = event.target;

    if (!input.value.startsWith('-') || input.selectionStart !== input.selectionEnd) {
        return false;
    }

    return (
        (event.key === 'Backspace' && input.selectionStart === 1) ||
        (event.key === 'Delete' && input.selectionStart === 0)
    );
};

// Repositioned synchronously so the browser's native insert/delete for this
// same keystroke happens at the end, rather than wherever the caret was.
const pinCaretOnKeydown = (event) => {
    if (event.metaKey || event.ctrlKey || NON_MUTATING_KEYS.has(event.key) || isRemovingLeadingMinusSign(event)) {
        return;
    }

    moveCaretToEnd(event.target);
};

// Deferred a frame so it runs after the browser's own default caret
// placement for the focus/click that triggered it.
const pinCaretOnFocusOrClick = (event) => {
    const input = event.target;

    requestAnimationFrame(() => moveCaretToEnd(input));
};
</script>

<template>
    <Input
        v-maska="options"
        :model-value="value"
        @focus="pinCaretOnFocusOrClick"
        @click="pinCaretOnFocusOrClick"
        @keydown="pinCaretOnKeydown"
    />
</template>
