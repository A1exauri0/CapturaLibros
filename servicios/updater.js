const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, dialog } = require('electron');

// Ruta del servidor de red donde se colocarán las actualizaciones
const RUTA_RED_ACTUALIZACION = '\\\\172.40.5.84\\irec\\AppCapturaLibros';

/**
 * Compara la versión local con la de red y ejecuta el script de actualización si hay cambios.
 * Retorna true si se inició la actualización (lo que requiere cerrar la app actual).
 */
async function verificarYActualizar() {
  // Si estamos en desarrollo, no realizamos la actualización
  if (!app.isPackaged) {
    return false;
  }

  try {
    // Protección anti-bucle: si ya se actualizó hace menos de 2 minutos, no volver a intentar
    const archivoAntiBucle = path.join(os.tmpdir(), 'capturalibros_actualizado.flag');
    if (fs.existsSync(archivoAntiBucle)) {
      const estadisticas = fs.statSync(archivoAntiBucle);
      const diferenciaMinutos = (Date.now() - estadisticas.mtimeMs) / 1000 / 60;
      if (diferenciaMinutos < 2) {
        try {
          fs.unlinkSync(archivoAntiBucle);
        } catch (errorBorrado) {}
        return false;
      }
    }

    // Si no hay acceso a la carpeta de red, no hacemos nada
    if (!fs.existsSync(RUTA_RED_ACTUALIZACION)) {
      return false;
    }

    const rutaLocalEjecutable = process.execPath;
    const nombreEjecutable = path.basename(rutaLocalEjecutable);
    const rutaRedEjecutable = path.join(RUTA_RED_ACTUALIZACION, nombreEjecutable);

    if (!fs.existsSync(rutaRedEjecutable)) {
      return false;
    }

    let requiereActualizacion = false;
    const archivoVersionRed = path.join(RUTA_RED_ACTUALIZACION, 'version.txt');

    if (fs.existsSync(archivoVersionRed)) {
      // Enfoque 1: Comparar por versión de texto en version.txt
      const versionRedTexto = fs.readFileSync(archivoVersionRed, 'utf-8').trim();
      const versionLocal = app.getVersion();
      
      if (compararVersiones(versionLocal, versionRedTexto) < 0) {
        requiereActualizacion = true;
      }
    } else {
      // Enfoque 2: Respaldo por fecha de modificación del ejecutable
      const estadisticasLocal = fs.statSync(rutaLocalEjecutable);
      const estadisticasRed = fs.statSync(rutaRedEjecutable);
      
      // Tolerancia de más de 2 segundos para evitar falsos positivos
      if ((estadisticasRed.mtimeMs - estadisticasLocal.mtimeMs) > 2000) {
        requiereActualizacion = true;
      }
    }

    if (requiereActualizacion) {
      // Preguntar al usuario si desea instalar de forma sencilla
      const respuesta = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Sí', 'No'],
        defaultId: 0,
        title: 'Actualización Disponible',
        message: 'Hay una nueva actualización disponible de Captura de Libros. ¿Desea instalarla ahora?'
      });

      if (respuesta.response === 0) {
        // Crear archivo anti-bucle ANTES de actualizar
        try {
          fs.writeFileSync(archivoAntiBucle, Date.now().toString());
        } catch (errorEscritura) {}

        ejecutarScriptActualizacion(nombreEjecutable);
        
        // Forzar cierre inmediato para que el script .bat pueda copiar los archivos
        app.exit(0);
        return true;
      }
    }
  } catch (errorActualizacion) {
    console.error('Error al verificar actualización:', errorActualizacion.message);
  }
  return false;
}

/**
 * Compara dos cadenas de versiones semánticas. Retorna -1 si version1 < version2, 1 si version1 > version2, 0 si son iguales.
 */
function compararVersiones(version1, version2) {
  const limpiar = (v) => v.toLowerCase().replace(/version|v/g, '').trim();
  const partes1 = limpiar(version1).split('.').map(Number);
  const partes2 = limpiar(version2).split('.').map(Number);
  const maxLongitud = Math.max(partes1.length, partes2.length);

  for (let i = 0; i < maxLongitud; i++) {
    const valor1 = partes1[i] || 0;
    const valor2 = partes2[i] || 0;
    if (valor1 < valor2) return -1;
    if (valor1 > valor2) return 1;
  }
  return 0;
}

/**
 * Genera y ejecuta un archivo por lotes (.bat) temporal para realizar la copia.
 */
function ejecutarScriptActualizacion(nombreEjecutable) {
  try {
    const pidActual = process.pid;
    const rutaLocalAplicacion = path.dirname(process.execPath);
    const rutaArchivoBat = path.join(os.tmpdir(), 'actualizar_captura_libros.bat');

    const contenidoArchivoBat = [
      '@echo off',
      'chcp 65001 > nul',
      'title Actualizando Captura de Libros...',
      'echo Esperando a que la aplicacion se cierre...',
      ':loop',
      `tasklist /fi "pid eq ${pidActual}" | find "${pidActual}" > nul`,
      'if %errorlevel% equ 0 (',
      '    timeout /t 1 /nobreak > nul',
      '    goto loop',
      ')',
      'echo Aplicacion cerrada. Esperando a que se liberen los archivos...',
      'timeout /t 3 /nobreak > nul',
      'echo Copiando nuevos archivos desde la red...',
      `robocopy "${RUTA_RED_ACTUALIZACION}" "${rutaLocalAplicacion}" /E /R:3 /W:3`,
      'if %errorlevel% geq 8 (',
      '    echo ERROR: No se pudieron copiar los archivos correctamente.',
      '    echo Intente cerrar cualquier programa que use estos archivos y vuelva a intentar.',
      '    pause',
      '    del "%~f0"',
      '    exit /b 1',
      ')',
      'echo Iniciando la nueva version...',
      `start "" "${path.join(rutaLocalAplicacion, nombreEjecutable)}"`,
      'del "%~f0"'
    ].join('\r\n');

    fs.writeFileSync(rutaArchivoBat, contenidoArchivoBat, { encoding: 'latin1' });

    // Ejecutar el archivo por lotes en segundo plano de manera independiente
    const { spawn } = require('child_process');
    const procesoHijo = spawn('cmd.exe', ['/c', rutaArchivoBat], {
      detached: true,
      stdio: 'ignore'
    });
    procesoHijo.unref();

  } catch (errorScript) {
    console.error('No se pudo iniciar el proceso de actualización automática:', errorScript.message);
  }
}

module.exports = {
  verificarYActualizar
};
