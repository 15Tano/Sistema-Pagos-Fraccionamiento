<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('cortes-caja:abrir')
    ->dailyAt('20:05')
    ->timezone('America/Mexico_City');

Schedule::command('control-acceso:retencion --apply')
    ->hourly()
    ->when(fn () => (bool) config('control_acceso.retention_enabled'))
    ->withoutOverlapping(120);
