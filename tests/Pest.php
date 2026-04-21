<?php

use Builtnoble\CurrencyFieldtype\Tests\TestCase;

pest()->project()->github('builtnoble/currency-fieldtype');

pest()->extend(TestCase::class)
    ->group('feature')
    ->in('Feature');
