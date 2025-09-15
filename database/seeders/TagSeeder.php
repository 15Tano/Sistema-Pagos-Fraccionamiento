<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tag;

class TagSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create 500 tags numbered from 001 to 500
        for ($i = 1; $i <= 500; $i++) {
            $codigo = str_pad($i, 3, '0', STR_PAD_LEFT);
            Tag::create([
                'codigo' => $codigo,
                'activo' => false,
                'vecino_id' => null,
            ]);
        }
    }
}
