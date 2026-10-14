<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
class Tag extends Model
{
    use HasFactory;
    protected $fillable = ['codigo', 'activo', 'asignable_sin_venta'];
    protected $casts = ['asignable_sin_venta' => 'boolean'];
    public function scopeAssignable($query)
    {
        return $query->where(function ($q) {
            $q->whereHas('tagSale')->orWhere('asignable_sin_venta', true);
        });
    }
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
    protected static function booted(): void
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = Str::uuid()->toString();
            }
        });
    }
    public function vecinos()
    {
        return $this->belongsToMany(Vecino::class, 'tag_vecino');
    }
    public function tagSale()
    {
        return $this->hasOne(TagSale::class);
    }
    public function scopeSold($query)
    {
        return $query->whereHas('tagSale');
    }
}
