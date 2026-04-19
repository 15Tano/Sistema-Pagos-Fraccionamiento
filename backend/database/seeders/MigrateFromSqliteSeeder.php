<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class MigrateFromSqliteSeeder extends Seeder
{
    /**
     * Convierte cualquier formato de fecha a Y-m-d H:i:s para MySQL.
     * Devuelve null si la fecha es inválida o vacía.
     */
    private function parseDate(?string $date): ?string
    {
        if (!$date) return null;
        try {
            return Carbon::parse($date)->format('Y-m-d H:i:s');
        } catch (\Exception $e) {
            return null;
        }
    }

    private function parseDateOnly(?string $date): ?string
    {
        if (!$date) return null;
        try {
            return Carbon::parse($date)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }

    public function run(): void
    {
        config(['database.connections.sqlite_backup' => [
            'driver'   => 'sqlite',
            'database' => database_path('database_backup.sqlite'),
            'prefix'   => '',
        ]]);

        $sqlite = DB::connection('sqlite_backup');

        // ── Vecinos ──
        $this->command->info('Migrando vecinos...');
        $vecinos = $sqlite->table('vecinos')->get();
        foreach ($vecinos as $v) {
            DB::table('vecinos')->insert([
                'id'          => $v->id,
                'nombre'      => $v->nombre,
                'calle'       => $v->calle,
                'numero_casa' => $v->numero_casa,
                'user_id'     => null,
                'created_at'  => $this->parseDate($v->created_at),
                'updated_at'  => $this->parseDate($v->updated_at),
            ]);
        }
        $this->command->info("✅ {$vecinos->count()} vecinos migrados.");

        // ── Tags ──
        $this->command->info('Migrando tags...');
        $tags = $sqlite->table('tags')->get();
        foreach ($tags as $t) {
            DB::table('tags')->insert([
                'id'         => $t->id,
                'codigo'     => $t->codigo,
                'activo'     => $t->activo,
                'created_at' => $this->parseDate($t->created_at),
                'updated_at' => $this->parseDate($t->updated_at),
            ]);
        }
        $this->command->info("✅ {$tags->count()} tags migrados.");

        // ── Tag_vecino ──
        $this->command->info('Migrando relaciones tag-vecino...');
        $tagVecino = $sqlite->table('tag_vecino')->get();
        foreach ($tagVecino as $tv) {
            DB::table('tag_vecino')->insert([
                'id'         => $tv->id,
                'tag_id'     => $tv->tag_id,
                'vecino_id'  => $tv->vecino_id,
                'created_at' => $this->parseDate($tv->created_at),
                'updated_at' => $this->parseDate($tv->updated_at),
            ]);
        }
        $this->command->info("✅ {$tagVecino->count()} relaciones migradas.");

        // ── Tag_sales ──
        $this->command->info('Migrando ventas de tags...');
        $tagSales = $sqlite->table('tag_sales')->get();
        foreach ($tagSales as $ts) {
            DB::table('tag_sales')->insert([
                'id'         => $ts->id,
                'tag_id'     => $ts->tag_id,
                'sold_at'    => $this->parseDate($ts->sold_at),
                'price'      => $ts->price,
                'created_at' => $this->parseDate($ts->created_at),
                'updated_at' => $this->parseDate($ts->updated_at),
            ]);
        }
        $this->command->info("✅ {$tagSales->count()} ventas migradas.");

        // ── Pagos ──
        $this->command->info('Migrando pagos...');
        $pagos = $sqlite->table('pagos')->get();
        foreach ($pagos as $p) {
            DB::table('pagos')->insert([
                'id'             => $p->id,
                'vecino_id'      => $p->vecino_id,
                'cantidad'       => $p->cantidad,
                'mes'            => $p->mes,
                'tipo'           => $p->tipo,
                'restante'       => $p->restante ?? 0,
                'fecha_de_cobro' => $this->parseDateOnly($p->fecha_de_cobro ?? null),
                'meses_pagados'  => $p->meses_pagados ?? 1,
                'created_at'     => $this->parseDate($p->created_at),
                'updated_at'     => $this->parseDate($p->updated_at),
            ]);
        }
        $this->command->info("✅ {$pagos->count()} pagos migrados.");

        $this->command->info('');
        $this->command->info('🎉 Migración completada exitosamente.');
    }
}