<form action="{{ route('pagos.store') }}" method="POST">
    @csrf   <!-- 👈 Esto es lo que falta -->
    
    <div>
        <label for="vecino_id">Vecino</label>
        <select name="vecino_id" id="vecino_id" required>
            @foreach($vecinos as $vecino)
                <option value="{{ $vecino->id }}">{{ $vecino->nombre }}</option>
            @endforeach
        </select>
    </div>

    <div>
        <label for="cantidad">Cantidad</label>
        <input type="number" name="cantidad" id="cantidad" step="0.01" required>
    </div>

    <div>
        <label for="mes">Mes</label>
        <input type="month" name="mes" id="mes" required>
    </div>

    <div>
        <label for="tipo">Tipo de Pago</label>
        <select name="tipo" id="tipo" required>
            <option value="ordinario">Ordinario</option>
            <option value="extraordinario">Extraordinario</option>
        </select>
    </div>

    <button type="submit">Registrar Pago</button>
</form>
