const { contextBridge, ipcRenderer } = require('electron');

// Exponer una API segura al contexto del navegador (frontend)
contextBridge.exposeInMainWorld('apiProyecto', {
  verificarConexion: () => ipcRenderer.invoke('obtener-estado-conexion'),
  obtenerPDFs: () => ipcRenderer.invoke('obtener-pdfs'),
  obtenerRutaArchivo: (rutaLocal) => `app-archivo:///${rutaLocal.replace(/\\/g, '/')}`,
  renombrarPDF: (datos) => ipcRenderer.invoke('renombrar-pdf', datos),
  cortarPaginasPDF: (datos) => ipcRenderer.invoke('cortar-paginas-pdf', datos),
  recortarMargenesPDF: (datos) => ipcRenderer.invoke('recortar-margenes-pdf', datos)
});
