<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CorteCaja extends Model
{
    use HasFactory;

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

    protected static function booted(): void
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = Str::uuid()->toString();
            }
        });
    }
}