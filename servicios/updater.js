const fs = require("fs");
const path = require("path");
const os = require("os");
const { app, dialog } = require("electron");

// Ruta del servidor de red donde se colocarán las actualizaciones
let baseSitio = "\\\\172.40.5.84\\irec\\";
if (!baseSitio.endsWith("\\") && !baseSitio.endsWith("/")) {
  baseSitio += "\\";
}
const RUTA_RED_ACTUALIZACION = `${baseSitio}AppCapturaLibros`;

function registrarDebug(mensaje) {
  try {
    const rutaLog = path.join(os.tmpdir(), "capturalibros_updater_debug.txt");
    const timestamp = new Date().toISOString();
    fs.appendFileSync(rutaLog, `[${timestamp}] ${mensaje}\r\n`);
    console.log(`[UPDATER DEBUG] ${mensaje}`);
  } catch (e) {
    console.error("Error al escribir log de depuración:", e);
  }
}

/**
 * Compara la versión local con la de red y ejecuta el instalador en segundo plano si hay cambios.
 */
async function verificarYActualizar() {
  registrarDebug("--- Iniciando verificación de actualización ---");
  registrarDebug(`app.isPackaged: ${app.isPackaged}`);

  if (!app.isPackaged) {
    registrarDebug("Abortando actualizador: La aplicación no está empaquetada (modo desarrollo).");
    return false;
  }

  try {
    const archivoAntiBucle = path.join(
      os.tmpdir(),
      "capturalibros_actualizado.flag",
    );
    if (fs.existsSync(archivoAntiBucle)) {
      const estadisticas = fs.statSync(archivoAntiBucle);
      const diferenciaMinutos = (Date.now() - estadisticas.mtimeMs) / 1000 / 60;
      if (diferenciaMinutos < 2) {
        registrarDebug("Abortando actualizador: Bloqueo anti-bucle activo (< 2 min).");
        try {
          fs.unlinkSync(archivoAntiBucle);
        } catch (errorBorrado) {}
        return false;
      }
    }

    if (!fs.existsSync(RUTA_RED_ACTUALIZACION)) {
      registrarDebug("Abortando actualizador: RUTA_RED_ACTUALIZACION no existe o es inaccesible.");
      return false;
    }

    const archivoVersionRed = path.join(RUTA_RED_ACTUALIZACION, "version.txt");
    const rutaRedInstalador = path.join(RUTA_RED_ACTUALIZACION, "CapturaLibros Setup.exe");

    if (!fs.existsSync(archivoVersionRed) || !fs.existsSync(rutaRedInstalador)) {
      registrarDebug("Abortando actualizador: El archivo version.txt o el instalador no existen en la red.");
      return false;
    }

    const versionRedTexto = fs.readFileSync(archivoVersionRed, "utf-8").trim();
    const versionLocal = app.getVersion();

    registrarDebug(`versionLocal: ${versionLocal}, versionRed: ${versionRedTexto}`);
    const comparacion = compararVersiones(versionLocal, versionRedTexto);

    if (comparacion < 0) {
      registrarDebug("Nueva versión detectada. Preguntando al usuario...");
      const respuesta = await dialog.showMessageBox({
        type: "question",
        buttons: ["Sí", "No"],
        defaultId: 0,
        title: "Actualización Disponible",
        message: `Hay una nueva actualización disponible (${versionRedTexto}) de Captura de Libros. ¿Desea instalarla ahora?`,
      });

      if (respuesta.response === 0) {
        try {
          fs.writeFileSync(archivoAntiBucle, Date.now().toString());
        } catch (errorEscritura) {}

        const rutaInstaladorLocal = path.join(os.tmpdir(), "CapturaLibros_Setup_Tmp.exe");
        registrarDebug(`Copiando instalador de red a temporal local: ${rutaInstaladorLocal}`);

        const util = require("util");
        const copyFileAsync = util.promisify(fs.copyFile);
        await copyFileAsync(rutaRedInstalador, rutaInstaladorLocal);

        registrarDebug("Copia finalizada. Lanzando instalador silencioso (/S)...");

        const { spawn } = require("child_process");
        const procesoHijo = spawn(rutaInstaladorLocal, ["/S"], {
          detached: true,
          stdio: "ignore",
        });
        procesoHijo.unref();

        registrarDebug("Cerrando la aplicación mediante app.exit(0) para permitir la instalación silenciosa.");
        app.exit(0);
        return true;
      }
    }
  } catch (errorActualizacion) {
    registrarDebug(`ERROR CRÍTICO en verificarYActualizar: ${errorActualizacion.message}`);
  }
  return false;
}

function compararVersiones(version1, version2) {
  const limpiar = (v) =>
    v
      .toLowerCase()
      .replace(/version|v/g, "")
      .trim();
  const partes1 = limpiar(version1).split(".").map(Number);
  const partes2 = limpiar(version2).split(".").map(Number);
  const maxLongitud = Math.max(partes1.length, partes2.length);

  for (let i = 0; i < maxLongitud; i++) {
    const valor1 = partes1[i] || 0;
    const valor2 = partes2[i] || 0;
    if (valor1 < valor2) return -1;
    if (valor1 > valor2) return 1;
  }
  return 0;
}

module.exports = {
  verificarYActualizar,
};
