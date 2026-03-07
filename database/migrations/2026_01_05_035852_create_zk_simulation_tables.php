<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Creamos la tabla USERINFO en la base de datos 'zkteco'
        Schema::connection('zkteco')->create('USERINFO', function (Blueprint $table) {
            $table->id('USERID'); 
            $table->string('Badgenumber', 20)->nullable(); // ID visible del vecino
            $table->string('Name', 50)->nullable();
            $table->string('CardNo', 20)->nullable(); // El número del Tag
            $table->dateTime('acc_startdate')->nullable();
            $table->dateTime('acc_enddate')->nullable(); // FECHA DE VENCIMIENTO
            $table->integer('privilege')->default(0);
            $table->boolean('set_valid_time')->default(1);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::connection('zkteco')->dropIfExists('USERINFO');
    }
};