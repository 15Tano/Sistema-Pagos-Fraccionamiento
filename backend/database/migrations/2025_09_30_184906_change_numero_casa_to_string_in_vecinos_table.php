<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('vecinos', function (Blueprint $table) {
            // Cambia el tipo de la columna a STRING.
            // Un string puede almacenar "123", "36-B", "Lote 5", etc.
            $table->string('numero_casa')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vecinos', function (Blueprint $table) {
            // Esto permite revertir el cambio si fuera necesario.
            $table->integer('numero_casa')->change();
        });
    }
};

