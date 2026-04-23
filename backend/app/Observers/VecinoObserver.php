<?php
namespace App\Observers;

use App\Models\Vecino;
use App\Models\AuditLog;

class VecinoObserver
{
    public function created(Vecino $vecino): void
    {
        AuditLog::registrar('created', 'Vecino', $vecino->id, null, $vecino->toArray());
    }

    public function updated(Vecino $vecino): void
    {
        AuditLog::registrar('updated', 'Vecino', $vecino->id, $vecino->getOriginal(), $vecino->getChanges());
    }

    public function deleted(Vecino $vecino): void
    {
        AuditLog::registrar('deleted', 'Vecino', $vecino->id, $vecino->toArray(), null);
    }
}