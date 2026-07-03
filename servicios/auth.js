const URL_API_LOGIN = "https://app.astronmx.cloud/api/login";

/**
 * Valida las credenciales de un capturista contra el servidor central de Stellum
 * @param {string} usuario Nombre de usuario
 * @param {string} pin PIN de acceso
 * @returns {Promise<{exito: boolean, mensaje: string, usuario?: object}>}
 */
async function validarUsuario(usuario, pin) {
  try {
    console.log(
      "Enviando petición de login a Stellum para el usuario:",
      usuario,
    );

    const respuestaApi = await fetch(URL_API_LOGIN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username: usuario,
        pin: pin,
      }),
    });

    const datos = await respuestaApi.json();

    if (respuestaApi.ok && datos.success) {
      return {
        exito: true,
        mensaje: "Autenticación exitosa.",
        usuario: {
          id: datos.user.id,
          nombreCompleto: datos.user.name,
          nombreUsuario: datos.user.username,
          turno: datos.user.turno,
        },
      };
    } else {
      return {
        exito: false,
        mensaje: datos.message || "Usuario o PIN incorrectos.",
      };
    }
  } catch (error) {
    console.error("Error al autenticar en la API de Stellum:", error);
    return {
      exito: false,
      mensaje: "Error de comunicación local con el servidor de Stellum.",
    };
  }
}

module.exports = {
  validarUsuario,
};
