<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AsignacionCobro extends Model
{
    protected $table = 'asignaciones_cobro';

    protected $fillable = ['user_id', 'mes', 'fecha', 'hora_inicio', 'hora_fin'];

    protected $casts = ['fecha' => 'date'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}


