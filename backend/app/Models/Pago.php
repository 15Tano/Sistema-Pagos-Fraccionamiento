<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pago extends Model
{
    use HasFactory;

    protected $fillable = ['vecino_id', 'cantidad', 'mes', 'tipo', 'restante', 'fecha_de_cobro'];

    protected $casts = [
        'fecha_de_cobro' => 'date',
    ];

    public function vecino()
    {
        return $this->belongsTo(Vecino::class);
    }
}
