<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\ControlAccessMySqlTrial;

#[Group('mysql-ensayo')]
class ControlAccessMySqlSummaryTest extends ControlAccessSummaryTest
{
    protected function prepareDatabase(): void
    {
        if (! getenv('CA_MYSQL_TRIAL_FILE')) {
            $this->markTestSkipped('Requiere MySQL local aislado verificado.');
        }
        ControlAccessMySqlTrial::configure();
        Schema::dropIfExists('control_acceso_salud_actual');
        Schema::dropIfExists('control_acceso_resumenes');
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->down();
        foreach (['tag_vecino', 'vecinos', 'tags', 'personal_access_tokens'] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
