<?php
namespace App\Observers;
use App\Models\Pago;
use App\Models\AuditLog;
use App\Services\OneSignalService;
use Illuminate\Support\Facades\Log;
class PagoObserver
{
    public function created(Pago $pago): void
    {
        AuditLog::registrar('created', 'Pago', $pago->id, null, $pago->toArray());
        $this->notificarPago($pago);
    }
    public function updated(Pago $pago): void
    {
        AuditLog::registrar('updated', 'Pago', $pago->id, $pago->getOriginal(), $pago->getChanges());
    }
    public function deleted(Pago $pago): void
    {
        AuditLog::registrar('deleted', 'Pago', $pago->id, $pago->toArray(), null);
    }
    protected function notificarPago(Pago $pago): void
    {
        try {
            $vecino = $pago->vecino;
            if (!$vecino || !$vecino->user_id) {
                Log::warning('Pago sin vecino/usuario asociado, no se envía notificación', ['pago_id' => $pago->id]);
                return;
            }
            $userId = $vecino->user->id;
            $titulo = 'Pago registrado';
            $mensaje = sprintf(
                'Se registró tu pago de $%s correspondiente a %s.',
                number_format($pago->cantidad, 2),
                $pago->mes
            );
            app(OneSignalService::class)->notifyUser(
                $userId,
                $titulo,
                $mensaje,
                'https://sanisidro.info/residente?tab=pagos&recibo=' . $pago->uuid
            );
        } catch (\Throwable $e) {
            // Si OneSignal falla, no debe tumbar el registro del pago
            Log::error('Error enviando notificación de pago', [
                'pago_id' => $pago->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
