<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('control_acceso_monitor_configuracion', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->boolean('historial_vigilancia')->default(false);
            $table->unsignedInteger('revision')->default(1);
            // Identidad de quien hizo el último cambio; se conserva si su cuenta se elimina.
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
        DB::table('control_acceso_monitor_configuracion')->insert([
            'id' => 1, 'historial_vigilancia' => false, 'revision' => 1,
        ]);
        Schema::table('control_acceso_filas', function (Blueprint $table) {
            $table->index(['kind', 'door_id', 'id'], 'ca_rows_current');
        });
    }

    public function down(): void
    {
        Schema::table('control_acceso_filas', fn (Blueprint $table) => $table->dropIndex('ca_rows_current'));
        Schema::dropIfExists('control_acceso_monitor_configuracion');
    }
};
