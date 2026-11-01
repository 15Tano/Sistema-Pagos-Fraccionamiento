<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\ControlAccessMySqlTrial;

#[Group('mysql-ensayo')]
class ControlAccessMySqlRetentionTest extends ControlAccessRetentionTest
{
    protected function prepareDatabase(): void
    {
        if (! getenv('CA_MYSQL_TRIAL_FILE')) {
            $this->markTestSkipped('Requiere MySQL local aislado verificado.');
        }
        ControlAccessMySqlTrial::configure();
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->down();
        Schema::dropIfExists('tag_vecino');
        Schema::dropIfExists('vecinos');
        Schema::dropIfExists('tags');
        Schema::dropIfExists('personal_access_tokens');
    }
}
