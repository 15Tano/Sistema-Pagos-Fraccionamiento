@extends('layouts.app')

@section('content')
    <h1>Registrar Vecino</h1>

    <form action="{{ route('vecinos.store') }}" method="POST">
        @csrf
        <div class="mb-3">
            <label>Nombre</label>
            <input type="text" name="nombre" class="form-control" required>
        </div>
        <div class="mb-3">
            <label>Calle</label>
            <input type="text" name="calle" class="form-control" required>
        </div>
        <div class="mb-3">
            <label>No. Casa</label>
            <input type="number" name="numero_casa" class="form-control" required>
        </div>
        <div class="mb-3">
            <label>Tags</label>
            <select name="tag_ids[]" class="form-control" multiple required>
                @foreach($tags as $tag)
                    <option value="{{ $tag->id }}">{{ $tag->codigo }}</option>
                @endforeach
            </select>
        </div>
        <button class="btn btn-success">Guardar</button>
        <a href="{{ route('vecinos.index') }}" class="btn btn-secondary">Cancelar</a>
    </form>
@endsection
