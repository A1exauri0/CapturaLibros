const fs = require('fs');

const RUTA_USUARIOS = '\\\\172.40.5.84\\irec\\Monitoreo\\usuarios.json';

/**
 * Valida las credenciales de un usuario contra el archivo usuarios.json en la unidad Z
 * @param {string} usuario Nombre del usuario
 * @param {string} pin PIN o contraseña
 * @returns {Promise<{exito: boolean, mensaje: string, usuario?: object}>}
 */
async function validarUsuario(usuario, pin) {
  try {
    if (!fs.existsSync(RUTA_USUARIOS)) {
      return { 
        exito: false, 
        mensaje: 'El servicio de red (172.40.5.84) no está accesible. No se pudo leer el archivo de usuarios.' 
      };
    }

    const contenido = fs.readFileSync(RUTA_USUARIOS, 'utf-8');
    const datosJSON = JSON.parse(contenido);

    const usuarioEncontrado = datosJSON.Usuarios.find(u => 
      u.NombreUsuario && u.NombreUsuario.trim().toLowerCase() === usuario.trim().toLowerCase()
    );

    if (!usuarioEncontrado) {
      return { exito: false, mensaje: 'Usuario no registrado.' };
    }

    const pinCorrecto = usuarioEncontrado.Pin.toString() === pin.toString() || 
                        (datosJSON.PinMaestro && datosJSON.PinMaestro.toString() === pin.toString());

    if (!pinCorrecto) {
      return { exito: false, mensaje: 'PIN incorrecto.' };
    }

    return {
      exito: true,
      mensaje: 'Autenticación exitosa.',
      usuario: {
        id: usuarioEncontrado.Id,
        nombreCompleto: usuarioEncontrado.NombreCompleto,
        nombreUsuario: usuarioEncontrado.NombreUsuario,
        turno: usuarioEncontrado.Turno
      }
    };
  } catch (error) {
    console.error('Error al validar usuario:', error);
    return { exito: false, mensaje: `Error de autenticación: ${error.message}` };
  }
}

module.exports = {
  validarUsuario
};
