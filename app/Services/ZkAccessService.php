<?php

namespace App\Services;

// AGREGA ESTA LÍNEA EXACTA:
use Illuminate\Support\Facades\Log; 
// Y asegúrate de tener estas también:
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ZkAccessService
{
    /**
     * Actualiza la fecha de vencimiento de un Tag en el panel ZK.
     * * @param string $cardNo El número físico del tag (Hex o Decimal)
     * @param Carbon $expirationDate La fecha hasta donde tiene pagado
     */
    public function updateTagExpiration($cardNo, Carbon $expirationDate)
    {
        try {
            // Buscamos el usuario en ZK que tenga este número de tarjeta
            // Nota: En ZKAccess, 'CardNo' es el identificador del hardware
            $exists = DB::connection('zkteco')
                ->table('USERINFO')
                ->where('CardNo', $cardNo)
                ->exists();

            if ($exists) {
                DB::connection('zkteco')
                    ->table('USERINFO')
                    ->where('CardNo', $cardNo)
                    ->update([
                        'acc_enddate' => $expirationDate->endOfDay(), // Ej: 2026-03-31 23:59:59
                        'set_valid_time' => 1, // Forzar validación de tiempo
                        // Opcional: Si estaba deshabilitado manualmente, lo rehabilitamos
                        // 'privilege' => 0 
                    ]);
                
                Log::info("ZKTeco: Tag {$cardNo} actualizado hasta {$expirationDate->toDateString()}");
            } else {
                Log::warning("ZKTeco: Tag {$cardNo} no encontrado en la base de datos del panel.");
            }
        } catch (\Exception $e) {
            Log::error("ZKTeco Error: " . $e->getMessage());
        }
    }
}