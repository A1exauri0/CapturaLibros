const fs = require('fs');
const path = require('path');

const RUTA_BASE_RPP = '\\\\172.40.5.84\\irec\\RESPALDO LIBROS TUXTLA NO TOCAR\\RPP';

/**
 * Obtiene la fecha actual en formato DD-MM-YY (Año a 2 dígitos)
 * @returns {string}
 */
function obtenerFechaHoy() {
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
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
          if (cap.trim().toLowerCase() === nombreCompleto.trim().toLowerCase()) {
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
  let tomo = 'T01';
  let anio = '2026';
  
  const partes = nombre.split('_');
  if (partes.length > 0) {
    if (partes[0].length === 4 && !isNaN(partes[0])) {
      anio = partes[0];
    }
  }
  
  return {
    id: nombre + '_' + metadatos.size + '_' + fecha,
    nombre: nombre,
    rutaLocal: rutaCompleta.replace(/\\/g, '/'),
    tamanioBytes: metadatos.size,
    procesado: false,
    tomo: tomo,
    anio: anio,
    capturista: capturista,
    fecha: fecha
  };
}

/**
 * Obtiene la lista de PDFs de la red segun el usuario activo y todas las carpetas de fecha
 * @param {object} usuarioActivo Usuario activo logueado en la app
 * @returns {Promise<Array>} Lista de PDFs estructurados
 */
async function obtenerPdfsDeRed(usuarioActivo) {
  if (!usuarioActivo) return [];
  if (!fs.existsSync(RUTA_BASE_RPP)) {
    console.error('El servicio de red (172.40.5.84) no está accesible al obtener PDFs.');
    return [];
  }

  const fechaHoy = obtenerFechaHoy();
  const listaArchivos = [];

  try {
    const esAdmin = usuarioActivo.NombreUsuario.toLowerCase() === 'admin' || 
                    usuarioActivo.NombreCompleto.toLowerCase() === 'administrador';

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
              const subcarpetas = fs.readdirSync(rutaCapBase);
              for (const sub of subcarpetas) {
                const rutaSub = path.join(rutaCapBase, sub);
                if (fs.statSync(rutaSub).isDirectory() && /^\d{2}-\d{2}-\d{2,4}$/.test(sub)) {
                  const archivos = fs.readdirSync(rutaSub);
                  const pdfs = archivos.filter(f => f.toLowerCase().endsWith('.pdf'));
                  
                  for (const nombre of pdfs) {
                    const rutaCompleta = path.join(rutaSub, nombre);
                    const metadatos = fs.statSync(rutaCompleta);
                    listaArchivos.push(estructurarPdf(nombre, rutaCompleta, metadatos, cap, sub));
                  }
                }
              }
            }
          }
        }
      }
    } else {
      // Capturista normal: buscar su directorio y escanear todas las carpetas de fecha
      const rutaCapturista = buscarDirectorioCapturista(usuarioActivo.NombreCompleto);
      if (rutaCapturista) {
        const subcarpetas = fs.readdirSync(rutaCapturista);
        let carpetasEncontradas = 0;

        for (const sub of subcarpetas) {
          const rutaSub = path.join(rutaCapturista, sub);
          if (fs.statSync(rutaSub).isDirectory() && /^\d{2}-\d{2}-\d{2,4}$/.test(sub)) {
            carpetasEncontradas++;
            const archivos = fs.readdirSync(rutaSub);
            const pdfs = archivos.filter(f => f.toLowerCase().endsWith('.pdf'));

            for (const nombre of pdfs) {
              const rutaCompleta = path.join(rutaSub, nombre);
              const metadatos = fs.statSync(rutaCompleta);
              listaArchivos.push(estructurarPdf(nombre, rutaCompleta, metadatos, usuarioActivo.NombreCompleto, sub));
            }
          }
        }

        // Si no tiene carpetas de fechas, inicializar al menos la de hoy
        if (carpetasEncontradas === 0) {
          const rutaHoy = path.join(rutaCapturista, fechaHoy);
          fs.mkdirSync(rutaHoy, { recursive: true });
        }
      }
    }
  } catch (error) {
    console.error('Error al escanear PDFs en red:', error);
  }

  return listaArchivos;
}

/**
 * Renombra un PDF fisico en disco
 */
async function renombrarArchivoPdf(rutaOriginal, nuevoNombre) {
  try {
    const carpetaSalida = path.dirname(rutaOriginal);
    const rutaDestino = path.join(carpetaSalida, `${nuevoNombre}.pdf`).replace(/\\/g, '/');

    if (fs.existsSync(rutaDestino)) {
      return { exito: false, mensaje: 'Ya existe un archivo con ese nombre.' };
    }

    fs.renameSync(rutaOriginal, rutaDestino);
    return { exito: true, mensaje: 'Archivo renombrado con éxito.', rutaDestino };
  } catch (error) {
    console.error('Error al renombrar archivo en red:', error);
    return { exito: false, mensaje: `Error al renombrar: ${error.message}` };
  }
}

module.exports = {
  obtenerPdfsDeRed,
  renombrarArchivoPdf,
  buscarDirectorioCapturista,
  obtenerFechaHoy
};
