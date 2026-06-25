const { app, BrowserWindow, ipcMain, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require('url');

let ventanaPrincipal;

// Registrar un esquema seguro personalizado para archivos locales
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app-archivo",
    privileges: { bypassCSP: true, secure: true, supportFetchAPI: true },
  },
]);

function crearVentana() {
  // Crear la ventana de Electron con un diseño amplio e interactivo
  ventanaPrincipal = new BrowserWindow({
    width: 1300,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, "precarga.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Captura y Validación de Libros",
    autoHideMenuBar: true,
  });

  // Cargar directamente el index.html local
  ventanaPrincipal.loadFile(path.join(__dirname, "index.html"));

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
      const rutaArchivo = decodeURIComponent(urlLimpia);
      
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentana();
    }
  });
});

// Salir de la aplicación cuando todas las ventanas estén cerradas
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Canales de comunicación IPC (Inter-Process Communication)
ipcMain.handle("obtener-estado-conexion", () => {
  return { conectado: true, mensaje: "Proceso principal activo" };
});

// Canal para leer PDFs reales del directorio local 'pdfs'
ipcMain.handle("obtener-pdfs", () => {
  const rutaCarpetaPdfs = path.join(__dirname, "pdfs");

  try {
    // Crear el directorio si no existe
    if (!fs.existsSync(rutaCarpetaPdfs)) {
      fs.mkdirSync(rutaCarpetaPdfs);
    }

    // Leer los archivos del directorio
    const archivos = fs.readdirSync(rutaCarpetaPdfs);

    // Filtrar solo los archivos PDF
    const archivosPdfs = archivos.filter((archivo) =>
      archivo.toLowerCase().endsWith(".pdf"),
    );

    // Mapear la información relevante de cada PDF
    return archivosPdfs.map((nombre, indice) => {
      const rutaCompleta = path.join(rutaCarpetaPdfs, nombre);
      const metadatos = fs.statSync(rutaCompleta);

      // Proponer valores predeterminados para las reglas de captura (pueden ser extraídos del nombre después)
      let tomoPropueto = "T01";
      let anioPropuesto = "2026";

      // Intentar extraer Tomo y Año si el nombre tiene un formato específico (ej: T01_nombre_2026.pdf)
      const coincidencias = nombre.match(/T(\d+).*?(\d{4})/i);
      if (coincidencias) {
        tomoPropueto = `T${coincidencias[1].padStart(2, "0")}`;
        anioPropuesto = coincidencias[2];
      }

      return {
        id: indice + 1,
        nombre: nombre,
        rutaLocal: rutaCompleta.replace(/\\/g, '/'), // Normalizar barras invertidas de Windows a barras normales
        tamanioBytes: metadatos.size,
        procesado: false,
        tomo: tomoPropueto,
        anio: anioPropuesto,
      };
    });
  } catch (error) {
    console.error("Error al leer la carpeta de PDFs:", error);
    return [];
  }
});
