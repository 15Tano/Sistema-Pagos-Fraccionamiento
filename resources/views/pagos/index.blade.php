@extends('layouts.app')

@section('content')
<div class="p-6 bg-white shadow-lg rounded-2xl">
    <h2 class="text-xl font-bold mb-4">Historial de Pagos</h2>

    @if(session('success'))
        <div class="bg-green-100 text-green-700 p-2 rounded mb-4">
            {{ session('success') }}
        </div>
    @endif

    <table class="w-full border-collapse">
        <thead>
            <tr class="bg-gray-200">
                <th class="p-2">Vecino</th>
                <th class="p-2">Mes</th>
                <th class="p-2">Cantidad</th>
                <th class="p-2">Tipo</th>
                <th class="p-2">Restante</th>
            </tr>
        </thead>
        <tbody>
            @foreach($pagos as $pago)
            <tr class="border-b">
                <td class="p-2">{{ $pago->vecino->nombre }}</td>
                <td class="p-2">{{ $pago->mes }}</td>
                <td class="p-2">${{ number_format($pago->cantidad, 2) }}</td>
                <td class="p-2 capitalize">{{ $pago->tipo }}</td>
                <td class="p-2">
                    @if($pago->restante > 0)
                        <span class="text-red-600">Restan ${{ number_format($pago->restante, 2) }}</span>
                    @else
                        <span class="text-green-600">✔</span>
                    @endif
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endsection
