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
</script>

<template>
    <Input v-maska="options" :model-value="value" />
</template>
