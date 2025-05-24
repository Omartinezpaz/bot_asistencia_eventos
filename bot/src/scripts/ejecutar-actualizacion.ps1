# Script de PowerShell para ejecutar la actualización de la estructura de la base de datos
# Autor: Claude AI
# Fecha: 2023

# Configuración (modificar según tus credenciales)
$host_db = "localhost"
$puerto = "5432"
$usuario = "omarte"  # Cambiar por tu usuario de PostgreSQL
$base_datos = "notificaciones"  # Cambiar por el nombre de tu base de datos
$ruta_script = "update-centros-schema.sql"

# Ruta al ejecutable de psql (ajustar según tu instalación)
$psql_path = "C:\Program Files\PostgreSQL\14\bin\psql.exe"  # Ajusta la versión si es diferente

# Verificar si existe el ejecutable psql en la ruta especificada
if (-not (Test-Path $psql_path)) {
    # Intentar encontrar psql automáticamente
    $posibles_rutas = @(
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe",
        "C:\Program Files\PostgreSQL\12\bin\psql.exe",
        "C:\Program Files\PostgreSQL\11\bin\psql.exe",
        "C:\Program Files\PostgreSQL\10\bin\psql.exe",
        "C:\Program Files\PostgreSQL\9.6\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\13\bin\psql.exe"
    )
    
    foreach ($ruta in $posibles_rutas) {
        if (Test-Path $ruta) {
            $psql_path = $ruta
            Write-Host "Encontrado psql en: $psql_path" -ForegroundColor Green
            break
        }
    }
    
    # Si aún no se encuentra, pedir al usuario
    if (-not (Test-Path $psql_path)) {
        Write-Host "No se pudo encontrar psql.exe automáticamente." -ForegroundColor Yellow
        $psql_path = Read-Host "Por favor, introduce la ruta completa a psql.exe (ejemplo: C:\Program Files\PostgreSQL\14\bin\psql.exe)"
        
        if (-not (Test-Path $psql_path)) {
            Write-Host "La ruta especificada no existe. Abortando." -ForegroundColor Red
            exit 1
        }
    }
}

# Mensaje inicial
Write-Host "=== Actualizando estructura de la tabla notif_eventos_bot.centrosv_724 ===" -ForegroundColor Cyan
Write-Host "Este script ejecutará las siguientes operaciones:" -ForegroundColor Yellow
Write-Host "1. Añadir campos latitud y longitud si no existen"
Write-Host "2. Añadir campos proveedor_geo y ultima_actualizacion_geo si no existen"
Write-Host "3. Corregir coordenadas inválidas (0,0)"
Write-Host "4. Actualizar registros existentes con coordenadas"
Write-Host "5. Crear índices para optimizar consultas"
Write-Host ""
Write-Host "Usando psql desde: $psql_path" -ForegroundColor Cyan
Write-Host ""

# Solicitar contraseña de manera segura (no se muestra en pantalla)
$securePassword = Read-Host "Introduce la contraseña para el usuario $usuario" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

# Verificar que el script SQL existe
if (-not (Test-Path $ruta_script)) {
    Write-Host "ERROR: No se encuentra el archivo $ruta_script en la ruta actual" -ForegroundColor Red
    Write-Host "Ubicación actual: $(Get-Location)"
    exit 1
}

try {
    # Establecer variable de entorno para la contraseña
    $env:PGPASSWORD = $password

    # Ejecutar el script SQL usando la ruta completa
    Write-Host "Ejecutando script SQL..." -ForegroundColor Yellow
    $resultado = & $psql_path -h $host_db -p $puerto -U $usuario -d $base_datos -f $ruta_script

    # Mostrar resultado
    if ($LASTEXITCODE -eq 0) {
        Write-Host "¡Actualización completada con éxito!" -ForegroundColor Green
        
        # Mostrar mensajes relevantes del resultado
        $mensajes = $resultado | Where-Object { $_ -match "NOTICE" -or $_ -match "total_centros" }
        foreach ($mensaje in $mensajes) {
            Write-Host $mensaje -ForegroundColor Cyan
        }
    } else {
        Write-Host "Error al ejecutar el script SQL (código: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host $resultado
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    # Limpiar la variable de entorno por seguridad
    $env:PGPASSWORD = ""
    $password = ""
    $securePassword = $null
    [System.GC]::Collect()
}

Write-Host "Presiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 