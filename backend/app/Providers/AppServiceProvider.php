<?php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Models\Pago;
use App\Models\Vecino;
use App\Models\Tag;
use App\Models\Aviso;
use App\Observers\PagoObserver;
use App\Observers\VecinoObserver;
use App\Observers\TagObserver;
use App\Observers\AvisoObserver;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Pago::observe(PagoObserver::class);
        Vecino::observe(VecinoObserver::class);
        Tag::observe(TagObserver::class);
        Aviso::observe(AvisoObserver::class);
    }
}