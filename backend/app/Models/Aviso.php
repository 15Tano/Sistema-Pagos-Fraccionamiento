<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Aviso extends Model
{
    protected $fillable = ['titulo', 'descripcion', 'tipo', 'activo', 'imagen'];

    protected $casts = [
        'activo' => 'boolean',
    ];

    protected $appends = ['imagen_url'];

    public function getImagenUrlAttribute()
    {
        return $this->imagen ? asset('storage/' . $this->imagen) : null;
    }
}