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
                'required' => true,
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
            'currency' => $this->currencyCode(),
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
     * Sanitize the input value by stripping out all non-digit characters
     * other than a leading minus sign, returning the raw signed integer
     * value in cents (or the smallest currency unit), e.g. "-$12.34" =>
     * "-1234".
     */
    protected function sanitizeDigits($value): string
    {
        $value = (string) ($value ?? '');

        $digits = preg_replace('/[^\d]/', '', $value) ?? '';

        if ($digits === '') {
            return '';
        }

        return str_contains($value, '-') ? "-{$digits}" : $digits;
    }

    /**
     * Parse a decimal currency value into an integer in the currency's
     * smallest unit. If a decimal separator is present, the fractional part
     * is padded or truncated to the configured precision rather than assumed
     * to already match it, e.g. "12.3" => 1230 for a 2-decimal currency.
     * Values without a decimal separator are treated as already-sanitized
     * subunit digits, e.g. "123456" => 123456. A leading minus sign is
     * preserved, e.g. "-12.3" => -1230.
     */
    protected function parseToSubunit($value): int
    {
        $value = (string) ($value ?? '');

        $separatorPosition = max(strrpos($value, '.') ?: -1, strrpos($value, ',') ?: -1);

        if ($separatorPosition === -1) {
            return (int) $this->clampDigits($this->sanitizeDigits($value));
        }

        $whole = $this->clampDigits($this->sanitizeDigits(substr($value, 0, $separatorPosition)));

        $fraction = str_pad(
            substr($this->sanitizeDigits(substr($value, $separatorPosition + 1)), 0, $this->precision()),
            $this->precision(),
            '0'
        );

        return (int) (($whole ?: '0') . $fraction);
    }

    /**
     * Clamp an optionally-signed digit string to a safe length, avoiding
     * unreliable behavior when casting extremely large numeric strings to
     * int (e.g. absurdly long pasted or API-supplied input).
     */
    protected function clampDigits(string $digits, int $maxLength = 15): string
    {
        $isNegative = str_starts_with($digits, '-');

        $unsigned = substr(ltrim($digits, '-'), 0, $maxLength);

        return $isNegative ? "-{$unsigned}" : $unsigned;
    }

    protected function precision(): int
    {
        return $this->currencyData()['decimals'] ?? 2;
    }

    protected function symbol(): ?string
    {
        return $this->currencyData()['symbol'] ?? null;
    }

    /**
     * The configured currency's ISO code, falling back to the application
     * default when the field has none configured or the configured code
     * does not exist in the currencies dictionary.
     */
    protected function currencyCode(): string
    {
        $configured = $this->config('currency');

        if (is_string($configured) && $this->currencies()->get($configured) !== null) {
            return $configured;
        }

        return Number::defaultCurrency();
    }

    /**
     * The resolved currency's dictionary entry, falling back to a generic
     * 2-decimal definition if even the application default currency cannot
     * be resolved.
     */
    protected function currencyData(): array|\ArrayAccess
    {
        return $this->currencies()->get($this->currencyCode())
            ?? ['decimals' => 2, 'symbol' => null];
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
            in: $this->currencyCode(),
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
