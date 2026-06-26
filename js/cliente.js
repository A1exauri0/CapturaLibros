// Configurar la ruta del Worker de PDF.js desde CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos del Tema Claro / Oscuro
  const btnTema = document.getElementById('btn-tema');
  const iconoTema = document.getElementById('icono-tema');

  // Elementos de la interfaz de Login
  const seccionLogin = document.getElementById('seccion-login');
  const formularioLogin = document.getElementById('formulario-login');
  const inputUsuario = document.getElementById('input-usuario');
  const inputContrasena = document.getElementById('input-contrasena');
  const errorLogin = document.getElementById('error-login');

  // Elementos de la interfaz de Captura
  const seccionCaptura = document.getElementById('seccion-captura');
  const listaArchivosContenedor = document.getElementById('lista-archivos-contenedor');
  
  // Elementos del Visor de PDF con PDF.js (Vista Individual)
  const visorPlaceholder = document.getElementById('visor-placeholder');
  const visorActivo = document.getElementById('visor-activo');
  const visorTituloDoc = document.getElementById('visor-titulo-doc');
  const canvasPdf = document.getElementById('canvas-pdf');
  const contenedorLienzoPdf = document.getElementById('contenedor-lienzo-pdf');
  const lienzoEnvoltura = document.getElementById('lienzo-envoltura');
  const capaRecorteInteractiva = document.getElementById('capa-recorte-interactiva');
  const btnTrazarRecorte = document.getElementById('btn-trazar-recorte');

  // Pestañas de Alternancia de Modos (Recortar PDF y Crear PDF)
  const pestanaPagina = document.getElementById('pestana-pagina');
  const pestanaMiniaturas = document.getElementById('pestana-miniaturas');
  const visorControlesBarra = document.getElementById('visor-controles-barra');
  const contenedorRejillaMiniaturas = document.getElementById('contenedor-rejilla-miniaturas');
  const rejillaMiniaturasPdf = document.getElementById('rejilla-miniaturas-pdf');

  // Controles de Paginación y Zoom del Visor (Vista Individual)
  const btnAnt = document.getElementById('btn-ant');
  const btnSig = document.getElementById('btn-sig');
  const pagActualTexto = document.getElementById('pag-actual');
  const pagTotalTexto = document.getElementById('pag-total');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const textoZoom = document.getElementById('texto-zoom');
  const btnRotar = document.getElementById('btn-rotar');

  // Elementos del Panel de Control
  const inputNuevoNombre = document.getElementById('input-nuevo-nombre');
  const textoReglaEjemplo = document.getElementById('texto-regla-ejemplo');
  const btnRenombrar = document.getElementById('btn-renombrar');
  const btnRecortar = document.getElementById('btn-recortar');

  // Elementos de Conexión (Omitidos)
  const indicadorConexion = null;
  const textoConexion = null;

  // Estado local de la aplicación
  let archivosPdfs = [];
  let archivoSeleccionado = null;
  
  // Estado local del visor de PDF.js
  let pdfDocumento = null;
  let paginaActiva = 1;
  let zoomActual = 1.0;
  let rotacionActual = 0;
  
  // Modos de Trabajo: 'recortar' (Recorte geométrico) o 'crear' (Selección y extracción de hojas)
  let modoActual = 'recortar';
  
  // Estado local de múltiples páginas seleccionadas para creación de PDF
  const paginasSeleccionadas = new Set();
  let miniaturasCargadasDocId = null;

  // Estado local del dibujo de la caja de recorte
  let herramientaRecorteActiva = false;
  let guiaSuperior = 10;
  let guiaInferior = 90;
  let guiaIzquierda = 10;
  let guiaDerecha = 90;

  let elementoLineaSuperior = null;
  let elementoLineaInferior = null;
  let elementoLineaIzquierda = null;
  let elementoLineaDerecha = null;
  let cajaRecorteElemento = null;

  let lineaArrastrandose = null;

  // ==========================================================================
  // GESTIÓN DE TEMA CLARO / OSCURO (POR DEFECTO MODO CLARO)
  // ==========================================================================
  function aplicarTema(tema) {
    if (tema === 'oscuro') {
      document.body.classList.add('tema-oscuro');
      document.body.classList.remove('tema-claro');
      if (iconoTema) iconoTema.setAttribute('icon', 'mdi:weather-night');
    } else {
      document.body.classList.remove('tema-oscuro');
      document.body.classList.add('tema-claro');
      if (iconoTema) iconoTema.setAttribute('icon', 'mdi:weather-sunny');
    }
  }

  aplicarTema('claro'); // Forzar modo claro al iniciar

  if (btnTema) {
    btnTema.addEventListener('click', () => {
      const esTemaOscuro = document.body.classList.contains('tema-oscuro');
      const nuevoTema = esTemaOscuro ? 'claro' : 'oscuro';
      aplicarTema(nuevoTema);
    });
  }

  // Lógica de conexión local eliminada

  // ==========================================================================
  // OMITIR PANTALLA DE LOGIN (ACCESO DIRECTO)
  // ==========================================================================
  if (seccionLogin && seccionCaptura) {
    seccionLogin.classList.add('oculto');
    seccionCaptura.classList.remove('oculto');
    inicializarCapturaPDFs();
  }

  // ==========================================================================
  // GESTIÓN DE PDFS REALES Y CAPTURA
  // ==========================================================================
  async function inicializarCapturaPDFs() {
    actualizarReglaEjemplo();
    await cargarListaPDFs();
  }

  // Cargar lista de archivos de la carpeta local por IPC
  async function cargarListaPDFs() {
    if (window.apiProyecto && typeof window.apiProyecto.obtenerPDFs === 'function') {
      try {
        archivosPdfs = await window.apiProyecto.obtenerPDFs();
        renderizarListaArchivos();
      } catch (error) {
        console.error('Error al obtener PDFs por IPC:', error);
        listaArchivosContenedor.innerHTML = '<p style="padding: 10px; font-size:12px; color:var(--color-error)">Error al cargar archivos.</p>';
      }
    }
  }

  // Renderizar la barra lateral
  function renderizarListaArchivos() {
    listaArchivosContenedor.innerHTML = '';

    if (archivosPdfs.length === 0) {
      listaArchivosContenedor.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--color-texto-secundario); font-size: 13px;">
          <iconify-icon icon="mdi:folder-alert-outline" style="font-size: 32px; color: var(--color-alerta); margin-bottom: 8px;"></iconify-icon>
          <p>No se encontraron PDFs en la carpeta <b>/pdfs</b> del proyecto.</p>
          <p style="margin-top: 6px; font-size: 11px;">Coloca archivos PDF allí y se listarán aquí.</p>
        </div>
      `;
      return;
    }

    archivosPdfs.forEach(archivo => {
      const elementoItem = document.createElement('div');
      elementoItem.className = `item-archivo ${archivo.procesado ? 'procesado' : ''} ${archivoSeleccionado && archivoSeleccionado.id === archivo.id ? 'activo' : ''}`;
      
      const megabytes = (archivo.tamanioBytes / (1024 * 1024)).toFixed(2);

      elementoItem.innerHTML = `
        <iconify-icon icon="mdi:file-pdf-box" class="icono-archivo-pdf"></iconify-icon>
        <div class="info-doc">
          <h4>${archivo.nombre}</h4>
          <p>${megabytes} MB</p>
        </div>
        <span class="check-doc">
          <iconify-icon icon="mdi:check-circle"></iconify-icon>
        </span>
      `;

      elementoItem.addEventListener('click', () => {
        seleccionarArchivo(archivo);
      });

      listaArchivosContenedor.appendChild(elementoItem);
    });
  }

  function desactivarHerramientaRecorte() {
    herramientaRecorteActiva = false;
    if (btnTrazarRecorte) {
      btnTrazarRecorte.classList.remove('activo');
    }
    if (capaRecorteInteractiva) {
      capaRecorteInteractiva.classList.remove('activa');
    }
    eliminarElementosRecorte();
  }

  // Seleccionar y cargar el PDF
  function seleccionarArchivo(archivo) {
    archivoSeleccionado = archivo;
    
    // Resetear selecciones
    paginasSeleccionadas.clear();
    miniaturasCargadasDocId = null;
    desactivarHerramientaRecorte();

    // Activar modo Recortar por defecto al abrir un PDF
    activarModo('recortar');

    // Marcar como activo en la lista
    renderizarListaArchivos();

    // Mostrar visor y ocultar placeholder
    visorPlaceholder.classList.add('oculto');
    visorActivo.classList.remove('oculto');
    
    // Título
    visorTituloDoc.textContent = archivo.nombre;

    // Reiniciar valores de PDF.js
    pdfDocumento = null;
    paginaActiva = 1;
    zoomActual = 1.0;
    rotacionActual = 0;
    textoZoom.textContent = '100%';

    // Convertir ruta local a URL segura
    if (window.apiProyecto && typeof window.apiProyecto.obtenerRutaArchivo === 'function') {
      const urlSegura = window.apiProyecto.obtenerRutaArchivo(archivo.rutaLocal);
      cargarYRenderizarPDF(urlSegura);
    }
  }

  // ==========================================================================
  // RENDERIZADO CON MOZILLA PDF.JS
  // ==========================================================================
  async function cargarYRenderizarPDF(url) {
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        disableRange: true,
        disableStream: true,
        disableAutoFetch: true
      });
      pdfDocumento = await loadingTask.promise;
      
      // Configurar totales en la barra de controles
      pagTotalTexto.textContent = pdfDocumento.numPages;
      
      // Renderizar primera página
      await renderizarPagina(paginaActiva);
      actualizarEstadoBotonesVisor();
    } catch (error) {
      console.error('Error al cargar documento con PDF.js:', error);
      alert('Error: No se pudo renderizar el PDF local.');
    }
  }

  async function renderizarPagina(numeroPagina) {
    if (!pdfDocumento) return;

    try {
      // Eliminar elementos de recorte antes de repintar la página
      eliminarElementosRecorte();

      const pagina = await pdfDocumento.getPage(numeroPagina);
      const contexto = canvasPdf.getContext('2d');
      
      const viewport = pagina.getViewport({ scale: zoomActual, rotation: rotacionActual });
      
      canvasPdf.width = viewport.width;
      canvasPdf.height = viewport.height;
      
      // Ajustar la capa interactiva al tamaño exacto de la página renderizada
      if (lienzoEnvoltura) {
        lienzoEnvoltura.style.width = `${viewport.width}px`;
        lienzoEnvoltura.style.height = `${viewport.height}px`;
      }
      
      const renderContext = {
        canvasContext: contexto,
        viewport: viewport
      };
      
      await pagina.render(renderContext).promise;
      
      // Actualizar número de página
      pagActualTexto.textContent = numeroPagina;
      
      actualizarEstadoBotonesVisor();
      actualizarNombreSugerido();

      if (herramientaRecorteActiva) {
        inicializarGuiasRecorte();
      }
    } catch (error) {
      console.error('Error al renderizar página:', error);
    }
  }

  function actualizarEstadoBotonesVisor() {
    if (!pdfDocumento) return;
    btnAnt.disabled = (paginaActiva <= 1);
    btnSig.disabled = (paginaActiva >= pdfDocumento.numPages);
  }

  // ==========================================================================
  // GESTIÓN DE MODOS DE TRABAJO (RECORTE GEOMÉTRICO VS CREACIÓN/EXTRACCIÓN)
  // ==========================================================================
  function activarModo(modo) {
    modoActual = modo;
    desactivarHerramientaRecorte();
    
    if (modo === 'recortar') {
      pestanaPagina.classList.add('activa');
      pestanaMiniaturas.classList.remove('activa');
      contenedorLienzoPdf.classList.remove('oculto');
      visorControlesBarra.classList.remove('oculto');
      contenedorRejillaMiniaturas.classList.add('oculto');
      
      // Mostrar caja de recorte si existiera
      mostrarCajaRecorteElemento();
    } else {
      pestanaMiniaturas.classList.add('activa');
      pestanaPagina.classList.remove('activa');
      contenedorLienzoPdf.classList.add('oculto');
      visorControlesBarra.classList.add('oculto');
      contenedorRejillaMiniaturas.classList.remove('oculto');
      
      // Ocultar la caja de recorte al salir
      ocultarCajaRecorteElemento();
      
      // Cargar rejilla
      cargarMiniaturasRejilla();
    }

    actualizarNombreSugerido();
    actualizarBotonesControl();
  }

  pestanaPagina.addEventListener('click', () => activarModo('recortar'));
  pestanaMiniaturas.addEventListener('click', () => activarModo('crear'));

  function mostrarCajaRecorteElemento() {
    const caja = document.querySelector('.caja-recorte-elemento');
    if (caja) caja.style.opacity = '1';
  }

  function ocultarCajaRecorteElemento() {
    const caja = document.querySelector('.caja-recorte-elemento');
    if (caja) caja.style.opacity = '0';
  }

  // Cargar cuadrícula de miniaturas interactiva (Para Crear PDF)
  async function cargarMiniaturasRejilla() {
    if (!pdfDocumento || miniaturasCargadasDocId === archivoSeleccionado.id) return;
    
    rejillaMiniaturasPdf.innerHTML = '';
    
    for (let i = 1; i <= pdfDocumento.numPages; i++) {
      const tarjeta = document.createElement('div');
      tarjeta.className = `tarjeta-miniatura ${paginasSeleccionadas.has(i) ? 'seleccionada' : ''}`;
      tarjeta.dataset.pagina = i;
      
      tarjeta.innerHTML = `
        <div class="checkbox-seleccion">
          <iconify-icon icon="mdi:check"></iconify-icon>
        </div>
        <canvas id="canvas-miniatura-${i}"></canvas>
        <span class="num-pag-miniatura">Pág. ${i}</span>
      `;
      
      rejillaMiniaturasPdf.appendChild(tarjeta);
      renderizarMiniatura(i);

      tarjeta.addEventListener('click', () => {
        toggleSeleccionHoja(i, tarjeta);
      });
    }
    miniaturasCargadasDocId = archivoSeleccionado.id;
  }

  async function renderizarMiniatura(numPag) {
    try {
      const pagina = await pdfDocumento.getPage(numPag);
      const canvas = document.getElementById(`canvas-miniatura-${numPag}`);
      if (!canvas) return;
      const contexto = canvas.getContext('2d');
      
      const viewport = pagina.getViewport({ scale: 0.22 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const renderContext = {
        canvasContext: contexto,
        viewport: viewport
      };
      
      await pagina.render(renderContext).promise;
    } catch (error) {
      console.error(`Error al renderizar miniatura ${numPag}:`, error);
    }
  }

  function toggleSeleccionHoja(numeroPagina, elementoTarjeta) {
    if (paginasSeleccionadas.has(numeroPagina)) {
      paginasSeleccionadas.delete(numeroPagina);
      elementoTarjeta.classList.remove('seleccionada');
    } else {
      paginasSeleccionadas.add(numeroPagina);
      elementoTarjeta.classList.add('seleccionada');
    }

    actualizarNombreSugerido();
    actualizarBotonesControl();
  }

  function actualizarBotonesControl() {
    if (modoActual === 'recortar') {
      btnRecortar.innerHTML = `<iconify-icon icon="mdi:content-cut"></iconify-icon><span>Recortar Hoja</span>`;
      btnRecortar.title = 'Recortar márgenes seleccionados de la hoja actual';
    } else {
      const totalSeleccionadas = paginasSeleccionadas.size;
      btnRecortar.innerHTML = `<iconify-icon icon="mdi:file-multiple-outline"></iconify-icon><span>Crear PDF ${totalSeleccionadas > 0 ? `(${totalSeleccionadas})` : ''}</span>`;
      btnRecortar.title = 'Crear un nuevo PDF con las páginas seleccionadas';
    }
  }

  // ==========================================================================
  // DIBUJO INTERACTIVO DE LA CAJA DE RECORTE (MODO RECORTAR CON GUÍAS ARRASTRABLES)
  // ==========================================================================
  if (btnTrazarRecorte) {
    btnTrazarRecorte.addEventListener('click', () => {
      if (modoActual !== 'recortar') return;
      
      herramientaRecorteActiva = !herramientaRecorteActiva;
      btnTrazarRecorte.classList.toggle('activo', herramientaRecorteActiva);
      capaRecorteInteractiva.classList.toggle('activa', herramientaRecorteActiva);
      
      if (herramientaRecorteActiva) {
        // Inicializar posiciones por defecto
        guiaSuperior = 10;
        guiaInferior = 90;
        guiaIzquierda = 10;
        guiaDerecha = 90;
        inicializarGuiasRecorte();
      } else {
        eliminarElementosRecorte();
      }
    });
  }

  function eliminarElementosRecorte() {
    if (elementoLineaSuperior) elementoLineaSuperior.remove();
    if (elementoLineaInferior) elementoLineaInferior.remove();
    if (elementoLineaIzquierda) elementoLineaIzquierda.remove();
    if (elementoLineaDerecha) elementoLineaDerecha.remove();
    if (cajaRecorteElemento) cajaRecorteElemento.remove();
    
    elementoLineaSuperior = null;
    elementoLineaInferior = null;
    elementoLineaIzquierda = null;
    elementoLineaDerecha = null;
    cajaRecorteElemento = null;
    lineaArrastrandose = null;
  }

  function inicializarGuiasRecorte() {
    eliminarElementosRecorte();
    
    if (!lienzoEnvoltura || !capaRecorteInteractiva) return;
    
    // Crear la caja de recorte (máscara de sombra)
    cajaRecorteElemento = document.createElement('div');
    cajaRecorteElemento.className = 'caja-recorte-elemento';
    
    // Crear líneas arrastrables
    elementoLineaSuperior = document.createElement('div');
    elementoLineaSuperior.className = 'linea-recorte linea-recorte-horizontal linea-superior';
    
    elementoLineaInferior = document.createElement('div');
    elementoLineaInferior.className = 'linea-recorte linea-recorte-horizontal linea-inferior';
    
    elementoLineaIzquierda = document.createElement('div');
    elementoLineaIzquierda.className = 'linea-recorte linea-recorte-vertical linea-izquierda';
    
    elementoLineaDerecha = document.createElement('div');
    elementoLineaDerecha.className = 'linea-recorte linea-recorte-vertical linea-derecha';
    
    // Añadir al contenedor
    lienzoEnvoltura.appendChild(cajaRecorteElemento);
    lienzoEnvoltura.appendChild(elementoLineaSuperior);
    lienzoEnvoltura.appendChild(elementoLineaInferior);
    lienzoEnvoltura.appendChild(elementoLineaIzquierda);
    lienzoEnvoltura.appendChild(elementoLineaDerecha);
    
    // Configurar eventos individuales
    configurarEventosLinea(elementoLineaSuperior, 'superior');
    configurarEventosLinea(elementoLineaInferior, 'inferior');
    configurarEventosLinea(elementoLineaIzquierda, 'izquierda');
    configurarEventosLinea(elementoLineaDerecha, 'derecha');
    
    actualizarPosicionesGuias();
  }

  function configurarEventosLinea(elemento, tipo) {
    elemento.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      lineaArrastrandose = tipo;
      elemento.classList.add('arrastrando');
    });
  }

  function actualizarPosicionesGuias() {
    if (!cajaRecorteElemento || !canvasPdf) return;
    
    const ancho = canvasPdf.offsetWidth;
    const alto = canvasPdf.offsetHeight;
    
    const ySuperior = (guiaSuperior / 100) * alto;
    const yInferior = (guiaInferior / 100) * alto;
    const xIzquierda = (guiaIzquierda / 100) * ancho;
    const xDerecha = (guiaDerecha / 100) * ancho;
    
    if (elementoLineaSuperior) elementoLineaSuperior.style.top = `${ySuperior}px`;
    if (elementoLineaInferior) elementoLineaInferior.style.top = `${yInferior}px`;
    if (elementoLineaIzquierda) elementoLineaIzquierda.style.left = `${xIzquierda}px`;
    if (elementoLineaDerecha) elementoLineaDerecha.style.left = `${xDerecha}px`;
    
    if (cajaRecorteElemento) {
      cajaRecorteElemento.style.left = `${xIzquierda}px`;
      cajaRecorteElemento.style.top = `${ySuperior}px`;
      cajaRecorteElemento.style.width = `${xDerecha - xIzquierda}px`;
      cajaRecorteElemento.style.height = `${yInferior - ySuperior}px`;
    }
  }

  // Capturar movimientos en la ventana para evitar perder el arrastre rápido
  window.addEventListener('mousemove', (e) => {
    if (!lineaArrastrandose || !capaRecorteInteractiva || !canvasPdf) return;
    
    const rectCapa = capaRecorteInteractiva.getBoundingClientRect();
    const actualX = Math.max(0, Math.min(e.clientX - rectCapa.left, rectCapa.width));
    const actualY = Math.max(0, Math.min(e.clientY - rectCapa.top, rectCapa.height));
    
    const porcentajeX = (actualX / rectCapa.width) * 100;
    const porcentajeY = (actualY / rectCapa.height) * 100;
    
    // Distancia mínima del 5% entre guías
    if (lineaArrastrandose === 'superior') {
      guiaSuperior = Math.max(0, Math.min(porcentajeY, guiaInferior - 5));
    } else if (lineaArrastrandose === 'inferior') {
      guiaInferior = Math.max(guiaSuperior + 5, Math.min(porcentajeY, 100));
    } else if (lineaArrastrandose === 'izquierda') {
      guiaIzquierda = Math.max(0, Math.min(porcentajeX, guiaDerecha - 5));
    } else if (lineaArrastrandose === 'derecha') {
      guiaDerecha = Math.max(guiaIzquierda + 5, Math.min(porcentajeX, 100));
    }
    
    actualizarPosicionesGuias();
  });

  window.addEventListener('mouseup', () => {
    if (lineaArrastrandose) {
      const elemento = document.querySelector(`.linea-recorte.arrastrando`);
      if (elemento) elemento.classList.remove('arrastrando');
      lineaArrastrandose = null;
    }
  });

  function desactivarHerramientaRecorte() {
    herramientaRecorteActiva = false;
    if (btnTrazarRecorte) btnTrazarRecorte.classList.remove('activo');
    if (capaRecorteInteractiva) capaRecorteInteractiva.classList.remove('activa');
    eliminarElementosRecorte();
  }

  // ==========================================================================
  // CONTROLES DE NAVEGACIÓN INDIVIDUAL
  // ==========================================================================
  btnAnt.addEventListener('click', async () => {
    if (paginaActiva > 1) {
      paginaActiva--;
      await renderizarPagina(paginaActiva);
    }
  });

  btnSig.addEventListener('click', async () => {
    if (pdfDocumento && paginaActiva < pdfDocumento.numPages) {
      paginaActiva++;
      await renderizarPagina(paginaActiva);
    }
  });

  btnZoomIn.addEventListener('click', async () => {
    if (zoomActual < 2.5) {
      zoomActual += 0.25;
      textoZoom.textContent = `${Math.round(zoomActual * 100)}%`;
      await renderizarPagina(paginaActiva);
    }
  });

  btnZoomOut.addEventListener('click', async () => {
    if (zoomActual > 0.5) {
      zoomActual -= 0.25;
      textoZoom.textContent = `${Math.round(zoomActual * 100)}%`;
      await renderizarPagina(paginaActiva);
    }
  });

  btnRotar.addEventListener('click', async () => {
    rotacionActual = (rotacionActual + 90) % 360;
    await renderizarPagina(paginaActiva);
  });

  // ==========================================================================
  // LÓGICA DE CONTROL Y NOMBRADO
  // ==========================================================================
  function actualizarReglaEjemplo() {
    textoReglaEjemplo.innerHTML = `
      Regla de Renombrado activa:
      <code>[TOMO]_[PAGINA_INICIAL]-[PAGINA_FINAL]_[ANIO]</code>
      <br>Ejemplo sugerido:
      <code>T01_001-010_2026.pdf</code>
    `;
  }

  function agruparPaginas(paginasArray) {
    if (paginasArray.length === 0) return '';
    
    const rangos = [];
    let inicio = paginasArray[0];
    let anterior = paginasArray[0];
    
    for (let i = 1; i <= paginasArray.length; i++) {
      if (i < paginasArray.length && paginasArray[i] === anterior + 1) {
        anterior = paginasArray[i];
      } else {
        const strInicio = String(inicio).padStart(3, '0');
        const strAnterior = String(anterior).padStart(3, '0');
        
        if (inicio === anterior) {
          rangos.push(strInicio);
        } else {
          rangos.push(`${strInicio}-${strAnterior}`);
        }
        
        if (i < paginasArray.length) {
          inicio = paginasArray[i];
          anterior = paginasArray[i];
        }
      }
    }
    return rangos.join(',');
  }

  function actualizarNombreSugerido() {
    if (!archivoSeleccionado) return;
    
    let rangoHojas = '';
    if (modoActual === 'crear' && paginasSeleccionadas.size > 0) {
      const paginasOrdenadas = Array.from(paginasSeleccionadas).sort((a, b) => a - b);
      rangoHojas = agruparPaginas(paginasOrdenadas);
    } else {
      const paginaFormateada = String(paginaActiva).padStart(3, '0');
      rangoHojas = `${paginaFormateada}-${paginaFormateada}`;
    }
    
    inputNuevoNombre.value = `${archivoSeleccionado.tomo}_${rangoHojas}_${archivoSeleccionado.anio}`;
  }

  // ==========================================================================
  // EJECUCIÓN REAL DE PROCESAMIENTO POR IPC (Renombrar y Cortar)
  // ==========================================================================
  
  // Renombrar PDF
  btnRenombrar.addEventListener('click', async () => {
    if (!archivoSeleccionado) {
      alert('Selecciona un archivo PDF de la lista.');
      return;
    }

    const nuevoNombre = inputNuevoNombre.value.trim();
    if (!nuevoNombre) {
      alert('Ingresa un nuevo nombre para el archivo.');
      return;
    }

    if (window.apiProyecto && typeof window.apiProyecto.renombrarPDF === 'function') {
      try {
        btnRenombrar.disabled = true;
        const respuesta = await window.apiProyecto.renombrarPDF({
          rutaOriginal: archivoSeleccionado.rutaLocal,
          nuevoNombre: nuevoNombre
        });
        
        btnRenombrar.disabled = false;
        
        if (respuesta.exito) {
          alert('¡Archivo renombrado con éxito!');
          visorPlaceholder.classList.remove('oculto');
          visorActivo.classList.add('oculto');
          archivoSeleccionado = null;
          pdfDocumento = null;
          paginasSeleccionadas.clear();
          actualizarBotonesControl();
          
          await cargarListaPDFs();
        } else {
          alert(`Error al renombrar: ${respuesta.mensaje}`);
        }
      } catch (error) {
        btnRenombrar.disabled = false;
        console.error('Error al renombrar:', error);
        alert('Ocurrió un error inesperado al renombrar.');
      }
    }
  });

  // Botón Principal de Procesamiento (Corta geométricamente o extrae hojas según el modo)
  btnRecortar.addEventListener('click', async () => {
    if (!archivoSeleccionado) {
      alert('Selecciona un archivo PDF de la lista.');
      return;
    }

    const nuevoNombre = inputNuevoNombre.value.trim();
    if (!nuevoNombre) {
      alert('Por favor, ingresa el nombre final del archivo de salida.');
      return;
    }

    // MODO 1: RECORTAR MÁRGENES DE LA HOJA ACTUAL (Guardado físico real en disco)
    if (modoActual === 'recortar') {
      if (herramientaRecorteActiva && cajaRecorteElemento) {
        const anchoProporcional = guiaDerecha - guiaIzquierda;
        const altoProporcional = guiaInferior - guiaSuperior;
        const xProporcional = guiaIzquierda;
        const yProporcional = guiaSuperior;

        const confirmar = confirm(`¿Estás seguro de que deseas recortar los márgenes de la página ${paginaActiva} y guardar el resultado directamente en el PDF original?\n\nEsta acción modificará físicamente el archivo.`);
        if (!confirmar) return;

        if (window.apiProyecto && typeof window.apiProyecto.recortarMargenesPDF === 'function') {
          try {
            btnRecortar.disabled = true;
            btnRecortar.textContent = 'Recortando...';

            const respuesta = await window.apiProyecto.recortarMargenesPDF({
              rutaOriginal: archivoSeleccionado.rutaLocal,
              numPagina: paginaActiva,
              x: xProporcional,
              y: yProporcional,
              ancho: anchoProporcional,
              alto: altoProporcional
            });

            btnRecortar.disabled = false;
            actualizarBotonesControl();

            if (respuesta.exito) {
              alert('¡Página recortada correctamente y guardada en el PDF original!');
              
              // Desactivar herramienta de recorte y limpiar guías
              desactivarHerramientaRecorte();

              // Recargar PDF con cache-buster para forzar a PDF.js a leer el archivo modificado
              const urlSegura = window.apiProyecto.obtenerRutaArchivo(archivoSeleccionado.rutaLocal);
              const urlConCacheBuster = `${urlSegura}?t=${Date.now()}`;
              
              await cargarYRenderizarPDF(urlConCacheBuster);
              await cargarListaPDFs();
            } else {
              alert(`Error al recortar los márgenes: ${respuesta.mensaje}`);
            }
          } catch (error) {
            btnRecortar.disabled = false;
            actualizarBotonesControl();
            console.error('Error al recortar márgenes:', error);
            alert('Ocurrió un error inesperado al recortar.');
          }
        }
      } else {
        alert('Activa la herramienta de recorte en el visor y ajusta las líneas guías para recortar.');
      }
      return;
    }

    // MODO 2: CREACIÓN/EXTRACCIÓN DE PDF REAL A PARTIR DE PÁGINAS SELECCIONADAS
    // Si no seleccionaron ninguna miniatura en el mosaico, preguntamos si quieren extraer solo la página que estaban viendo
    const paginasACortar = paginasSeleccionadas.size > 0
      ? Array.from(paginasSeleccionadas).sort((a, b) => a - b)
      : [paginaActiva];

    if (paginasSeleccionadas.size === 0) {
      const confirmar = confirm(`No has seleccionado ninguna página en la rejilla de miniaturas.\n¿Deseas crear el PDF usando únicamente la página activa actual (Pág. ${paginaActiva})?`);
      if (!confirmar) return;
    }

    if (window.apiProyecto && typeof window.apiProyecto.cortarPaginasPDF === 'function') {
      try {
        btnRecortar.disabled = true;
        btnRecortar.textContent = 'Procesando...';

        const respuesta = await window.apiProyecto.cortarPaginasPDF({
          rutaOriginal: archivoSeleccionado.rutaLocal,
          paginas: paginasACortar,
          nombreSalida: nuevoNombre
        });

        btnRecortar.disabled = false;
        actualizarBotonesControl();

        if (respuesta.exito) {
          alert('¡Nuevo archivo PDF creado de forma física en disco con las páginas seleccionadas!');
          
          // Limpiar selecciones
          paginasSeleccionadas.clear();
          actualizarBotonesControl();

          // Refrescar cuadrícula
          document.querySelectorAll('.tarjeta-miniatura').forEach(t => t.classList.remove('seleccionada'));

          // Recargar cola de archivos
          await cargarListaPDFs();
        } else {
          alert(`Error al recortar el PDF: ${respuesta.mensaje}`);
        }
      } catch (error) {
        btnRecortar.disabled = false;
        actualizarBotonesControl();
        console.error('Error al cortar:', error);
        alert('Ocurrió un error inesperado al recortar.');
      }
    }
  });
});
