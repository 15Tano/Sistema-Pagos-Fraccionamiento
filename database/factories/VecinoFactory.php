<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class VecinoFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nombre' => $this->faker->name(),
            'calle' => $this->faker->streetName(),
            'numero_casa' => $this->faker->numberBetween(1, 200),
            'numero_tag' => strtoupper($this->faker->bothify('TAG-####')),
        ];
    }
}
