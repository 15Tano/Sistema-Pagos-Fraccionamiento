<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['estados', 'lotes'] as $suffix) {
            Schema::table('control_acceso_'.$suffix, function (Blueprint $table) use ($suffix) {
                $table->index(['agent_id', 'received_at_utc', 'id'], 'ca_expiry_'.$suffix);
            });
        }
        Schema::create('control_acceso_salud_actual', function (Blueprint $table) {
            $table->foreignUuid('agent_id')->primary()->constrained('control_acceso_agentes')->restrictOnDelete();
            $table->unsignedBigInteger('state_id');
            $table->dateTime('reported_at_utc', 6);
            $table->dateTime('received_at_utc', 6);
            $table->json('payload');
            $table->char('signal_sha256', 64);
        });
        Schema::create('control_acceso_resumenes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('agent_id')->constrained('control_acceso_agentes')->restrictOnDelete();
            $table->dateTime('hour_utc');
            $table->string('source', 16);
            $table->unsignedBigInteger('responses');
            $table->unsignedBigInteger('statuses');
            $table->dateTime('last_received_at_utc', 6);
            $table->unique(['agent_id', 'hour_utc', 'source'], 'ca_status_hour');
        });
    }

    public function down(): void
    {
        // El código anterior no lee el snapshot ni los resúmenes.
        // Después de usar la función, conservar estas tablas al revertir código.
        foreach (['control_acceso_salud_actual', 'control_acceso_resumenes'] as $table) {
            if (\Illuminate\Support\Facades\DB::table($table)->exists()) {
                throw new RuntimeException('Resúmenes en uso: conservar tablas y revisar rollback con respaldo.');
            }
        }
        Schema::dropIfExists('control_acceso_resumenes');
        Schema::dropIfExists('control_acceso_salud_actual');
        foreach (['estados', 'lotes'] as $suffix) {
            Schema::table('control_acceso_'.$suffix, fn (Blueprint $table) => $table->dropIndex('ca_expiry_'.$suffix));
        }
    }
};
