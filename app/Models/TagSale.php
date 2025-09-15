<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TagSale extends Model
{
    use HasFactory;

    protected $fillable = ['tag_id', 'sold_at', 'price'];

    public function tag()
    {
        return $this->belongsTo(Tag::class);
    }
}
