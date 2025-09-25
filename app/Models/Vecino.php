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
    ];

    public function pagos()
    {
        return $this->hasMany(\App\Models\Pago::class);
    }

    public function tags()
    {
        return $this->belongsToMany(\App\Models\Tag::class, 'tag_vecino')->sold();
    }
}
