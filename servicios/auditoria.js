const os = require("os");

// URL local de desarrollo en Laragon para stellum2.0
const URL_API_AUDITORIA = "http://localhost:8000/api/registro-libros";

/**
 * Envía un registro de auditoría al servidor central de Stellum.
 * @param {object} datosRegistro Datos del evento de auditoría
 * @returns {Promise<{exito: boolean, mensaje: string}>}
 */
async function reportarAuditoria(datosRegistro) {
  try {
    const pcName = os.hostname();
    const payload = {
      user_id: datosRegistro.userId,
      usuario: datosRegistro.usuario,
      turno: datosRegistro.turno,
      categoria: datosRegistro.categoria || "Libros",
      pc: pcName,
      directorio: datosRegistro.directorio,
      accion: datosRegistro.accion,
      archivo_original: datosRegistro.archivoOriginal,
      archivo_nuevo: datosRegistro.archivoNuevo,
      detalles: datosRegistro.detalles,
      paginas: datosRegistro.paginas || 0,
    };

    console.log("Enviando auditoría a Stellum:", payload);

    const respuesta = await fetch(URL_API_AUDITORIA, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!respuesta.ok) {
      throw new Error(`Código HTTP: ${respuesta.status}`);
    }

    const resultado = await respuesta.json();
    return { exito: true, mensaje: "Auditoría guardada correctamente." };
  } catch (error) {
    console.error("Error al registrar auditoría en Stellum:", error.message);
    return {
      exito: false,
      mensaje: `No se pudo sincronizar la auditoría: ${error.message}`,
    };
  }
}

module.exports = {
  reportarAuditoria,
};
