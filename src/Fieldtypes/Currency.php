<?php

namespace Builtnoble\CurrencyFieldtype\Fieldtypes;

use Illuminate\Support\Number;
use Statamic\Dictionaries\Dictionary as DictionaryCollection;
use Statamic\Facades\Dictionary;
use Statamic\Facades\Site;
use Statamic\Fields\Fieldtype;

class Currency extends Fieldtype
{
    protected $icon = 'money-cash-bill';

    protected $keywords = ['money', 'currency', 'cash', 'dollar', 'euro', 'pound', 'yen', 'rupee'];

    protected function configFieldItems(): array
    {
        return [
            'currency' => [
                'display' => __('Currency ISO Code'),
                'instructions' => __('The ISO code of the currency, e.g. USD, EUR, GBP.'),
                'type' => 'select',
                'options' => $this->currencies()->options(),
                'default' => Number::defaultCurrency(),
                'searchable' => true,
                'width' => 50,
            ],
        ];
    }

    /**
     * Preload any additional data needed for the Vue component.
     */
    public function preload(): array
    {
        return [
            'currency' => $this->config('currency'),
            'locale' => $this->locale(),
            'precision' => $this->precision(),
            'symbol' => $this->symbol(),
        ];
    }

    /**
     * Return the currency representation of the given value as a string for
     * the Vue component, e.g. "$1,234.56"
     */
    public function preProcess($value): ?string
    {
        if ($value === null) {
            return $this->formatted(0);
        }

        return $this->formatted($value);
    }

    /**
     * Return the formatted value shown in control panel index listings.
     */
    public function preProcessIndex($value): ?string
    {
        if ($value === null) {
            return $this->formatted(0);
        }

        return $this->formatted($value);
    }

    /**
     * Process the data before it gets saved.
     */
    public function process($value): int
    {
        return (int) $this->sanitizeDigits($value);
    }

    /**
     * Format the stored value when augmented for Antlers.
     */
    public function augment($value): string
    {
        return $this->formatted($value);
    }

    /**
     * Sanitize the input value by stripping out all non-digit characters,
     * returning the raw integer value in cents (or the smallest currency unit),
     * e.g. "123456" => 123456.
     */
    protected function sanitizeDigits($value): string
    {
        return preg_replace('/[^\d]/', '', (string) ($value ?? '')) ?? '';
    }

    protected function precision(): int
    {
        $currency = $this->currencies()->get($this->config('currency'));

        return $currency['decimals'] ?? 2;
    }

    protected function symbol(): ?string
    {
        $currency = $this->currencies()->get($this->config('currency'));

        return $currency['symbol'] ?? null;
    }

    /**
     * The current site's locale with underscores converted to hyphens, e.g.
     * "en-US", "fr-FR", etc.
     */
    protected function locale(): string
    {
        return str_replace('_', '-', Site::current()->lang());
    }

    protected function formatted($value): string
    {
        return Number::currency(
            number: $value,
            in: $this->config('currency'),
            locale: $this->locale(),
            precision: $this->precision()
        );
    }

    protected function currencies(): DictionaryCollection
    {
        return Dictionary::find('currencies');
    }
}
