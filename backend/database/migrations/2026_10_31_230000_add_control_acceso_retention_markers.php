<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['estados', 'respuestas'] as $suffix) {
            Schema::table('control_acceso_'.$suffix, function (Blueprint $table) use ($suffix) {
                $table->dateTime('retention_pruned_at_utc', 6)->nullable();
                $table->index(['agent_id', 'retention_pruned_at_utc', 'id'], 'ca_retention_'.$suffix);
            });
        }
    }

    public function down(): void
    {
        // Una reversión de esquema no recupera el contenido retirado.
        foreach (['estados', 'respuestas'] as $suffix) {
            if (DB::table('control_acceso_'.$suffix)->whereNotNull('retention_pruned_at_utc')->exists()) {
                throw new RuntimeException('Retención ya aplicada: restaurar respaldo antes de retirar sus marcadores.');
            }
        }
        foreach (['estados', 'respuestas'] as $suffix) {
            Schema::table('control_acceso_'.$suffix, function (Blueprint $table) use ($suffix) {
                $table->dropIndex('ca_retention_'.$suffix);
                $table->dropColumn('retention_pruned_at_utc');
            });
        }
    }
};
