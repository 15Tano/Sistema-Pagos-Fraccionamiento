<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GenerateUuids extends Command
{
    protected $signature   = 'uuid:generate';
    protected $description = 'Genera UUIDs para todos los registros existentes en vecinos, tags y pagos';

    public function handle(): void
    {
        $tables = ['vecinos', 'tags', 'pagos'];

        foreach ($tables as $table) {
            $this->info("Generando UUIDs para {$table}...");

            $records = DB::table($table)->whereNull('uuid')->get(['id']);
            $bar     = $this->output->createProgressBar($records->count());
            $bar->start();

            foreach ($records as $record) {
                DB::table($table)
                    ->where('id', $record->id)
                    ->update(['uuid' => Str::uuid()->toString()]);
                $bar->advance();
            }

            $bar->finish();
            $this->newLine();
            $this->info("✅ {$records->count()} UUIDs generados en {$table}.");
        }

        $this->newLine();
        $this->info('🎉 Todos los UUIDs generados correctamente.');
    }
}