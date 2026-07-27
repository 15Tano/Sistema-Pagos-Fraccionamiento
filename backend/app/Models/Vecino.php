<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
class Vecino extends Model
{
    use HasFactory;
    protected $fillable = [
        'nombre',
        'calle',
        'numero_casa',
        'user_id',
    ];
    // Usar UUID como clave de ruta en la API
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
    // Auto-generar UUID al crear
    protected static function booted(): void
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = Str::uuid()->toString();
            }
        });
    }
    public function pagos()
    {
        return $this->hasMany(Pago::class);
    }
    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'tag_vecino')->sold();
    }
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
