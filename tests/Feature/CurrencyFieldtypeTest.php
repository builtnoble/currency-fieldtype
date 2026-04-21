<?php

use Builtnoble\CurrencyFieldtype\Fieldtypes\Currency;
use Illuminate\Support\Number;
use Statamic\Facades\Site;
use Statamic\Fields\Field;

describe('preload method: supplies metadata required by the Vue fieldtype component', function () {
    it('preloads fieldtype meta for the Vue component', function () {
        $preload = $this->fieldtype->preload();

        expect($preload)
            ->toBeArray()
            ->and($preload['currency'])->toBe('USD')
            ->and($preload['locale'])->toStartWith('en')
            ->and($preload['precision'])->toBe(2)
            ->and($preload['symbol'])->toBe('$');
    });

    it('respects a globally overridden default currency via Number::useCurrency()', function () {
        $original = Number::defaultCurrency();

        Number::useCurrency('EUR');

        $field = new Field('price', ['type' => 'currency']);
        $fieldtype = new Currency;
        $fieldtype->setField($field);

        $preload = $fieldtype->preload();

        expect($preload['currency'])->toBe('EUR')
            ->and($preload['symbol'])->toBe('€')
            ->and($fieldtype->augment(1234))->toBe('€1,234.00');

        Number::useCurrency($original);
    });
});

describe('preProcess method: transforms the stored value into the format expected by Vue', function () {
    it('formats values with preProcess', function () {
        expect($this->fieldtype->preProcess(1234))->toBe('$1,234.00');
    });

    it('formats zero value with preProcess when value is null', function () {
        expect($this->fieldtype->preProcess(null))->toBe('$0.00');
    });
});

describe('preProcessIndex method: transforms values for control panel index listings', function () {
    it('returns a formatted index value with preProcessIndex', function () {
        expect($this->fieldtype->preProcessIndex(1234))->toBe('$1,234.00');
    });

    it('keeps formatted index values aligned with ascending raw subunit sorting', function () {
        $indexedValues = collect([
            25000,
            null,
            10000,
        ])->map(fn ($value) => [
            'raw' => $value,
            'display' => $this->fieldtype->preProcessIndex($value),
        ])->sortBy('raw')
            ->values()
            ->all();

        expect($indexedValues)->toBe([
            ['raw' => null, 'display' => '$0.00'],
            ['raw' => 10000, 'display' => '$10,000.00'],
            ['raw' => 25000, 'display' => '$25,000.00'],
        ]);
    });

    it('keeps formatted index values aligned with descending raw subunit sorting', function () {
        $indexedValues = collect([
            25000,
            null,
            10000,
        ])->map(fn ($value) => [
            'raw' => $value,
            'display' => $this->fieldtype->preProcessIndex($value),
        ])->sortByDesc('raw')
            ->values()
            ->all();

        expect($indexedValues)->toBe([
            ['raw' => 25000, 'display' => '$25,000.00'],
            ['raw' => 10000, 'display' => '$10,000.00'],
            ['raw' => null, 'display' => '$0.00'],
        ]);
    });

    it('uses locale-aware formatting for index values', function () {
        Site::shouldReceive('current->lang')->andReturn('de_DE');

        $field = new Field('price', [
            'type' => 'currency',
            'currency' => 'EUR',
        ]);

        $fieldtype = new Currency;
        $fieldtype->setField($field);

        $formatted = $fieldtype->preProcessIndex(1234);

        expect($formatted)
            ->toContain(',00')
            ->toMatch('/€$/u');
    });

    it('returns a formatted zero index value with preProcessIndex when input is null', function () {
        expect($this->fieldtype->preProcessIndex(null))->toBe('$0.00');
    });
});

describe('process method: transforms the Vue field value into the value that gets saved', function () {
    it('sanitizes and stores numeric currency values with process', function () {
        expect($this->fieldtype->process('$1,234.56'))->toBe(123456);
    });

    it('stores zero when process value is null', function () {
        expect($this->fieldtype->process(null))->toBe(0);
    });
});

describe('augment method: transforms the stored value for Antlers template output', function () {
    it('formats augmented values as currency strings with augment', function () {
        expect($this->fieldtype->augment(1234))->toBe('$1,234.00');
    });

    it('formats with appended symbols for locales that append currency symbols', function () {
        Site::shouldReceive('current->lang')->andReturn('de_DE');

        $field = new Field('price', [
            'type' => 'currency',
            'currency' => 'EUR',
        ]);

        $fieldtype = new Currency;
        $fieldtype->setField($field);

        $formatted = $fieldtype->augment(1234);

        expect($formatted)
            ->toContain(',00')
            ->toMatch('/€$/u')
            ->not->toStartWith('€');
    });

    it('formats with comma decimals for locales that use commas', function () {
        Site::shouldReceive('current->lang')->andReturn('de_DE');

        $field = new Field('price', [
            'type' => 'currency',
            'currency' => 'EUR',
        ]);

        $fieldtype = new Currency;
        $fieldtype->setField($field);

        $formatted = $fieldtype->augment(1234);

        expect($formatted)
            ->toContain('€')
            ->toContain(',00')
            ->not->toContain('.00');
    });
});
