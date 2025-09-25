<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Vecino;

class VecinoSeeder extends Seeder
{
    public function run(): void
    {
        // Crear 20 vecinos falsos
        $vecinos = Vecino::factory()->count(20)->create();

        // Asignar tags aleatorios a cada vecino
        $tags = \App\Models\Tag::all();

        foreach ($vecinos as $vecino) {
            $vecino->tags()->attach(
                $tags->random(rand(1, 5))->pluck('id')->toArray()
            );
        }
    }
}
