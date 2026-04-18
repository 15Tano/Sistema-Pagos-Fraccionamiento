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
    Schema::table('tags', function (Blueprint $table) {
        // Se asume que la FK se llama 'tags_vecino_id_foreign'
        // Si tiene otro nombre, ajústalo.
        $table->dropForeign(['vecino_id']); 
        $table->dropColumn('vecino_id');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tags', function (Blueprint $table) {
            //
        });
    }
};
