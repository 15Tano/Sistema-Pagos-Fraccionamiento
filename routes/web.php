<?php

use Illuminate\Support\Facades\Route;


Route::get('/{any}', function () {
    return file_get_contents(public_path('react/build/index.html'));
})->where('any', '.*');

