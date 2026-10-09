<?php

namespace Tests\Feature;

use App\Http\Controllers\DashboardController;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DashboardPendientesTest extends TestCase
{
    public function test_pending_residents_include_those_without_tags_and_exclude_current_month_payments(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-08 12:00:00'));
        try {
            Schema::create('vecinos', function (Blueprint $table) {
                $table->id();
                $table->string('nombre');
                $table->string('calle');
                $table->string('numero_casa');
                $table->unsignedBigInteger('user_id')->nullable();
            });
            Schema::create('pagos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('vecino_id');
                $table->string('mes');
                $table->decimal('cantidad', 8, 2);
                $table->date('fecha_de_cobro')->nullable();
                $table->timestamps();
            });
            Schema::create('tags', function (Blueprint $table) {
                $table->id();
                $table->string('codigo');
            });
            Schema::create('tag_vecino', function (Blueprint $table) {
                $table->unsignedBigInteger('vecino_id');
                $table->unsignedBigInteger('tag_id');
            });
            Schema::create('tag_sales', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tag_id');
                $table->decimal('price', 8, 2);
                $table->dateTime('sold_at')->nullable();
                $table->timestamps();
            });

            foreach ([1, 2, 3, 4, 5] as $id) {
                DB::table('vecinos')->insert(['id' => $id, 'nombre' => "Vecino $id", 'calle' => 'Plaza', 'numero_casa' => (string) $id]);
            }
            DB::table('tags')->insert([['id' => 1, 'codigo' => 'Vendido'], ['id' => 2, 'codigo' => 'Sin venta']]);
            DB::table('tag_vecino')->insert([['vecino_id' => 2, 'tag_id' => 1], ['vecino_id' => 5, 'tag_id' => 2]]);
            DB::table('tag_sales')->insert(['tag_id' => 1, 'price' => 150, 'sold_at' => '2026-10-08', 'created_at' => '2026-10-08']);
            DB::table('pagos')->insert([
                ['vecino_id' => 3, 'mes' => '2026-10', 'cantidad' => 280],
                ['vecino_id' => 4, 'mes' => '2026-09', 'cantidad' => 280],
                ['vecino_id' => 4, 'mes' => '2026-11', 'cantidad' => 280],
            ]);

            $stats = (new DashboardController())->stats()->getData(true);

            $this->assertEqualsCanonicalizing([1, 2, 4, 5], array_column($stats['morosos'], 'id'));
            $this->assertSame(4, $stats['vecinos_pendientes']);
            $this->assertSame(5, $stats['total_vecinos']);
            $this->assertSame(1, $stats['total_vecinos'] - $stats['vecinos_pendientes']);
        } finally {
            Carbon::setTestNow();
        }
    }
}
