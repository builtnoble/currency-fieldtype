# Currency Fieldtype Documentation

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
  - transforms values for Control Panel index listings into formatted currency strings
- **`augment($value)`**
  - transforms stored values for frontend template output (Antlers)

### Storage

Values are stored as plain integers representing the smallest unit of the selected currency (cents for USD/EUR/GBP, etc.). A value entered as `$1,234.56` is saved as `123456`. Empty input is normalized to `0` when the field is processed for saving.

### Display

When a stored value is augmented for use in Antlers templates, it is formatted as a locale-aware currency string:

```antlers
{{ input_name }}
{{# Output: $1,234.56 #}}
```

### Null handling

On the normal save path, empty input is coerced to `0` rather than persisted as `null`. Both `preProcess` and `preProcessIndex` still handle `null` defensively by returning a formatted zero (`$0.00`) so unset, legacy, or externally modified values do not render as blank currency columns.

### Locale and symbol behavior

Formatting honors the current site locale. For example, a locale like `de_DE` may produce comma decimals and append the euro symbol (e.g. `1.234,00 €`) depending on locale formatting rules.

### Sorting behavior in index views

`preProcessIndex` returns the formatted display value shown in the Control Panel index. Sorting still follows the raw saved subunit values stored by the field, not the formatted string returned for display. In the normal save path, empty input sorts as `0` because that is the stored value; `null` is only a defensive read case.

- empty values saved through the field sort as `0`
- unset legacy values that surface as `null` are displayed as `0.00` in the index
