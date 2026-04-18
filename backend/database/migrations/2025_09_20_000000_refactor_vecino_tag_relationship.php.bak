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
        // Remove numero_tag from vecinos table
        Schema::table('vecinos', function (Blueprint $table) {
            $table->dropUnique('vecinos_numero_tag_unique');
            $table->dropColumn('numero_tag');
        });

        // Remove vecino_id from tags table
        Schema::table('tags', function (Blueprint $table) {
            $table->dropForeign(['vecino_id']);
            $table->dropColumn('vecino_id');
        });

        // Create pivot table tag_vecino
        Schema::create('tag_vecino', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vecino_id')->constrained()->onDelete('cascade');
            $table->foreignId('tag_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['vecino_id', 'tag_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop pivot table
        Schema::dropIfExists('tag_vecino');

        // Add vecino_id back to tags table
        Schema::table('tags', function (Blueprint $table) {
            $table->foreignId('vecino_id')->nullable()->constrained()->onDelete('cascade');
        });

        // Add numero_tag back to vecinos table
        Schema::table('vecinos', function (Blueprint $table) {
            $table->string('numero_tag')->unique();
        });
    }
};
