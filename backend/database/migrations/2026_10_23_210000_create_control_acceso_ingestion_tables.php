<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('control_acceso_agentes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nombre', 120);
            $table->string('device_serial', 64)->unique();
            $table->char('token_hash', 64)->unique();
            $table->dateTime('revoked_at', 6)->nullable();
            $table->timestamps(6);
        });
        Schema::create('control_acceso_estados', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('agent_id')->constrained('control_acceso_agentes')->restrictOnDelete();
            $table->uuid('session_id');
            $table->unsignedBigInteger('sequence');
            $table->dateTime('reported_at_utc', 6);
            $table->dateTime('received_at_utc', 6);
            $table->char('content_sha256', 64);
            $table->json('payload');
            $table->json('ack');
            $table->unique(['agent_id', 'session_id', 'sequence'], 'ca_states_identity');
        });
        Schema::create('control_acceso_lotes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('agent_id')->constrained('control_acceso_agentes')->restrictOnDelete();
            $table->uuid('batch_id');
            $table->uuid('session_id');
            $table->unsignedBigInteger('sequence');
            $table->char('content_sha256', 64);
            $table->dateTime('received_at_utc', 6);
            $table->json('ack');
            $table->unique(['agent_id', 'batch_id'], 'ca_batches_identity');
            $table->unique(['agent_id', 'session_id', 'sequence'], 'ca_batches_sequence');
        });
        Schema::create('control_acceso_respuestas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lote_id')->constrained('control_acceso_lotes')->restrictOnDelete();
            $table->foreignUuid('agent_id')->constrained('control_acceso_agentes')->restrictOnDelete();
            $table->uuid('response_id');
            $table->string('source', 16);
            $table->integer('sdk_return_code');
            $table->mediumText('raw_payload_base64');
            $table->char('sha256', 64);
            $table->unsignedInteger('payload_bytes');
            $table->dateTime('captured_started_utc', 6);
            $table->dateTime('captured_ended_utc', 6);
            $table->string('pc_local_time', 40)->nullable();
            $table->string('windows_timezone', 100)->nullable();
            $table->string('parse_status', 16);
            $table->string('parse_reason', 80)->nullable();
            $table->string('parser_version', 32);
            $table->unique(['agent_id', 'response_id'], 'ca_responses_identity');
        });
        Schema::create('control_acceso_filas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('respuesta_id')->constrained('control_acceso_respuestas')->restrictOnDelete();
            $table->unsignedInteger('ordinal');
            $table->string('kind', 16);
            $table->string('device_time_raw', 64);
            $table->string('time_second', 32)->nullable();
            $table->string('card_no', 64)->nullable()->index();
            $table->string('pin', 64)->nullable();
            $table->string('door_id', 32)->nullable();
            $table->unsignedInteger('event_code');
            $table->string('direction', 32)->nullable();
            $table->string('verification', 32)->nullable();
            $table->json('raw_fields');
            $table->unique(['respuesta_id', 'ordinal'], 'ca_rows_ordinal');
        });
    }

    public function down(): void
    {
        foreach (['filas', 'respuestas', 'lotes', 'estados', 'agentes'] as $suffix) {
            Schema::dropIfExists('control_acceso_'.$suffix);
        }
    }
};
