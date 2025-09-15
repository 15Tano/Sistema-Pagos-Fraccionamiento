<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vecino extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre',
        'calle',
        'numero_casa',
        'numero_tag',
    ];

    public function pagos()
{
    return $this->hasMany(\App\Models\Pago::class);
}

    public function tag() {
        return $this->belongsTo(\App\Models\Tag::class, 'numero_tag', 'codigo');
    }

}
