<?php

namespace Tests\Feature;

use App\Services\ControlAcceso\DeploymentReview;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class ControlAccessDeploymentReviewTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->prepareDatabase();
        config(['control_acceso.monitor_enabled' => false]);
        foreach (DeploymentReview::MIGRATIONS as $name) {
            (require database_path('migrations/'.$name.'.php'))->up();
        }
        Schema::create('migrations', function ($table) { $table->id(); $table->string('migration'); $table->integer('batch'); });
        foreach (DeploymentReview::MIGRATIONS as $name) {
            DB::table('migrations')->insert(['migration' => $name, 'batch' => 1]);
        }
        Schema::create('tags', function ($table) { $table->id(); $table->string('codigo'); });
        Schema::create('vecinos', function ($table) { $table->id(); $table->string('nombre'); });
        Schema::create('tag_vecino', function ($table) { $table->unsignedBigInteger('tag_id'); $table->unsignedBigInteger('vecino_id'); });
        Schema::create('users', function ($table) { $table->id(); $table->string('role'); });
        Schema::create('personal_access_tokens', function ($table) {
            $table->id(); $table->morphs('tokenable'); $table->string('name'); $table->string('token');
            $table->text('abilities')->nullable(); $table->timestamp('last_used_at')->nullable(); $table->timestamp('expires_at')->nullable();
        });
    }

    protected function prepareDatabase(): void
    {
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
    }

    private function inspect(): array { return app(DeploymentReview::class)->inspect(); }

    public function test_complete_schema_with_flag_off_is_structurally_ready_without_activation(): void
    {
        $result = $this->inspect();
        $this->assertTrue($result['backend_structure_ready']);
        $this->assertFalse($result['monitor_enabled']);
        $this->assertFalse($result['activation_authorized']);
        $this->assertSame(['history_for_guards' => false, 'revision' => 1], $result['history_setting']);
        $this->assertSame([], $result['checks']['migrations_missing']);
    }

    public function test_flag_on_does_not_claim_dell_delivery_or_authorization(): void
    {
        config(['control_acceso.monitor_enabled' => true]);
        $result = $this->inspect();
        $this->assertTrue($result['backend_structure_ready']);
        $this->assertTrue($result['monitor_enabled']);
        $this->assertFalse($result['activation_authorized']);
        $this->assertStringContainsString('Dell', $result['limits'][0]);
    }

    public function test_missing_table_and_column_are_reported_without_creating_or_repairing_them(): void
    {
        Schema::drop('tag_vecino');
        Schema::table('vecinos', fn ($table) => $table->dropColumn('nombre'));
        $result = $this->inspect();
        $this->assertFalse($result['backend_structure_ready']);
        $this->assertSame(['tag_id', 'vecino_id'], $result['checks']['columns']['tag_vecino']);
        $this->assertSame(['nombre'], $result['checks']['columns']['vecinos']);
        $this->assertFalse(Schema::hasTable('tag_vecino'));
        $this->assertFalse(Schema::hasColumn('vecinos', 'nombre'));
    }

    public function test_present_schema_does_not_substitute_missing_migration_registry(): void
    {
        DB::table('migrations')->where('migration', DeploymentReview::MIGRATIONS[2])->delete();
        $result = $this->inspect();
        $this->assertFalse($result['backend_structure_ready']);
        $this->assertSame([DeploymentReview::MIGRATIONS[2]], $result['checks']['migrations_missing']);
    }

    public function test_index_with_expected_name_but_wrong_column_order_is_rejected(): void
    {
        Schema::table('control_acceso_filas', fn ($table) => $table->dropIndex('ca_rows_current'));
        Schema::table('control_acceso_filas', fn ($table) => $table->index(['door_id', 'kind', 'id'], 'ca_rows_current'));
        $result = $this->inspect();
        $this->assertFalse($result['backend_structure_ready']);
        $this->assertFalse($result['checks']['indexes']['ca_rows_current']);
    }

    public function test_missing_or_invalid_setting_is_rejected_without_defaulting_to_allowed(): void
    {
        DB::table('control_acceso_monitor_configuracion')->delete();
        $this->assertFalse($this->inspect()['backend_structure_ready']);
        DB::table('control_acceso_monitor_configuracion')->insert(['id' => 1, 'historial_vigilancia' => 1, 'revision' => 0]);
        $result = $this->inspect();
        $this->assertFalse($result['backend_structure_ready']);
        $this->assertNull($result['history_setting']);
    }

    public function test_route_without_auth_middleware_is_rejected(): void
    {
        $route = collect(Route::getRoutes())->first(fn ($route) => $route->uri() === 'api/control-acceso/monitor/actual');
        $action = $route->getAction(); $action['middleware'] = ['api']; $route->setAction($action);
        $result = $this->inspect();
        $this->assertFalse($result['checks']['routes']['GET monitor/actual']);
        $this->assertFalse($result['backend_structure_ready']);
    }

    public function test_route_pointing_to_old_controller_action_is_rejected(): void
    {
        $route = collect(Route::getRoutes())->first(fn ($route) => $route->uri() === 'api/control-acceso/monitor/actual');
        $action = $route->getAction(); $action['controller'] = 'OldController@current'; $route->setAction($action);
        $this->assertFalse($this->inspect()['backend_structure_ready']);
    }

    public function test_database_failure_does_not_print_sensitive_sql_or_credentials(): void
    {
        Schema::shouldReceive('hasTable')->andThrow(new RuntimeException('PRIVATE_DSN password=private_secret'));
        $result = $this->inspect();
        $this->assertFalse($result['backend_structure_ready']);
        $this->assertSame('database_review_failed', $result['error']);
        $this->assertStringNotContainsString('private_secret', json_encode($result));
        $this->assertStringNotContainsString('PRIVATE_DSN', json_encode($result));
    }

    public function test_command_reads_metadata_and_setting_only_and_never_changes_data(): void
    {
        $queries = [];
        DB::listen(function ($query) use (&$queries) { $queries[] = strtolower(ltrim($query->sql)); });
        $exit = Artisan::call('control-acceso:revisar-despliegue');
        $result = json_decode(Artisan::output(), true, 64, JSON_THROW_ON_ERROR);
        $this->assertSame(0, $exit);
        $this->assertTrue($result['backend_structure_ready']);
        $this->assertFalse($result['writes_performed']);
        $this->assertNotEmpty($queries);
        foreach ($queries as $query) {
            $this->assertMatchesRegularExpression('/\A(select|pragma)\b/', $query);
            $this->assertDoesNotMatchRegularExpression('/from ["`]?control_acceso_(agentes|estados|lotes|respuestas|filas)["`]?\b/', $query);
        }
    }

    public function test_command_returns_failure_when_review_is_required(): void
    {
        Schema::drop('migrations');
        $this->assertSame(1, Artisan::call('control-acceso:revisar-despliegue'));
        $this->assertSame('review_required', json_decode(Artisan::output(), true)['status']);
    }
}
