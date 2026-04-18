<?php

namespace App\Models;

// Importaciones necesarias (Asegúrate de que estas líneas estén aquí)
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * Esto ayuda al editor a entender que estas columnas existen en la BD
 * @property int $id
 * @property string $name
 * @property string|null $username
 * @property string|null $email
 * @property string $password
 * @property string $role
 */
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * Los atributos que se pueden asignar masivamente.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'username', // Tu campo nuevo
        'role',     // Tu campo nuevo
    ];

    /**
     * Los atributos ocultos.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Conversión de tipos.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Función personalizada para checar si es admin.
     * Si tu editor marca error en 'role', ignóralo, Laravel sí lo leerá.
     */
    public function isAdmin()
    {
        // Usamos $this->attributes['role'] si $this->role te da mucha lata visualmente,
        // pero $this->role es la forma correcta y corta.
        return $this->role === 'admin';
    }
}