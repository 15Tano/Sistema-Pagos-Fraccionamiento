<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cortes_caja', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->date('fecha')->unique();
            $table->decimal('monto_sistema', 8, 2)->nullable();
            $table->enum('estado', ['en_proceso', 'cuadrado', 'cerrado_con_diferencia'])
                  ->default('en_proceso');
            $table->json('intentos')->nullable();
            $table->string('firma_capturista')->nullable();
            $table->text('nota_diferencia')->nullable();
            $table->timestamp('cerrado_at')->nullable();
            $table->timestamp('reabierto_at')->nullable();
            $table->string('reabierto_por')->nullable();
            $table->text('motivo_reapertura')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cortes_caja');
    }
};