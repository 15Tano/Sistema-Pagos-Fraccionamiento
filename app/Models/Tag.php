<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tag extends Model
{
    use HasFactory;

    protected $fillable = ['codigo','activo','vecino_id'];

    public function vecino() {
        return $this->belongsTo(Vecino::class);
    }
}
