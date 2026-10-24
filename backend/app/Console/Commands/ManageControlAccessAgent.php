<?php

namespace App\Console\Commands;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ManageControlAccessAgent extends Command
{
    protected $signature = 'control-acceso:agente {operacion : crear, rotar o revocar}
        {--id= : UUID del agente} {--nombre= : Nombre de la caseta} {--serial= : Serial autorizado}';

    protected $description = 'Administra credenciales exclusivas de ingesta, sin cuentas humanas ni conexion a C3.';

    public function handle(): int
    {
        $operation = $this->argument('operacion');
        if (! in_array($operation, ['crear', 'rotar', 'revocar'], true)) {
            $this->error('Operacion invalida: crear, rotar o revocar.');

            return self::FAILURE;
        }
        $input = ['id' => strtolower($this->option('id') ?? ''), 'nombre' => $this->option('nombre'),
            'serial' => $this->option('serial')];
        $rules = $operation === 'crear' ? [
            'nombre' => ['required', 'string', 'max:120'],
            'serial' => ['required', 'string', 'max:64', 'regex:/\A[A-Za-z0-9_.:-]+\z/'],
        ] : ['id' => ['required', 'uuid']];
        $validation = Validator::make($input, $rules);
        if ($validation->fails()) {
            $this->error('Opciones invalidas. Crear requiere --nombre y --serial; rotar/revocar requieren --id.');

            return self::FAILURE;
        }
        $result = DB::transaction(function () use ($operation, $input) {
            $now = CarbonImmutable::now('UTC')->format('Y-m-d H:i:s.u');
            if ($operation === 'crear') {
                if (DB::table('control_acceso_agentes')->where('device_serial', $input['serial'])->exists()) {
                    return null;
                }
                $id = (string) Str::uuid();
                $token = 'sica_'.bin2hex(random_bytes(32));
                DB::table('control_acceso_agentes')->insert([
                    'id' => $id, 'nombre' => $input['nombre'], 'device_serial' => $input['serial'],
                    'token_hash' => hash('sha256', $token), 'created_at' => $now, 'updated_at' => $now,
                ]);

                return ['id' => $id, 'token' => $token];
            }
            $agent = DB::table('control_acceso_agentes')->where('id', $input['id'])->lockForUpdate()->first();
            if (! $agent) {
                return null;
            }
            if ($operation === 'revocar') {
                DB::table('control_acceso_agentes')->where('id', $agent->id)
                    ->update(['revoked_at' => $agent->revoked_at ?? $now, 'updated_at' => $now]);

                return ['id' => $agent->id];
            }
            $token = 'sica_'.bin2hex(random_bytes(32));
            DB::table('control_acceso_agentes')->where('id', $agent->id)->update([
                'token_hash' => hash('sha256', $token), 'revoked_at' => null, 'updated_at' => $now,
            ]);

            return ['id' => $agent->id, 'token' => $token];
        }, 3);
        if ($result === null) {
            $this->error('No se modifico: agente inexistente o serial ya registrado.');

            return self::FAILURE;
        }
        $this->line('agent_id: '.$result['id']);
        if (isset($result['token'])) {
            $this->warn('Credencial mostrada una sola vez. Guardar en DPAPI del agente; no pegar en chats, logs ni Git.');
            $this->line('token: '.$result['token']);
        } else {
            $this->info('Credencial revocada. Se conserva el historial.');
        }

        return self::SUCCESS;
    }
}
