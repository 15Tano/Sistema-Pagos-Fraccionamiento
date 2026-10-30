<?php

namespace App\Console\Commands;

use App\Services\ControlAcceso\DeploymentReview;
use Illuminate\Console\Command;

class ReviewControlAccessDeployment extends Command
{
    protected $signature = 'control-acceso:revisar-despliegue';

    protected $description = 'Revisa estructura, migraciones, rutas y ajuste del monitor, sin habilitarlo ni leer credenciales.';

    public function handle(DeploymentReview $review): int
    {
        $result = $review->inspect();
        $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        return $result['backend_structure_ready'] ? self::SUCCESS : self::FAILURE;
    }
}
