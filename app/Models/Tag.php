<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tag extends Model
{
    use HasFactory;

    protected $fillable = ['codigo','activo'];

    public function vecinos() {
        return $this->belongsToMany(Vecino::class, 'tag_vecino');
    }

    public function tagSale() {
        return $this->hasOne(\App\Models\TagSale::class);
    }

    public function scopeSold($query) {
        return $query->whereHas('tagSale');
    }
}
