<?php

namespace App\Console\Commands;

use App\Services\ControlAcceso\RetentionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RetainControlAccess extends Command
{
    protected $signature = 'control-acceso:retencion {--apply : Aplicar; sin esta opción solo simula} {--size=500} {--batches=20}';

    protected $description = 'Retira detalle vencido conservando ACK, identidades y últimas lecturas por pluma';

    public function handle(RetentionService $service): int
    {
        foreach (['size' => 1000, 'batches' => 100] as $option => $max) {
            if (! ctype_digit((string) $this->option($option)) || (int) $this->option($option) < 1 || (int) $this->option($option) > $max) {
                $this->error("--$option debe estar entre 1 y $max.");

                return self::FAILURE;
            }
        }
        if ((int) $this->option('size') * (int) $this->option('batches') > 10000) {
            $this->error('size × batches no debe superar 10000 por fase/agente.');

            return self::FAILURE;
        }
        $result = $service->run((bool) $this->option('apply'), (int) $this->option('size'), (int) $this->option('batches'));
        if ($this->option('apply')) {
            Log::channel('daily')->info('control_acceso.retencion', $result);
        }
        $this->line(json_encode($result,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
