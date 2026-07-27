<?php
namespace App\Observers;
use App\Models\Aviso;
use App\Services\OneSignalService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
class AvisoObserver
{
    public function created(Aviso $aviso): void
    {
        $this->notificarAviso($aviso);
    }
    protected function notificarAviso(Aviso $aviso): void
    {
        try {
            $titulo = match ($aviso->tipo) {
                'urgente' => '🚨 ' . $aviso->titulo,
                default   => $aviso->titulo,
            };
            app(OneSignalService::class)->notifyAllResidents(
                $titulo,
                Str::limit($aviso->descripcion, 100),
                'https://sanisidro.info/residente?tab=avisos'
            );
        } catch (\Throwable $e) {
            Log::error('Error enviando notificación de aviso', [
                'aviso_id' => $aviso->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
