<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CapturistaSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['username' => 'capturista.sistema'],
            [
                'name'     => 'Capturista Sistema',
                'password' => Hash::make('no-se-usa-este-password'),
                'role'     => 'capturista',
            ]
        );
    }
}