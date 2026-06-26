const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

/**
 * Corta/Extrae páginas de un PDF y crea uno nuevo en la misma carpeta
 */
async function cortarPaginasPdf(rutaOriginal, paginas, nombreSalida) {
  try {
    const carpetaSalida = path.dirname(rutaOriginal);
    const rutaDestino = path.join(carpetaSalida, `${nombreSalida}.pdf`).replace(/\\/g, '/');

    if (!paginas || paginas.length === 0) {
      return { exito: false, mensaje: 'No se seleccionaron páginas para cortar.' };
    }

    const bytesOriginal = fs.readFileSync(rutaOriginal);
    const docOriginal = await PDFDocument.load(bytesOriginal);
    const docNuevo = await PDFDocument.create();
    
    const indicesCopiar = paginas.map(p => p - 1);
    const paginasCopiadas = await docNuevo.copyPages(docOriginal, indicesCopiar);
    paginasCopiadas.forEach(p => docNuevo.addPage(p));
    
    const bytesNuevo = await docNuevo.save();
    fs.writeFileSync(rutaDestino, bytesNuevo);
    
    return {
      exito: true,
      mensaje: 'Páginas cortadas y nuevo PDF creado correctamente.',
      rutaDestino
    };
  } catch (error) {
    console.error('Error al cortar páginas:', error);
    return { exito: false, mensaje: `Error al procesar: ${error.message}` };
  }
}

/**
 * Recorta geométricamente los márgenes de una página ajustando CropBox y MediaBox
 */
async function recortarMargenesPagina(rutaOriginal, numPagina, x, y, ancho, alto) {
  try {
    const bytesOriginal = fs.readFileSync(rutaOriginal);
    const docOriginal = await PDFDocument.load(bytesOriginal);
    
    const pagina = docOriginal.getPage(numPagina - 1);
    const { width, height } = pagina.getSize();
    
    const pdfX = (x / 100) * width;
    const pdfWidth = (ancho / 100) * width;
    const pdfHeight = (alto / 100) * height;
    const pdfY = height - ((y / 100) * height) - pdfHeight;
    
    pagina.setCropBox(pdfX, pdfY, pdfWidth, pdfHeight);
    pagina.setMediaBox(pdfX, pdfY, pdfWidth, pdfHeight);
    
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
}

module.exports = {
  cortarPaginasPdf,
  recortarMargenesPagina
};
