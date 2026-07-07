const fs = require("fs");
const path = require("path");

let baseSitioArchivos = "\\\\172.40.5.84\\irec\\";
if (!baseSitioArchivos.endsWith("\\") && !baseSitioArchivos.endsWith("/")) {
  baseSitioArchivos += "\\";
}
const RUTA_BASE_RPP = `${baseSitioArchivos}RESPALDO LIBROS TUXTLA NO TOCAR\\RPP`;

/**
 * Obtiene la fecha actual en formato DD-MM-YY (Año a 2 dígitos)
 * @returns {string}
 */
function obtenerFechaHoy() {
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, "0");
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = String(hoy.getFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
}

/**
 * Busca de forma recursiva en todas las PC-XX la carpeta del capturista
 * @param {string} nombreCompleto Nombre completo del capturista
 * @returns {string|null} Ruta completa de la carpeta base del capturista
 */
function buscarDirectorioCapturista(nombreCompleto) {
  if (!fs.existsSync(RUTA_BASE_RPP)) {
    console.error(`Ruta base no accesible: ${RUTA_BASE_RPP}`);
    return null;
  }

  const pcs = fs.readdirSync(RUTA_BASE_RPP);
  for (const pc of pcs) {
    const rutaPC = path.join(RUTA_BASE_RPP, pc);
    if (fs.statSync(rutaPC).isDirectory()) {
      const capturistas = fs.readdirSync(rutaPC);
      for (const cap of capturistas) {
        const rutaCap = path.join(rutaPC, cap);
        if (fs.statSync(rutaCap).isDirectory()) {
          if (
            cap.trim().toLowerCase() === nombreCompleto.trim().toLowerCase()
          ) {
            return rutaCap;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Crea la estructura JSON para el archivo PDF
 */
function estructurarPdf(nombre, rutaCompleta, metadatos, capturista, fecha) {
  let tomo = "T01";
  let anio = "2026";

  const partes = nombre.split("_");
  if (partes.length > 0) {
    if (partes[0].length === 4 && !isNaN(partes[0])) {
      anio = partes[0];
    }
  }

  return {
    id: nombre + "_" + metadatos.size + "_" + fecha,
    nombre: nombre,
    rutaLocal: rutaCompleta.replace(/\\/g, "/"),
    tamanioBytes: metadatos.size,
    procesado: false,
    tomo: tomo,
    anio: anio,
    capturista: capturista,
    fecha: fecha,
  };
}

/**
 * Consulta las sesiones activas en Stellum para obtener los lotes en uso por otros usuarios.
 * @returns {Promise<Set<string>>} Conjunto de rutas relativas ocupadas en minúsculas.
 */
async function obtenerSesionesOcupadas() {
  try {
    const respuesta = await fetch("https://app.astronmx.cloud/api/libros/sesiones", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    if (respuesta.ok) {
      const data = await respuesta.json();
      if (data && data.ok && Array.isArray(data.sesiones)) {
        return new Set(
          data.sesiones.map((s) => (s.pc ? s.pc.toLowerCase().replace(/\\/g, "/") : ""))
        );
      }
    }
  } catch (error) {
    console.error("Error al consultar sesiones ocupadas en Stellum:", error.message);
  }
  return new Set();
}

/**
 * Obtiene la lista de PDFs de la red según el usuario activo y todas las carpetas de fecha
 * @param {object} usuarioActivo Usuario activo logueado en la app
 * @returns {Promise<Array>} Lista de PDFs estructurados
 */
async function obtenerPdfsDeRed(usuarioActivo) {
  if (!usuarioActivo) return [];
  if (!fs.existsSync(RUTA_BASE_RPP)) {
    console.error(
      "El servicio de red (172.40.5.84) no está accesible al obtener PDFs.",
    );
    return [];
  }

  const listaArchivos = [];

  try {
    const esAdmin =
      usuarioActivo.NombreUsuario.toLowerCase() === "admin" ||
      usuarioActivo.NombreCompleto.toLowerCase() === "administrador";

    if (esAdmin) {
      // El administrador ve todos los PDFs de todas las fechas y de todas las PC-XX
      const pcs = fs.readdirSync(RUTA_BASE_RPP);
      for (const pc of pcs) {
        const rutaPC = path.join(RUTA_BASE_RPP, pc);
        if (fs.statSync(rutaPC).isDirectory()) {
          const capturistas = fs.readdirSync(rutaPC);
          for (const cap of capturistas) {
            const rutaCapBase = path.join(rutaPC, cap);
            if (fs.statSync(rutaCapBase).isDirectory()) {
              // Estructura de 2 niveles (ej: Libros/01-06-26)
              if (/^\d{2}-\d{2}-\d{2,4}$/.test(cap)) {
                const archivos = fs.readdirSync(rutaCapBase);
                const pdfs = archivos.filter((f) => f.toLowerCase().endsWith(".pdf"));
                for (const nombre of pdfs) {
                  const rutaCompleta = path.join(rutaCapBase, nombre);
                  const metadatos = fs.statSync(rutaCompleta);
                  listaArchivos.push(
                    estructurarPdf(nombre, rutaCompleta, metadatos, pc, cap),
                  );
                }
                continue;
              }

              // Estructura de 3 niveles (ej: PC-01/Nombre/01-06-26)
              const subcarpetas = fs.readdirSync(rutaCapBase);
              for (const sub of subcarpetas) {
                const rutaSub = path.join(rutaCapBase, sub);
                if (
                  fs.statSync(rutaSub).isDirectory() &&
                  /^\d{2}-\d{2}-\d{2,4}$/.test(sub)
                ) {
                  const archivos = fs.readdirSync(rutaSub);
                  const pdfs = archivos.filter((f) =>
                    f.toLowerCase().endsWith(".pdf"),
                  );

                  for (const nombre of pdfs) {
                    const rutaCompleta = path.join(rutaSub, nombre);
                    const metadatos = fs.statSync(rutaCompleta);
                    listaArchivos.push(
                      estructurarPdf(nombre, rutaCompleta, metadatos, cap, sub),
                    );
                  }
                }
              }
            }
          }
        }
      }
    } else {
      // Capturista normal: buscar el primer lote libre disponible en la red
      console.log("Buscando primer lote libre disponible en red Z...");
      const sesionesOcupadas = await obtenerSesionesOcupadas();
      
      const pcs = fs.readdirSync(RUTA_BASE_RPP);
      let loteEncontrado = null;

      for (const pc of pcs) {
        if (loteEncontrado) break;
        const rutaPC = path.join(RUTA_BASE_RPP, pc);
        if (!fs.statSync(rutaPC).isDirectory()) continue;

        const capturistas = fs.readdirSync(rutaPC);
        for (const cap of capturistas) {
          if (loteEncontrado) break;
          const rutaCap = path.join(rutaPC, cap);
          if (!fs.statSync(rutaCap).isDirectory()) continue;

          // Estructura de 2 niveles (ej: Libros/01-06-26)
          if (/^\d{2}-\d{2}-\d{2,4}$/.test(cap)) {
            const rutaRelativaLote = `${pc}/${cap}`.toLowerCase().replace(/\\/g, "/");

            if (sesionesOcupadas.has(rutaRelativaLote)) {
              console.log(`Lote omitido (ocupado en Stellum): ${rutaRelativaLote}`);
              continue;
            }

            const archivos = fs.readdirSync(rutaCap);
            const pdfs = archivos.filter((f) => f.toLowerCase().endsWith(".pdf"));

            if (pdfs.length > 0) {
              console.log(`¡Lote libre asignado al usuario (2 niveles)!: ${rutaRelativaLote}`);
              loteEncontrado = {
                rutaSub: rutaCap,
                pdfs,
                cap: pc,
                sub: cap
              };
            }
            continue;
          }

          // Estructura de 3 niveles (ej: PC-01/Nombre/01-06-26)
          const subcarpetas = fs.readdirSync(rutaCap);
          for (const sub of subcarpetas) {
            if (loteEncontrado) break;
            const rutaSub = path.join(rutaCap, sub);
            if (!fs.statSync(rutaSub).isDirectory() || !/^\d{2}-\d{2}-\d{2,4}$/.test(sub)) continue;

            // La ruta relativa de la sesión en Stellum se guarda como "PC-XX/Capturista/Lote"
            const rutaRelativaLote = `${pc}/${cap}/${sub}`.toLowerCase().replace(/\\/g, "/");

            // Excluir lotes ocupados en Stellum por otros usuarios
            if (sesionesOcupadas.has(rutaRelativaLote)) {
              console.log(`Lote omitido (ocupado en Stellum): ${rutaRelativaLote}`);
              continue;
            }

            const archivos = fs.readdirSync(rutaSub);
            const pdfs = archivos.filter((f) => f.toLowerCase().endsWith(".pdf"));

            if (pdfs.length > 0) {
              console.log(`¡Lote libre asignado al usuario (3 niveles)!: ${rutaRelativaLote}`);
              loteEncontrado = {
                rutaSub,
                pdfs,
                cap,
                sub
              };
            }
          }
        }
      }

      if (loteEncontrado) {
        for (const nombre of loteEncontrado.pdfs) {
          const rutaCompleta = path.join(loteEncontrado.rutaSub, nombre);
          const metadatos = fs.statSync(rutaCompleta);
          listaArchivos.push(
            estructurarPdf(nombre, rutaCompleta, metadatos, loteEncontrado.cap, loteEncontrado.sub),
          );
        }
      }
    }
  } catch (error) {
    console.error("Error al escanear PDFs en red:", error);
  }

  return listaArchivos;
}

/**
 * Renombra un PDF fisico en disco
 */
async function renombrarArchivoPdf(rutaOriginal, nuevoNombre) {
  try {
    const carpetaSalida = path.dirname(rutaOriginal);
    const rutaDestino = path
      .join(carpetaSalida, `${nuevoNombre}.pdf`)
      .replace(/\\/g, "/");

    if (fs.existsSync(rutaDestino)) {
      return { exito: false, mensaje: "Ya existe un archivo con ese nombre." };
    }

    fs.renameSync(rutaOriginal, rutaDestino);
    return {
      exito: true,
      mensaje: "Archivo renombrado con éxito.",
      rutaDestino,
    };
  } catch (error) {
    console.error("Error al renombrar archivo en red:", error);
    return { exito: false, mensaje: `Error al renombrar: ${error.message}` };
  }
}

module.exports = {
  obtenerPdfsDeRed,
  renombrarArchivoPdf,
  buscarDirectorioCapturista,
  obtenerFechaHoy,
};
