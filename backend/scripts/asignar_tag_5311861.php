<?php
// Ejecutar desde backend: php scripts/asignar_tag_5311861.php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    Illuminate\Support\Facades\DB::transaction(function () {
        $tag = App\Models\Tag::where('id', 878)->lockForUpdate()->firstOrFail();
        $vecino = App\Models\Vecino::where('id', 208)->lockForUpdate()->firstOrFail();
        $nombre = preg_replace('/\s+/u', ' ', trim($vecino->nombre));
        if ((string) $tag->codigo !== '5311861' || strcasecmp($nombre, 'CAROL CRUALES') !== 0) {
            throw new RuntimeException('El código del TAG o el nombre del vecino no coincide. No se modificó nada.');
        }
        if ($tag->tagSale()->exists()) {
            throw new RuntimeException('Este TAG ya tiene una venta. No se modificó nada.');
        }
        if ($tag->vecinos()->where('vecinos.id', '<>', 208)->exists()) {
            throw new RuntimeException('Este TAG está vinculado a otro vecino. No se modificó nada.');
        }
        $before = ['tag' => $tag->getAttributes(), 'vinculos' => Illuminate\Support\Facades\DB::table('tag_vecino')->where('tag_id', 878)->get()];
        $backup = storage_path('app/asignacion-tag-878-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json');
        if (file_put_contents($backup, json_encode($before, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), LOCK_EX) === false) {
            throw new RuntimeException('No se pudo guardar el respaldo. No se modificó nada.');
        }
        if (!$tag->vecinos()->where('vecinos.id', 208)->exists()) {
            Illuminate\Support\Facades\DB::table('tag_vecino')->insert(['tag_id' => 878, 'vecino_id' => 208, 'created_at' => now(), 'updated_at' => now()]);
        }
        $tag->activo = true;
        $tag->save();
        if ($tag->tagSale()->exists() || !$vecino->tags()->where('tags.id', 878)->exists()) {
            throw new RuntimeException('Falló la verificación. Operación revertida.');
        }
        echo "TAG 5311861 asignado y activo para CAROL CRUALES (208), sin venta ni ingresos. Respaldo: {$backup}\n";
    });
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage().PHP_EOL);
    exit(1);
}
