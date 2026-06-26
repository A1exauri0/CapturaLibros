const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Servicios modulares del sistema
const { validarUsuario } = require('./servicios/autenticacion');
const { obtenerPdfsDeRed, renombrarArchivoPdf } = require('./servicios/gestorArchivos');
const { cortarPaginasPdf, recortarMargenesPagina } = require('./servicios/procesamientoPdf');
const { reportarAuditoria } = require('./servicios/auditoria');

let usuarioActivo = null;

let ventanaPrincipal;

// Registrar un esquema seguro personalizado para archivos locales
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-archivo',
    privileges: { bypassCSP: true, secure: true, supportFetchAPI: true },
  },
]);

function crearVentana() {
  // Crear la ventana de Electron con un diseño compacto para el Login
  ventanaPrincipal = new BrowserWindow({
    width: 440,
    height: 540,
    resizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'precarga.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Captura y Validación de Libros',
    autoHideMenuBar: true
  });

  // Cargar directamente el index.html local
  ventanaPrincipal.loadFile(path.join(__dirname, 'index.html'));

  // Descomentar si se desea depurar el frontend directamente
  // ventanaPrincipal.webContents.openDevTools();
}

// Iniciar la aplicación cuando Electron esté listo
app.whenReady().then(() => {
  // Manejador para el protocolo app-archivo
  protocol.handle('app-archivo', (solicitud) => {
    try {
      // Decodificar la URL del archivo local removiendo el protocolo con tres barras
      const urlLimpia = solicitud.url.replace('app-archivo:///', '');
      
      // Quitar los parámetros de consulta (query params como ?t=...) si existen
      const urlSinQuery = urlLimpia.split('?')[0];
      
      const rutaArchivo = decodeURIComponent(urlSinQuery);
      
      // Convertir la ruta del sistema a un formato file:/// de URL de forma robusta
      const urlArchivoLocal = pathToFileURL(path.resolve(rutaArchivo)).toString();
      
      // Devolver el archivo del sistema
      return net.fetch(urlArchivoLocal);
    } catch (error) {
      console.error('Error al cargar archivo en el protocolo seguro:', error);
      return new Response('Error al cargar el archivo', { status: 500 });
    }
  });

  crearVentana();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentana();
    }
  });
});

// Salir de la aplicación cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Canales de comunicación IPC (Inter-Process Communication)

// 1. Iniciar sesión y validar en red Z
ipcMain.handle('iniciar-sesion', async (evento, datos) => {
  const { usuario, pin } = datos;
  const respuesta = await validarUsuario(usuario, pin);
  if (respuesta.exito) {
    usuarioActivo = {
      id: respuesta.usuario.id,
      NombreUsuario: respuesta.usuario.nombreUsuario,
      NombreCompleto: respuesta.usuario.nombreCompleto,
      Turno: respuesta.usuario.turno
    };
    
    // Maximizar la ventana para la interfaz de trabajo
    if (ventanaPrincipal) {
      ventanaPrincipal.setResizable(true);
      ventanaPrincipal.setMaximizable(true);
      ventanaPrincipal.setMinimumSize(1024, 768);
      ventanaPrincipal.setSize(1300, 850);
      ventanaPrincipal.center();
      ventanaPrincipal.maximize();
    }
  }
  return respuesta;
});

// 2. Cerrar sesión activa
ipcMain.handle('cerrar-sesion', () => {
  usuarioActivo = null;
  
  // Regresar al tamaño de ventana de login
  if (ventanaPrincipal) {
    ventanaPrincipal.setResizable(false);
    ventanaPrincipal.setMaximizable(false);
    ventanaPrincipal.unmaximize();
    ventanaPrincipal.setSize(440, 540);
    ventanaPrincipal.center();
  }
  return { exito: true };
});

// 3. Obtener la lista de PDFs del capturista desde la unidad Z
ipcMain.handle('obtener-pdfs', async () => {
  return await obtenerPdfsDeRed(usuarioActivo);
});

