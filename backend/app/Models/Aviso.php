<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Aviso extends Model
{
    protected $fillable = ['titulo', 'descripcion', 'tipo', 'activo'];

    protected $casts = [
        'activo' => 'boolean',
    ];
}