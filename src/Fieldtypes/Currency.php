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
     * the Vue component, e.g. "$1,234.56".
     */
    public function preProcess($value): ?string
    {
        if ($value === null) {
            return $this->formatted(0);
        }

        return $this->formattedStoredValue($value);
    }

    /**
     * Return the formatted value shown in control panel index listings.
     */
    public function preProcessIndex($value): ?string
    {
        if ($value === null) {
            return $this->formatted(0);
        }

        return $this->formattedStoredValue($value);
    }

    /**
     * Process the data before it gets saved.
     */
    public function process($value): int
    {
        return $this->parseToSubunit($value);
    }

    /**
     * Format the stored value when augmented for Antlers.
     */
    public function augment($value): string
    {
        return $this->formattedStoredValue($value);
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

    /**
     * Parse a decimal currency value into an integer in the currency's
     * smallest unit. If a decimal separator is present, the fractional part
     * is padded or truncated to the configured precision rather than assumed
     * to already match it, e.g. "12.3" => 1230 for a 2-decimal currency.
     * Values without a decimal separator are treated as already-sanitized
     * subunit digits, e.g. "123456" => 123456.
     */
    protected function parseToSubunit($value): int
    {
        $value = (string) ($value ?? '');

        $separatorPosition = max(strrpos($value, '.') ?: -1, strrpos($value, ',') ?: -1);

        if ($separatorPosition === -1) {
            return (int) $this->sanitizeDigits($value);
        }

        $whole = $this->sanitizeDigits(substr($value, 0, $separatorPosition));

        $fraction = str_pad(
            substr($this->sanitizeDigits(substr($value, $separatorPosition + 1)), 0, $this->precision()),
            $this->precision(),
            '0'
        );

        return (int) (($whole ?: '0') . $fraction);
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

    protected function formattedStoredValue($value): string
    {
        return $this->formatted(
            $this->toDecimalFromSubunit($value)
        );
    }

    protected function toDecimalFromSubunit($value): float
    {
        $subunitValue = (int) $this->sanitizeDigits($value);

        return $subunitValue / (10 ** $this->precision());
    }

    protected function currencies(): DictionaryCollection
    {
        return Dictionary::find('currencies');
    }
}
