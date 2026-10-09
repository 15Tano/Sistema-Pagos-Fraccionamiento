<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
Illuminate\Support\Facades\DB::transaction(function () {
    $tag = App\Models\Tag::where('codigo', '6716255')->lockForUpdate()->firstOrFail();
    $sale = App\Models\TagSale::where('tag_id', $tag->id)->lockForUpdate()->first();
    if (!$sale || $sale->id !== 167) {
        throw new RuntimeException('La venta no corresponde al ID 167; no se modificó nada.');
    }
    $backup = storage_path('app/venta-167-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json');
    $before = [
        'tag' => $tag->getAttributes(),
        'venta' => $sale->getAttributes(),
        'vinculos' => Illuminate\Support\Facades\DB::table('tag_vecino')->where('tag_id', $tag->id)->get(),
    ];
    if (file_put_contents($backup, json_encode($before, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), LOCK_EX) === false) {
        throw new RuntimeException('No se pudo respaldar la venta. No se modificó nada.');
    }
    $response = (new App\Http\Controllers\TagSaleController)->destroy($sale->id);
    if ($response->getStatusCode() !== 200) throw new RuntimeException($response->getContent());
    $tag->refresh();
    if ($tag->activo || $tag->vecinos()->exists() || $tag->tagSale()->exists()) {
        throw new RuntimeException('Falló la verificación; operación revertida.');
    }
    echo json_encode(['codigo' => $tag->codigo, 'tag_id' => $tag->id, 'venta_eliminada' => 167, 'disponible' => true, 'respaldo' => $backup]);
});
