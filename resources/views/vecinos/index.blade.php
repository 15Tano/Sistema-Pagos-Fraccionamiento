@extends('layouts.app')

@section('content')
    <h1 class="mb-3">Lista de Vecinos</h1>

    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    <a href="{{ route('vecinos.create') }}" class="btn btn-primary mb-3">Nuevo Vecino</a>

    <table class="table table-bordered">
        <thead>
            <tr>
                <th>Nombre</th>
                <th>Calle</th>
                <th>No. Casa</th>
                <th>Tags</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            @foreach($vecinos as $vecino)
                <tr>
                    <td>{{ $vecino->nombre }}</td>
                    <td>{{ $vecino->calle }}</td>
                    <td>{{ $vecino->numero_casa }}</td>
                    <td>{{ $vecino->tags->pluck('codigo')->join(', ') }}</td>
                    <td>
                        <a href="{{ route('vecinos.edit', $vecino->id) }}" class="btn btn-warning btn-sm">Editar</a>
                        <form action="{{ route('vecinos.destroy', $vecino->id) }}" method="POST" class="d-inline">
                            @csrf
                            @method('DELETE')
                            <button class="btn btn-danger btn-sm" onclick="return confirm('¿Eliminar este vecino?')">Eliminar</button>
                        </form>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection
