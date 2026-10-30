<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\ControlAccessMySqlTrial;

#[Group('mysql-ensayo')]
class ControlAccessMySqlMonitorTest extends ControlAccessMonitorTest
{
    protected function prepareDatabase(): void
    {
        if (! getenv('CA_MYSQL_TRIAL_FILE')) {
            $this->markTestSkipped('MySQL aislado: habilitar el ensayo local documentado.');
        }
        ControlAccessMySqlTrial::configure();
        Schema::dropIfExists('control_acceso_monitor_configuracion');
        // Solo la instancia/base/usuario/ruta/marcador exclusivos comprobados por configure().
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->down();
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('tag_vecino');
        Schema::dropIfExists('vecinos');
        Schema::dropIfExists('tags');
    }
}
