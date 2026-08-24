import CurrencyFieldtype from './components/CurrencyFieldtype.vue';

Statamic.booting(() => {
    Statamic.$components.register('currency-fieldtype', CurrencyFieldtype);
});
