<?php
namespace App\Http\Controllers;
use App\Models\Aviso;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
class AvisoController extends Controller
{
    public function index()
    {
        return response()->json(
            Aviso::where('activo', true)
                ->orderByDesc('created_at')
                ->get()
        );
    }
    public function store(Request $request)
    {
        $request->validate([
            'titulo'      => 'required|string|max:255',
            'descripcion' => 'required|string',
            'tipo'        => 'required|in:urgente,informativo,aviso,positivo',
            'imagen'      => 'nullable|image|max:8192',
        ]);
        $data = $request->only(['titulo', 'descripcion', 'tipo']);
        $data['activo'] = true;
        if ($request->hasFile('imagen')) {
            $data['imagen'] = $request->file('imagen')->store('avisos', 'public');
        }
        $aviso = Aviso::create($data);
        return response()->json($aviso, 201);
    }
    public function update(Request $request, $id)
    {
        $aviso = Aviso::findOrFail($id);
        $request->validate([
            'titulo'           => 'sometimes|string|max:255',
            'descripcion'      => 'sometimes|string',
            'tipo'             => 'sometimes|in:urgente,informativo,aviso,positivo',
            'imagen'           => 'nullable|image|max:8192',
            'eliminar_imagen'  => 'nullable|boolean',
        ]);
        $data = $request->only(['titulo', 'descripcion', 'tipo']);
        if ($request->hasFile('imagen')) {
            if ($aviso->imagen) {
                Storage::disk('public')->delete($aviso->imagen);
            }
            $data['imagen'] = $request->file('imagen')->store('avisos', 'public');
        } elseif ($request->boolean('eliminar_imagen') && $aviso->imagen) {
            Storage::disk('public')->delete($aviso->imagen);
            $data['imagen'] = null;
        }
        $aviso->update($data);
        return response()->json($aviso);
    }
    public function destroy($id)
    {
        $aviso = Aviso::findOrFail($id);
        if ($aviso->imagen) {
            Storage::disk('public')->delete($aviso->imagen);
        }
        $aviso->delete();
        return response()->json(['message' => 'Aviso eliminado']);
    }
}
