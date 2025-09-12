@extends('layouts.app')

@section('title', 'Búsqueda de Vecinos')

@section('content')
<div class="max-w-lg mx-auto bg-white p-8 rounded-xl shadow-lg">
    <h2 class="text-xl font-bold mb-6 text-center">Buscar Vecino</h2>

    {{-- Formulario de búsqueda --}}
    <form method="GET" action="{{ route('guest') }}" class="space-y-4">
        <div>
            <label class="block font-medium">Nombre del vecino</label>
            <input type="text" name="q" value="{{ request('q') }}" 
                   class="w-full border rounded px-3 py-2" placeholder="Ej: Juan Pérez">
        </div>
        <div class="text-center">
            <button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                Buscar
            </button>
        </div>
    </form>

    {{-- Resultados --}}
    @if(isset($vecinos) && count($vecinos) > 0)
        <div class="mt-6">
            <h3 class="text-lg font-semibold mb-3">Resultados:</h3>

            @foreach($vecinos as $vecino)
                <div class="border rounded-lg p-4 mb-4 bg-gray-50 shadow-sm">
                    <h4 class="font-bold text-blue-700">{{ $vecino->nombre }}</h4>
                    <p>Dirección: {{ $vecino->direccion }}</p>
                    <p>Teléfono: {{ $vecino->telefono }}</p>

                    <h5 class="mt-3 font-semibold text-gray-700">Historial de Pagos:</h5>
                    @if(count($vecino->pagos) > 0)
                        <table class="w-full mt-2 border-collapse border">
                            <thead>
                                <tr class="bg-gray-200">
                                    <th class="border px-2 py-1">Mes</th>
                                    <th class="border px-2 py-1">Año</th>
                                    <th class="border px-2 py-1">Monto</th>
                                    <th class="border px-2 py-1">Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($vecino->pagos as $pago)
                                    <tr>
                                        <td class="border px-2 py-1">{{ $pago->mes }}</td>
                                        <td class="border px-2 py-1">{{ $pago->año }}</td>
                                        <td class="border px-2 py-1">${{ number_format($pago->monto, 2) }}</td>
                                        <td class="border px-2 py-1">{{ $pago->created_at->format('d/m/Y') }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    @else
                        <p class="text-gray-500 italic">No tiene pagos registrados.</p>
                    @endif
                </div>
            @endforeach
        </div>
    @elseif(request('q'))
        <div class="mt-6 p-4 bg-yellow-100 text-yellow-700 rounded">
            ⚠️ No se encontraron vecinos con ese nombre.
        </div>
    @endif
</div>
@endsection
