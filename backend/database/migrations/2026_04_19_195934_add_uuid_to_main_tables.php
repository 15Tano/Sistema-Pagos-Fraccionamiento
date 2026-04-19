<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vecinos', function (Blueprint $table) {
            $table->uuid('uuid')->nullable()->unique()->after('id');
        });

        Schema::table('tags', function (Blueprint $table) {
            $table->uuid('uuid')->nullable()->unique()->after('id');
        });

        Schema::table('pagos', function (Blueprint $table) {
            $table->uuid('uuid')->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('vecinos', function (Blueprint $table) {
            $table->dropColumn('uuid');
        });
        Schema::table('tags', function (Blueprint $table) {
            $table->dropColumn('uuid');
        });
        Schema::table('pagos', function (Blueprint $table) {
            $table->dropColumn('uuid');
        });
    }
};