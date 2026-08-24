<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        DB::statement('ALTER TABLE encuestas MODIFY pregunta VARCHAR(500) NOT NULL');
        DB::statement('ALTER TABLE encuestas MODIFY descripcion VARCHAR(1000) NULL');
    }

    public function down()
    {
        DB::statement('ALTER TABLE encuestas MODIFY pregunta VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE encuestas MODIFY descripcion VARCHAR(500) NULL');
    }
};