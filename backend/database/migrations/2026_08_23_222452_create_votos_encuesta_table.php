<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
{
    Schema::create('votos_encuesta', function (Blueprint $table) {
        $table->id();
        $table->foreignId('encuesta_id')->constrained('encuestas')->onDelete('cascade');
        $table->foreignId('vecino_id')->constrained('vecinos')->onDelete('cascade');
        $table->unsignedTinyInteger('opcion_index'); // índice dentro del array de opciones
        $table->timestamps();

        $table->unique(['encuesta_id', 'vecino_id']); // 1 voto por vecino por encuesta
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('votos_encuesta');
    }
};
