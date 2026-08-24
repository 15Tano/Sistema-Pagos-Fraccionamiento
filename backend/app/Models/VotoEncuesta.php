<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VotoEncuesta extends Model
{
    protected $table = 'votos_encuesta';
    protected $fillable = ['encuesta_id', 'vecino_id', 'opcion_index'];
}