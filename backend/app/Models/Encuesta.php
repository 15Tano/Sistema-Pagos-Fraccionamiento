<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
class Encuesta extends Model
{
    protected $fillable = ['pregunta', 'descripcion', 'opciones', 'activa', 'fecha_cierre'];
protected $casts = [
    'opciones' => 'array',
    'activa' => 'boolean',
    'fecha_cierre' => 'datetime',
];

    public function votos()
    {
        return $this->hasMany(VotoEncuesta::class);
    }
}