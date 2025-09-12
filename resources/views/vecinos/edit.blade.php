@extends('layouts.app')

@section('content')
    <h1>Editar Vecino</h1>

    <form action="{{ route('vecinos.update', $vecino->id) }}" method="POST">
        @csrf
        @method('PUT')

        <div class="mb-3">
            <label>Nombre</label>
            <input type="text" name="nombre" value="{{ $vecino->nombre }}" class="form-control" required>
        </div>
        <div class="mb-3">
            <label>Calle</label>
            <input type="text" name="calle" value="{{ $vecino->calle }}" class="form-control" required>
        </div>
        <div class="mb-3">
            <label>No. Casa</label>
            <input type="number" name="numero_casa" value="{{ $vecino->numero_casa }}" class="form-control" required>
        </div>
        <div class="mb-3">
            <label>No. Tag</label>
            <input type="text" name="numero_tag" value="{{ $vecino->numero_tag }}" class="form-control" required>
        </div>

        <button class="btn btn-primary">Actualizar</button>
        <a href="{{ route('vecinos.index') }}" class="btn btn-secondary">Cancelar</a>
    </form>
@endsection
