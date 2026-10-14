<?php
namespace Tests\Feature;

use App\Http\Controllers\TagController;
use App\Http\Controllers\TagSaleController;
use App\Http\Controllers\VecinoController;
use App\Models\Tag;
use App\Models\Vecino;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TagAssignmentWithoutSaleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
        Schema::create('tags', function (Blueprint $t) {
            $t->id(); $t->string('uuid')->nullable(); $t->string('codigo')->unique();
            $t->boolean('activo'); $t->timestamps();
        });
        $migration = require database_path('migrations/2026_10_14_120000_add_asignable_sin_venta_to_tags_table.php');
        $migration->up();
        Schema::create('vecinos', function (Blueprint $t) {
            $t->id(); $t->string('uuid')->nullable(); $t->string('nombre');
            $t->string('calle'); $t->string('numero_casa'); $t->timestamps();
        });
        Schema::create('tag_vecino', function (Blueprint $t) {
            $t->integer('tag_id'); $t->integer('vecino_id');
        });
        Schema::create('tag_sales', function (Blueprint $t) {
            $t->id(); $t->integer('tag_id'); $t->decimal('price'); $t->timestamps();
        });
    }

    private function createTag(string $code, bool $withoutSale = false): array
    {
        $request = Request::create('/tags', 'POST', ['codigo' => $code, 'asignable_sin_venta' => $withoutSale]);
        $request->setUserResolver(fn () => (object) ['role' => 'admin']);
        return Tag::withoutEvents(fn () => (new TagController)->store($request)->getData(true));
    }

    public function test_new_tag_can_be_assigned_and_retained_without_sale_or_stock(): void
    {
        $tag = $this->createTag('RECUPERADO', true);
        $this->assertFalse((bool) $tag['activo']);
        $this->assertTrue($tag['asignable_sin_venta']);
        $stock = $this->createTag('STOCK');
        $this->assertSame(1, (new TagController)->stock()->getData(true)['stock']);
        $data = ['nombre' => 'Ana', 'calle' => 'Plaza', 'numero_casa' => '1', 'tags' => [$tag['id'], $stock['id']]];
        $response = Vecino::withoutEvents(fn () => (new VecinoController)->store(Request::create('/vecinos', 'POST', $data)));
        $vecino = $response->getData(true)['vecino'];
        $this->assertSame([$tag['id']], array_column($vecino['tags'], 'id'));
        $updated = Vecino::withoutEvents(fn () => (new VecinoController)->update(Request::create('/vecinos', 'PUT', $data), $vecino['id']));
        $this->assertSame([$tag['id']], array_column($updated->getData(true)['vecino']['tags'], 'id'));
        $this->assertSame(0, DB::table('tag_sales')->count());
    }

    public function test_unassigned_reserved_tag_cannot_be_sold_and_duplicates_are_rejected(): void
    {
        $tag = $this->createTag('RECUPERADO', true);
        $id = DB::table('vecinos')->insertGetId(['uuid' => 'v', 'nombre' => 'Ana', 'calle' => 'Plaza', 'numero_casa' => '1']);
        $response = (new TagSaleController)->store(Request::create('/tag_sales', 'POST', ['tag_id' => $tag['id'], 'vecino_id' => $id]));
        $this->assertSame(422, $response->getStatusCode());
        $duplicate = (new TagController)->store(Request::create('/tags', 'POST', ['codigo' => 'RECUPERADO']));
        $this->assertSame(422, $duplicate->getStatusCode());
        $this->assertTrue(Tag::find($tag['id'])->asignable_sin_venta);
        $this->assertSame(0, DB::table('tag_sales')->count());
    }
}
