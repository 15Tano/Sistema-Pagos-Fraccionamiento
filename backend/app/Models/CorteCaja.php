<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CorteCaja extends Model
{
    use HasFactory;

    protected $table = 'cortes_caja';

    protected $fillable = [
        'fecha',
        'monto_sistema',
        'estado',
        'intentos',
        'firma_capturista',
        'nota_diferencia',
        'cerrado_at',
        'reabierto_at',
        'reabierto_por',
        'motivo_reapertura',
    ];

    protected $casts = [
        'fecha'         => 'date',
        'monto_sistema' => 'float',
        'intentos'      => 'array',
        'cerrado_at'    => 'datetime',
        'reabierto_at'  => 'datetime',
    ];

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    // Una jornada pendiente no desaparece al cambiar el día.
    public static function activo(): ?self
    {
        $hoy = \Carbon\Carbon::now('America/Mexico_City')->toDateString();

        return static::where('estado', 'en_proceso')
            ->whereDate('fecha', '<=', $hoy)
            ->orderBy('fecha')->get()
            ->first(fn ($corte) => !$corte->pendienteSoloExtraordinarios())
            ?? static::whereDate('fecha', $hoy)->get()
                ->first(fn ($corte) => !$corte->pendienteSoloExtraordinarios());
    }

    // Ignorar aperturas automáticas indebidas sin borrar el registro ni sus intentos.
    public function pendienteSoloExtraordinarios(): bool
    {
        if ($this->estado !== 'en_proceso' || !empty($this->intentos)
            || $this->reabierto_at !== null) {
            return false;
        }

        $fecha = $this->fecha->toDateString();
        $pagos = Pago::whereDate('fecha_de_cobro', $fecha);
        if (!(clone $pagos)->where('tipo', 'extraordinario')->exists()
            || (clone $pagos)->where('tipo', 'ordinario')->exists()) {
            return false;
        }

        if ($fecha < '2026-10-07') {
            return !TagSale::whereDate('sold_at', $fecha)->exists();
        }

        $inicio = \Carbon\Carbon::parse($fecha, 'America/Mexico_City')->startOfDay();
        return !TagSale::where('sold_at', '>=', $inicio->copy()->utc()->toDateTimeString())
            ->where('sold_at', '<', $inicio->copy()->addDay()->utc()->toDateTimeString())->exists();
    }

    protected static function booted(): void
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = Str::uuid()->toString();
            }
        });
    }
}
