<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('control_acceso_estados', function (Blueprint $table) {
            $table->index(['agent_id', 'reported_at_utc', 'id'], 'ca_states_monitor');
        });
        Schema::table('control_acceso_respuestas', function (Blueprint $table) {
            $table->index(['agent_id', 'source', 'id'], 'ca_responses_monitor');
        });
        Schema::table('control_acceso_filas', function (Blueprint $table) {
            $table->index(['kind', 'id'], 'ca_rows_monitor');
        });
    }

    public function down(): void
    {
        Schema::table('control_acceso_filas', fn (Blueprint $table) => $table->dropIndex('ca_rows_monitor'));
        Schema::table('control_acceso_respuestas', fn (Blueprint $table) => $table->dropIndex('ca_responses_monitor'));
        Schema::table('control_acceso_estados', fn (Blueprint $table) => $table->dropIndex('ca_states_monitor'));
    }
};
