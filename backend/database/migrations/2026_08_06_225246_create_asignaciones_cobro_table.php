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
    Schema::create('asignaciones_cobro', function (Blueprint $table) {
        $table->id();
        $table->foreignId('user_id')->constrained()->cascadeOnDelete();
        $table->unsignedTinyInteger('mes'); // 1-12
        $table->date('fecha');
        $table->time('hora_inicio')->default('17:50:00');
        $table->time('hora_fin')->default('20:45:00');
        $table->timestamps();
        $table->unique(['user_id', 'mes']);
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('asignaciones_cobro');
    }
};
