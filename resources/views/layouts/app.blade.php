<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Sistema de Pagos</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
        <div class="container">
            <a class="navbar-brand" href="{{ route('vecinos.index') }}">Sistema de Pagos San Isidro</a>
            @if(Route::currentRouteName() != 'login')
                <a class="btn btn-danger rounded-pill ms-3" href="{{ route('logout') }}">Cerrar Sesión</a>
            @endif
        </div>
    </nav>

    <div class="container">
        @yield('content')
    </div>
</body>
</html>
