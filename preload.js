const { contextBridge, ipcRenderer } = require('electron');

// Exponer una API segura al contexto del navegador (frontend)
contextBridge.exposeInMainWorld('apiProyecto', {
  iniciarSesion: (datos) => ipcRenderer.invoke('iniciar-sesion', datos),
  obtenerPDFs: () => ipcRenderer.invoke('obtener-pdfs'),
  obtenerRutaArchivo: (rutaLocal) => `app-archivo:///${rutaLocal.replace(/\\/g, '/')}`,
  renombrarPDF: (datos) => ipcRenderer.invoke('renombrar-pdf', datos),
  cortarPaginasPDF: (datos) => ipcRenderer.invoke('cortar-paginas-pdf', datos),
  recortarMargenesPDF: (datos) => ipcRenderer.invoke('recortar-margenes-pdf', datos),
  registrarSesion: (datos) => ipcRenderer.invoke('registrar-sesion', datos),
  liberarSesion: () => ipcRenderer.invoke('liberar-sesion')
});
