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
//
// KNOWN LIMITATION: this is a stopgap, not real caret support. It forces
// every edit to the end of the field regardless of where the user clicked
// or navigated to (with one exception carved out below for removing the
// leading minus sign), so positional editing — clicking into the middle of
// the value and expecting an insert/delete right there, with either mouse
// or keyboard — doesn't work. Planned to be replaced by a hybrid model:
// keep this shift-at-the-end behavior when the caret is at the very end,
// and add real decimal-position-aware insert/delete everywhere else. Most
// of this file (particularly `pinCaretOnKeydown` and
// `pinCaretOnFocusOrClick`) is expected to change shape when that lands.
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
// end like a digit edit would be. This is a narrow, single-character
// carve-out standing in for the general positional-editing support the
// hybrid model will add; it can likely be removed once that lands, since
// sign removal would just be one more positional edit at that point.
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
//
// This is precisely what breaks mouse-driven positional editing today: a
// click always gets silently overridden back to the end, regardless of
// where the user actually clicked. Once the hybrid model lands, this
// should only fire (or only override) when the resulting position isn't
// meant to support positional editing — most likely this handler goes
// away entirely, and focus/click are left alone so the browser's native
// caret placement is trusted directly.
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
