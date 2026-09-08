# Currency Fieldtype

<!-- statamic:hide -->

> A Statamic fieldtype for storing and displaying monetary values. Values are saved as integers in the smallest currency unit (e.g. cents for USD), formatted for display using the current site locale, and fully configurable per field via ISO currency code.

<!-- /statamic:hide -->

## Features

- **Integer subunit storage** — values are saved as raw integers (e.g. `123456` for $1,234.56), avoiding floating point precision issues
- **Locale-aware formatting** — display formatting (symbol, separators, decimal places) follows the current Statamic site locale automatically
- **ISO currency configuration** — choose any supported currency (USD, EUR, GBP, etc.) from a searchable select field in the Control Panel, with the correct symbol and decimal precision applied automatically
- **Antlers ready** — augmented values are returned as a formatted currency string (e.g. `$1,234.56`) ready to output in your templates
- **Null-safe** — null values are formatted as zero on display (`$0.00`) and return `null` from the index processor, keeping collection listings clean
- **Stable sorting behavior** — index values are converted to sortable integers, with explicit null sorting behavior for ascending and descending order
- **Config metadata for Vue** — preload data includes currency, locale, precision, and symbol so the CP field UI has everything it needs
- **Negative amounts**: a leading minus sign is preserved through input, storage, and display, so refunds, discounts, and other negative adjustments are supported

## Requirements

- PHP 8.3+
- Statamic 6.0+
- PHP's `intl` extension, which Laravel's `Number::currency()` relies on for locale-aware formatting.

## How to Install

Install the addon via Composer:

```bash
composer require builtnoble/currency-fieldtype
```

Then add the fieldtype to any blueprint in the Control Panel or directly in `resources/blueprints/`.

## Documentation

See [DOCUMENTATION.md](DOCUMENTATION.md) for configuration options and a full explanation of how the fieldtype works internally.

## Development

```bash
composer test          # Pest (PHP)
composer test:feature  # Pest, feature-grouped only
composer lint           # Pint, check only
composer analyse        # PHPStan
composer check           # lint + analyse + test, all at once
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development setup and workflow.