// 4. Renombrar un archivo PDF de forma real en la unidad de red
ipcMain.handle('renombrar-pdf', async (evento, datos) => {
  const { rutaOriginal, nuevoNombre } = datos;
  const respuesta = await renombrarArchivoPdf(rutaOriginal, nuevoNombre);
  if (respuesta.exito && usuarioActivo) {
    try {
      const archivoOriginal = path.basename(rutaOriginal);
      const archivoNuevo = `${nuevoNombre}.pdf`;
      const directorio = path.dirname(rutaOriginal).replace(/\\/g, '/');

      await reportarAuditoria({
        userId: usuarioActivo.id,
        usuario: usuarioActivo.NombreUsuario,
        turno: usuarioActivo.Turno,
        categoria: 'Libros',
        directorio: directorio,
        accion: 'Renombrar',
        archivoOriginal: archivoOriginal,
        archivoNuevo: archivoNuevo,
        detalles: `Archivo renombrado de ${archivoOriginal} a ${archivoNuevo}`,
        paginas: 0
      });
    } catch (errorAuditoria) {
      console.error('Error al registrar la auditoría de renombrado:', errorAuditoria);
    }
  }
  return respuesta;
});

// 5. Cortar/Extraer páginas seleccionadas y crear un nuevo PDF real en red
ipcMain.handle('cortar-paginas-pdf', async (evento, datos) => {
  const { rutaOriginal, paginas, nombreSalida } = datos;
  const respuesta = await cortarPaginasPdf(rutaOriginal, paginas, nombreSalida);
  if (respuesta.exito && usuarioActivo) {
    try {
      const archivoOriginal = path.basename(rutaOriginal);
      const archivoNuevo = `${nombreSalida}.pdf`;
      const directorio = path.dirname(rutaOriginal).replace(/\\/g, '/');

      // Registrar acción: Cortar (indica la hoja o grupo de hojas cortadas del PDF original)
      await reportarAuditoria({
        userId: usuarioActivo.id,
        usuario: usuarioActivo.NombreUsuario,
        turno: usuarioActivo.Turno,
        categoria: 'Libros',
        directorio: directorio,
        accion: 'Cortar',
        archivoOriginal: archivoOriginal,
        archivoNuevo: null,
        detalles: paginas.length === 1 ? `Se cortó la hoja ${paginas[0]}` : `Se cortaron las hojas: ${paginas.join(', ')}`,
        paginas: paginas.length
      });

      // Registrar acción: Crear PDF (indica la creación física del nuevo archivo)
      await reportarAuditoria({
        userId: usuarioActivo.id,
        usuario: usuarioActivo.NombreUsuario,
        turno: usuarioActivo.Turno,
        categoria: 'Libros',
        directorio: directorio,
        accion: 'Crear PDF',
        archivoOriginal: archivoOriginal,
        archivoNuevo: archivoNuevo,
        detalles: `Creación de nuevo PDF: ${archivoNuevo}`,
        paginas: paginas.length
      });
    } catch (errorAuditoria) {
      console.error('Error al registrar la auditoría de corte/creación:', errorAuditoria);
    }
  }
  return respuesta;
});

// 6. Recortar físicamente los márgenes de una página específica en red
ipcMain.handle('recortar-margenes-pdf', async (evento, datos) => {
  const { rutaOriginal, numPagina, x, y, ancho, alto } = datos;
  const respuesta = await recortarMargenesPagina(rutaOriginal, numPagina, x, y, ancho, alto);
  if (respuesta.exito && usuarioActivo) {
    try {
      const archivoOriginal = path.basename(rutaOriginal);
      const directorio = path.dirname(rutaOriginal).replace(/\\/g, '/');

      await reportarAuditoria({
        userId: usuarioActivo.id,
        usuario: usuarioActivo.NombreUsuario,
        turno: usuarioActivo.Turno,
        categoria: 'Libros',
        directorio: directorio,
        accion: 'Recortar',
        archivoOriginal: archivoOriginal,
        archivoNuevo: null,
        detalles: `Recorte de márgenes en página ${numPagina}. Coordenadas: x=${x.toFixed(2)}, y=${y.toFixed(2)}, ancho=${ancho.toFixed(2)}, alto=${alto.toFixed(2)}`,
        paginas: 1
      });
    } catch (errorAuditoria) {
      console.error('Error al registrar la auditoría de recorte:', errorAuditoria);
    }
  }
  return respuesta;
});
