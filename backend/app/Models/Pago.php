<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Pago extends Model
{
    use HasFactory;

    protected $fillable = [
        'vecino_id',
        'cantidad',
        'mes',
        'tipo',
        'restante',
        'fecha_de_cobro',
        'meses_pagados',
    ];

    protected $casts = [
        'fecha_de_cobro' => 'date',
        'cantidad'       => 'float',
        'restante'       => 'float',
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

    public function vecino()
    {
        return $this->belongsTo(Vecino::class);
    }
}