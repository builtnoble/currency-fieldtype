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

describe('preProcessIndex method: transforms values for control panel index listing and sorting', function () {
    it('returns numeric index value with preProcessIndex', function () {
        expect($this->fieldtype->preProcessIndex('$1,234.56'))->toBe(123456);
    });

    it('positions a value correctly between smaller and larger values for sorting', function () {
        $smaller = $this->fieldtype->preProcessIndex('$100.00');
        $middle = $this->fieldtype->preProcessIndex('$250.00');
        $larger = $this->fieldtype->preProcessIndex('$400.00');

        expect($smaller)->toBeLessThan($middle)
            ->and($middle)->toBeLessThan($larger);
    });

    it('returns null index value with preProcessIndex when input is null', function () {
        expect($this->fieldtype->preProcessIndex(null))->toBeNull();
    });

    it('sorts null index values before numeric values in ascending order', function () {
        $indexedValues = collect([
            '$250.00',
            null,
            '$100.00',
        ])->map(fn ($value) => $this->fieldtype->preProcessIndex($value))
            ->sort()
            ->values()
            ->all();

        expect($indexedValues)->toBe([
            null,
            10000,
            25000,
        ]);
    });

    it('sorts null index values after numeric values in descending order', function () {
        $indexedValues = collect([
            '$250.00',
            null,
            '$100.00',
        ])->map(fn ($value) => $this->fieldtype->preProcessIndex($value))
            ->sortDesc()
            ->values()
            ->all();

        expect($indexedValues)->toBe([
            25000,
            10000,
            null,
        ]);
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
