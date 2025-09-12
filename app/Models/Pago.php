<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pago extends Model
{
    use HasFactory;

    protected $fillable = ['vecino_id','monto','fecha_pago','estado'];

    public function vecino() {
        return $this->belongsTo(Vecino::class);
    }
}
