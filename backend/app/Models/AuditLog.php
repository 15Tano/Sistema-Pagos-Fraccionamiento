<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;


class AuditLog extends Model
{
    protected $fillable = [
        'user_id', 'user_name', 'accion',
        'modelo', 'modelo_id',
        'datos_anteriores', 'datos_nuevos', 'ip'
    ];

    protected $casts = [
        'datos_anteriores' => 'array',
        'datos_nuevos'     => 'array',
    ];

    public static function registrar(string $accion, string $modelo, $modeloId = null, $anterior = null, $nuevo = null)
    {
        $user = auth()->user();
        self::create([
            'user_id'          => $user?->id,
            'user_name'        => $user?->name,
            'accion'           => $accion,
            'modelo'           => $modelo,
            'modelo_id'        => $modeloId,
            'datos_anteriores' => $anterior,
            'datos_nuevos'     => $nuevo,
            'ip'               => request()->ip(),
        ]);
    }
}