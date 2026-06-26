const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { PDFDocument } = require('pdf-lib'); // Librería de procesamiento de PDFs

let ventanaPrincipal;

// Registrar un esquema seguro personalizado para archivos locales
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-archivo',
    privileges: { bypassCSP: true, secure: true, supportFetchAPI: true },
  },
]);

function crearVentana() {
  // Crear la ventana de Electron con un diseño amplio e interactivo
  ventanaPrincipal = new BrowserWindow({
    width: 1300,
    height: 850,
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

  // Maximizar la ventana en el arranque (Pantalla Completa de trabajo)
  ventanaPrincipal.maximize();

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

// 1. Estado de Conexión
ipcMain.handle('obtener-estado-conexion', () => {
  return { conectado: true, mensaje: 'Proceso principal activo' };
});

// 2. Obtener la lista de PDFs de la carpeta local 'pdfs'
ipcMain.handle('obtener-pdfs', () => {
  const rutaCarpetaPdfs = path.join(__dirname, 'pdfs');
  
  try {
    if (!fs.existsSync(rutaCarpetaPdfs)) {
      fs.mkdirSync(rutaCarpetaPdfs);
    }
    
    const archivos = fs.readdirSync(rutaCarpetaPdfs);
    const archivosPdfs = archivos.filter(archivo => archivo.toLowerCase().endsWith('.pdf'));
    
    return archivosPdfs.map((nombre, indice) => {
      const rutaCompleta = path.join(rutaCarpetaPdfs, nombre);
      const metadatos = fs.statSync(rutaCompleta);
      
      let tomoPropueto = 'T01';
      let anioPropuesto = '2026';
      
      const coincidencias = nombre.match(/T(\d+).*?(\d{4})/i);
      if (coincidencias) {
        tomoPropueto = `T${coincidencias[1].padStart(2, '0')}`;
        anioPropuesto = coincidencias[2];
      }

      return {
        id: indice + 1,
        nombre: nombre,
        rutaLocal: rutaCompleta.replace(/\\/g, '/'), // Normalizar barras en Windows
        tamanioBytes: metadatos.size,
        procesado: false,
        tomo: tomoPropueto,
        anio: anioPropuesto
      };
    });
  } catch (error) {
    console.error('Error al leer la carpeta de PDFs:', error);
    return [];
  }
});

// 3. Renombrar un archivo PDF de forma real en disco
ipcMain.handle('renombrar-pdf', async (evento, datos) => {
  const { rutaOriginal, nuevoNombre } = datos;
  const carpeta = path.dirname(rutaOriginal);
  const rutaDestino = path.join(carpeta, `${nuevoNombre}.pdf`).replace(/\\/g, '/');
  
  try {
    if (fs.existsSync(rutaDestino)) {
      return { exito: false, mensaje: 'Ya existe un archivo con ese nombre.' };
    }
    fs.renameSync(rutaOriginal, rutaDestino);
    return { exito: true, mensaje: 'Archivo renombrado con éxito.', rutaDestino };
  } catch (error) {
    console.error('Error al renombrar el archivo:', error);
    return { exito: false, mensaje: `Error al renombrar: ${error.message}` };
  }
});

// 4. Cortar/Extraer páginas seleccionadas y crear un nuevo PDF real en disco
ipcMain.handle('cortar-paginas-pdf', async (evento, datos) => {
  const { rutaOriginal, paginas, nombreSalida } = datos;
  const carpetaSalida = path.dirname(rutaOriginal);
  const rutaDestino = path.join(carpetaSalida, `${nombreSalida}.pdf`).replace(/\\/g, '/');
  
  try {
    // Validar que se seleccionaron páginas
    if (!paginas || paginas.length === 0) {
      return { exito: false, mensaje: 'No se seleccionaron páginas para cortar.' };
    }

    // Leer el documento original
    const bytesOriginal = fs.readFileSync(rutaOriginal);
    const docOriginal = await PDFDocument.load(bytesOriginal);
    
    // Crear un nuevo documento PDF
    const docNuevo = await PDFDocument.create();
    
    // Convertir páginas (1-based) a índices basados en 0
    const indicesCopiar = paginas.map(p => p - 1);
    
    // Copiar páginas e insertarlas en el nuevo documento
    const paginasCopiadas = await docNuevo.copyPages(docOriginal, indicesCopiar);
    paginasCopiadas.forEach(p => docNuevo.addPage(p));
    
    // Guardar los bytes del nuevo PDF
    const bytesNuevo = await docNuevo.save();
    
    // Escribir en el disco duro
    fs.writeFileSync(rutaDestino, bytesNuevo);
    
    return {
      exito: true,
      mensaje: 'Páginas recortadas y nuevo PDF creado correctamente.',
      rutaDestino: rutaDestino
    };
  } catch (error) {
    console.error('Error al recortar páginas del PDF:', error);
    return { exito: false, mensaje: `Error al procesar: ${error.message}` };
  }
});

// 5. Recortar físicamente los márgenes de una página específica de un PDF
ipcMain.handle('recortar-margenes-pdf', async (evento, datos) => {
  const { rutaOriginal, numPagina, x, y, ancho, alto } = datos;
  
  try {
    // Leer el PDF original
    const bytesOriginal = fs.readFileSync(rutaOriginal);
    const docOriginal = await PDFDocument.load(bytesOriginal);
    
    // Obtener la página específica (0-indexed en pdf-lib)
    const pagina = docOriginal.getPage(numPagina - 1);
    
    // Obtener dimensiones reales del PDF en puntos
    const { width, height } = pagina.getSize();
    
    // Calcular coordenadas del PDF (eje Y invertido)
    const pdfX = (x / 100) * width;
    const pdfWidth = (ancho / 100) * width;
    const pdfHeight = (alto / 100) * height;
    const pdfY = height - ((y / 100) * height) - pdfHeight;
    
    // Aplicar el recorte geométrico físico ajustando CropBox y MediaBox
    pagina.setCropBox(pdfX, pdfY, pdfWidth, pdfHeight);
    pagina.setMediaBox(pdfX, pdfY, pdfWidth, pdfHeight);
    
    // Guardar los bytes modificados (sobreescribiendo el mismo archivo)
    const bytesModificados = await docOriginal.save();
    fs.writeFileSync(rutaOriginal, bytesModificados);
    
    return {
      exito: true,
      mensaje: `Márgenes de la página ${numPagina} recortados y guardados con éxito en el archivo.`
    };
  } catch (error) {
    console.error('Error al aplicar recorte geométrico de márgenes:', error);
    return { exito: false, mensaje: `Error al recortar márgenes: ${error.message}` };
  }
});
