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
Write-Host "Copiando archivos compilados a la red ($rutaRed)..."

# Intentar crear el directorio de red si no existe
if (-not (Test-Path $rutaRed)) {
    try {
        New-Item -ItemType Directory -Force -Path $rutaRed | Out-Null
    } catch {
        Write-Host "[ADVERTENCIA] No se pudo crear la ruta de red automáticamente. Intentando copiar directamente..." -ForegroundColor Yellow
    }
}

# Definir origen de datos para la copia
# Exigir que la aplicación esté empaquetada en dist/win-unpacked
if (-not (Test-Path "dist\win-unpacked")) {
    Write-Host "[ERROR] No se encontró la carpeta compilada 'dist\win-unpacked'." -ForegroundColor Red
    Write-Host "Por favor, compila la aplicación ejecutando primero el comando: pnpm run build" -ForegroundColor Yellow
    Write-Host "Publicación cancelada." -ForegroundColor Red
    exit 1
}

$rutaOrigen = "dist\win-unpacked"
$exclusionesDirectorio = @()

# Configurar argumentos de robocopy
$argumentosRobocopy = @($rutaOrigen, $rutaRed, "/E", "/PURGE", "/R:2", "/W:2")

if ($exclusionesDirectorio.Count -gt 0) {
    $argumentosRobocopy += "/XD"
    $argumentosRobocopy += $exclusionesDirectorio
}

$argumentosRobocopy += "/XF"
$argumentosRobocopy += "publicar.bat"
$argumentosRobocopy += "publicar.ps1"

# Ejecutar la copia recursiva con robocopy
robocopy @argumentosRobocopy
$exitCode = $LASTEXITCODE

if ($exitCode -ge 8) {
    Write-Host "[ERROR] Ocurrió un error al copiar los archivos a la red mediante robocopy. Código de salida: $exitCode" -ForegroundColor Red
    exit 1
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
Write-Host ""
