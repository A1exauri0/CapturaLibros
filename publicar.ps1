# Codificación UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8

$rutaRed = "\\172.40.5.84\irec\AppCapturaLibros"
$rutaPackageJson = "package.json"

if (-not (Test-Path $rutaPackageJson)) {
    Write-Host "[ERROR] No se encontró el archivo package.json." -ForegroundColor Red
    exit 1
}

Write-Host "Leyendo la versión actual del package.json..."
$contenidoPackage = Get-Content -Raw -Path $rutaPackageJson | ConvertFrom-Json
$version = $contenidoPackage.version

if (-not $version) {
    Write-Host "[ERROR] No se pudo leer la versión del package.json." -ForegroundColor Red
    exit 1
}

Write-Host "Versión de la aplicación detectada: $version"
Write-Host ""

# Generar ruta del instalador local
$instaladorLocal = "dist\CapturaLibros Setup $version.exe"
if (-not (Test-Path $instaladorLocal)) {
    Write-Host "[ERROR] No se encontró el instalador compilado '$instaladorLocal'." -ForegroundColor Red
    Write-Host "Por favor, compile la aplicación primero con: pnpm run build" -ForegroundColor Yellow
    exit 1
}

# Intentar crear el directorio de red si no existe
if (-not (Test-Path $rutaRed)) {
    try {
        New-Item -ItemType Directory -Force -Path $rutaRed | Out-Null
    } catch {
        Write-Host "[ADVERTENCIA] No se pudo crear la ruta de red automáticamente." -ForegroundColor Yellow
    }
}

# Limpiar archivos viejos de forma tolerante a bloqueos
Write-Host "Limpiando archivos antiguos de la red..."
if (Test-Path $rutaRed) {
    $elementosRed = Get-ChildItem -Path $rutaRed
    foreach ($item in $elementosRed) {
        # Ignorar version.txt y el instalador estático
        if ($item.Name -ne "version.txt" -and $item.Name -ne "CapturaLibros Setup.exe") {
            try {
                Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
            } catch {
                # Ignorar error
            }
        }
    }
}

Write-Host "Copiando el instalador a la red..."
$instaladorDestino = "$rutaRed\CapturaLibros Setup.exe"

# Intentar copiar el instalador. Si está bloqueado, probamos con otro nombre o sobrescribimos
try {
    Copy-Item -Path $instaladorLocal -Destination $instaladorDestino -Force -ErrorAction SilentlyContinue
} catch {
    Write-Host "[ADVERTENCIA] 'CapturaLibros Setup.exe' de red está en uso. Creando copia alternativa..." -ForegroundColor Yellow
    $instaladorDestino = "$rutaRed\CapturaLibros Setup $version.exe"
    try {
        Copy-Item -Path $instaladorLocal -Destination $instaladorDestino -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "[ERROR] No se pudo copiar el instalador a la red de ninguna forma." -ForegroundColor Red
        exit 1
    }
}

# Crear o actualizar archivo version.txt en red
try {
    Set-Content -Path "$rutaRed\version.txt" -Value $version -Encoding Ascii
    Write-Host ""
    Write-Host "¡Publicación completada con éxito!" -ForegroundColor Green
    Write-Host "Versión publicada en la red: $version" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] No se pudo crear el archivo version.txt en la red." -ForegroundColor Red
    exit 1
}
