<?php
namespace App\Observers;

use App\Models\Pago;
use App\Models\AuditLog;

class PagoObserver
{
    public function created(Pago $pago): void
    {
        AuditLog::registrar('created', 'Pago', $pago->id, null, $pago->toArray());
    }

    public function updated(Pago $pago): void
    {
        AuditLog::registrar('updated', 'Pago', $pago->id, $pago->getOriginal(), $pago->getChanges());
    }

    public function deleted(Pago $pago): void
    {
        AuditLog::registrar('deleted', 'Pago', $pago->id, $pago->toArray(), null);
    }
}