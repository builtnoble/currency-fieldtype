# Currency Fieldtype

> A Statamic fieldtype for storing and displaying monetary values. Values are saved as integers in the smallest currency unit (e.g. cents for USD), formatted for display using the current site locale, and fully configurable per field via ISO currency code.

## Features

- **Integer subunit storage** — values are saved as raw integers (e.g. `123456` for $1,234.56), avoiding floating point precision issues
- **Locale-aware formatting** — display formatting (symbol, separators, decimal places) follows the current Statamic site locale automatically
- **ISO currency configuration** — choose any supported currency (USD, EUR, GBP, etc.) from a searchable select field in the Control Panel, with the correct symbol and decimal precision applied automatically
- **Antlers ready** — augmented values are returned as a formatted currency string (e.g. `$1,234.56`) ready to output in your templates
- **Null-safe** — null values are formatted as zero on display (`$0.00`) and return `null` from the index processor, keeping collection listings clean
- **Stable sorting behavior** — index values are converted to sortable integers, with explicit null sorting behavior for ascending and descending order
- **Config metadata for Vue** — preload data includes currency, locale, precision, and symbol so the CP field UI has everything it needs

## How to Install

Install the addon via Composer:

```bash
composer require builtnoble/currency-fieldtype
```

Then add the fieldtype to any blueprint in the Control Panel or directly in `resources/blueprints/`.

## Configuration

Each field has one configuration option:

| Option                | Description                                                        | Default                                                                                                      |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Currency ISO Code** | The ISO 4217 code of the currency to use, e.g. `USD`, `EUR`, `GBP` | `USD` — Laravel's `Number::defaultCurrency()`, overridable via `Number::useCurrency()` in a service provider |

The symbol, decimal precision, and locale-specific formatting are all resolved automatically from the selected currency and the current Statamic site locale.

### Changing the Default Currency

To change the default from `USD` application-wide, call `Number::useCurrency()` in the `boot` method of your `AppServiceProvider`:

```php
use Illuminate\Support\Number;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Number::useCurrency('EUR');
    }
}
```

Any currency fieldtype that has not had a currency explicitly selected in the Control Panel will then default to `EUR`.

## How It Works

### Fieldtype lifecycle methods

This fieldtype uses the standard Statamic fieldtype lifecycle and maps each method to a specific responsibility:

- **`preload()`**
    - provides metadata to the Vue component: selected currency, resolved locale, decimal precision, and symbol
- **`preProcess($value)`**
    - transforms stored values into a display/input format suitable for the Vue field component
- **`process($value)`**
    - transforms the Vue field value back into the persisted integer subunit format
- **`preProcessIndex($value)`**
    - transforms values for Control Panel listing/sorting by returning numeric index values (or `null`)
- **`augment($value)`**
    - transforms stored values for frontend template output (Antlers)

### Storage

Values are stored as plain integers representing the smallest unit of the selected currency (cents for USD/EUR/GBP, etc.). A value entered as `$1,234.56` is saved as `123456`.

### Display

When a stored value is augmented for use in Antlers templates, it is formatted as a locale-aware currency string:

```antlers
{{ price }}
{{# Output: $1,234.56 #}}
```

### Null handling

If no value has been entered, `preProcess` returns a formatted zero (`$0.00`) so the Vue component always has a valid display value. The index processor returns `null` for empty fields so collection listings sort correctly.

### Locale and symbol behavior

Formatting honors the current site locale. For example, a locale like `de_DE` may produce comma decimals and append the euro symbol (e.g. `1.234,00 €`) depending on locale formatting rules.

### Sorting behavior in index views

`preProcessIndex` strips non-digits and returns integers for sortable values. For null values:

- in ascending sorts, null indexes are ordered before numeric values
- in descending sorts, null indexes are ordered after numeric values

## Running Tests

```bash
./vendor/bin/pest
```

Run only feature-grouped tests:

```bash
./vendor/bin/pest --group="feature"
```

Or via Composer scripts:

```bash
composer test
composer test:feature
```
