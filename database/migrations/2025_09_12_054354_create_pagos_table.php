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
        Schema::create('pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vecino_id')->constrained()->onDelete('cascade');
            $table->decimal('cantidad', 8, 2);
            $table->string('mes'); // Ejemplo: "2025-09"
            $table->enum('tipo', ['ordinario', 'extraordinario']);
            $table->decimal('restante', 8, 2)->default(0); // si sobra pero no alcanza otro mes
            $table->timestamps();
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pagos');
    }
};
