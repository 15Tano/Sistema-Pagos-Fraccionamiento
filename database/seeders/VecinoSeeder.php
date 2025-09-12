<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Vecino;

class VecinoSeeder extends Seeder
{
    public function run(): void
    {
        // Crear 20 vecinos falsos
        Vecino::factory()->count(20)->create();
    }
}
