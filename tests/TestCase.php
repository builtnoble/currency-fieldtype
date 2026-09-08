<?php

namespace Builtnoble\CurrencyFieldtype\Tests;

use Builtnoble\CurrencyFieldtype\Fieldtypes\Currency;
use Builtnoble\CurrencyFieldtype\ServiceProvider;
use Statamic\Fields\Field;
use Statamic\Testing\AddonTestCase;

abstract class TestCase extends AddonTestCase
{
    protected string $addonServiceProvider = ServiceProvider::class;

    protected Currency $fieldtype;

    protected function setUp(): void
    {
        parent::setUp();

        $field = new Field('price', [
            'type' => 'currency',
            'currency' => 'USD',
        ]);

        $this->fieldtype = new Currency();
        $this->fieldtype->setField($field);
    }
}
