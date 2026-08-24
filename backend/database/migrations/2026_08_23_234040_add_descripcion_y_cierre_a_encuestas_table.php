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
    Schema::table('encuestas', function (Blueprint $table) {
        $table->string('descripcion')->nullable()->after('pregunta');
        $table->timestamp('fecha_cierre')->nullable()->after('activa');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down()
{
    Schema::table('encuestas', function (Blueprint $table) {
        $table->dropColumn(['descripcion', 'fecha_cierre']);
    });
}
};
