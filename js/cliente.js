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
  const listaArchivosContenedor = null; // Removido del DOM
  
  // Elementos del Visor de PDF con PDF.js (Vista Individual)
  const visorPlaceholder = document.getElementById('visor-placeholder');
  const visorActivo = document.getElementById('visor-activo');
  const visorTituloDoc = document.getElementById('visor-titulo-doc');
  const canvasPdf = document.getElementById('canvas-pdf');
  const contenedorLienzoPdf = document.getElementById('contenedor-lienzo-pdf');
  const lienzoEnvoltura = document.getElementById('lienzo-envoltura');
  const capaRecorteInteractiva = document.getElementById('capa-recorte-interactiva');
  const btnTrazarRecorte = null; // Integrado a la izquierda
  const cargadorVisor = document.getElementById('cargador-visor');
 
  // Botones del Menú Lateral Unificado
  const btnMenuRenombrar = document.getElementById('btn-menu-renombrar');
  const btnMenuRecortar = document.getElementById('btn-menu-recortar');
  const btnMenuCortar = document.getElementById('btn-menu-cortar');
  const cajaReglaDesplegable = document.getElementById('caja-regla-desplegable');

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
  const btnRenombrar = null; // Reemplazado por btnMenuRenombrar
  const btnRecortar = null;  // Reemplazado por btnMenuRecortar

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
  // INICIO DE SESIÓN REAL CON RED LOCAL
  // ==========================================================================
  if (formularioLogin) {
    formularioLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const usuarioVal = inputUsuario.value.trim();
      const contrasenaVal = inputContrasena.value.trim();

      if (!usuarioVal || !contrasenaVal) {
        errorLogin.textContent = 'Por favor, ingresa el usuario y el PIN.';
        return;
      }

      if (window.apiProyecto && typeof window.apiProyecto.iniciarSesion === 'function') {
        try {
          errorLogin.textContent = '';
          const botonSubmit = formularioLogin.querySelector('button[type="submit"]');
          botonSubmit.disabled = true;
          const textoOriginalBtn = botonSubmit.innerHTML;
          botonSubmit.innerHTML = `<span>Validando...</span>`;

          const respuesta = await window.apiProyecto.iniciarSesion({
            usuario: usuarioVal,
            pin: contrasenaVal
          });

          botonSubmit.disabled = false;
          botonSubmit.innerHTML = textoOriginalBtn;

          if (respuesta.exito) {
            console.log('Autenticación correcta:', respuesta.usuario);
            
            // Quitar clase de login para mostrar interfaz completa
            document.body.classList.remove('en-login');
            
            // Ocultar login y mostrar panel de captura
            seccionLogin.classList.add('oculto');
            seccionCaptura.classList.remove('oculto');
            
            // Inicializar la carga de PDFs reales
            inicializarCapturaPDFs();
          } else {
            errorLogin.textContent = respuesta.mensaje;
          }
        } catch (err) {
          console.error('Error al iniciar sesión:', err);
          errorLogin.textContent = 'Error de comunicación local con el servidor.';
          formularioLogin.querySelector('button[type="submit"]').disabled = false;
        }
      } else {
        errorLogin.textContent = 'Error: API del proyecto no disponible.';
      }
    });
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
        // Mostrar cargador en el visor mientras escanea la red
        if (cargadorVisor) {
          cargadorVisor.classList.remove('oculto');
          const textoCarga = document.getElementById('cargador-visor-texto');
          if (textoCarga) textoCarga.textContent = 'Buscando libros en la red...';
        }
        
        archivosPdfs = await window.apiProyecto.obtenerPDFs();
        
        // Ocultar cargador de búsqueda
        if (cargadorVisor) {
          cargadorVisor.classList.add('oculto');
        }

        // Buscar el primer PDF no procesado en el lote de red
        const pdfNoProcesado = archivosPdfs.find(archivo => !archivo.procesado);
        if (pdfNoProcesado) {
          seleccionarArchivo(pdfNoProcesado);
        } else {
          limpiarVisorYMostrarPlaceholder();
        }
      } catch (error) {
        console.error('Error al obtener PDFs por IPC:', error);
        if (cargadorVisor) {
          cargadorVisor.classList.add('oculto');
        }
        alert('Error de red al consultar la carpeta de PDFs.');
      }
    }
  }

  // Limpiar el visor y mostrar un estado completado cuando no queden PDFs
  function limpiarVisorYMostrarPlaceholder() {
    archivoSeleccionado = null;
    pdfDocumento = null;
    paginaActiva = 1;
    paginasSeleccionadas.clear();
    desactivarHerramientaRecorte();

    // Mostrar placeholder y ocultar visor activo
    if (visorPlaceholder) {
      visorPlaceholder.classList.remove('oculto');
      const placeholderTitulo = visorPlaceholder.querySelector('h3');
      const placeholderTexto = visorPlaceholder.querySelector('p');
      if (placeholderTitulo && placeholderTexto) {
        placeholderTitulo.textContent = '¡Todos los PDFs procesados!';
        placeholderTexto.textContent = 'No quedan más libros PDF pendientes de procesar en la red local.';
      }
    }
    if (visorActivo) {
      visorActivo.classList.add('oculto');
    }
    
    // Limpiar input de nombre
    if (inputNuevoNombre) {
      inputNuevoNombre.value = '';
    }

    actualizarMenuLateral();
  }

  function desactivarHerramientaRecorte() {
    herramientaRecorteActiva = false;
    if (capaRecorteInteractiva) {
      capaRecorteInteractiva.classList.remove('activa');
    }
    eliminarElementosRecorte();
    actualizarMenuLateral();
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
      // Mostrar el cargador de visor
      if (cargadorVisor) {
        cargadorVisor.classList.remove('oculto');
      }
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
      if (cargadorVisor) cargadorVisor.classList.add('oculto');
      console.error('Error al cargar documento con PDF.js:', error);
      alert('Error: No se pudo renderizar el PDF local.');
    }
  }

  async function renderizarPagina(numeroPagina) {
    if (!pdfDocumento) return;

    try {
      // Mostrar el cargador
      if (cargadorVisor) {
        cargadorVisor.classList.remove('oculto');
      }
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

      // Ocultar el cargador al finalizar el render
      if (cargadorVisor) {
        cargadorVisor.classList.add('oculto');
      }
    } catch (error) {
      if (cargadorVisor) {
        cargadorVisor.classList.add('oculto');
      }
      console.error('Error al renderizar página:', error);
    }
  }

  function actualizarEstadoBotonesVisor() {
    if (!pdfDocumento) return;
    btnAnt.disabled = (paginaActiva <= 1);
    btnSig.disabled = (paginaActiva >= pdfDocumento.numPages);
  }

  // ==========================================================================
  // GESTIÓN DE MODOS DE TRABAJO Y MENÚ LATERAL IZQUIERDO UNIFICADO
  // ==========================================================================
  function actualizarMenuLateral() {
    if (!archivoSeleccionado) {
      if (btnMenuRenombrar) btnMenuRenombrar.disabled = true;
      if (btnMenuRecortar) btnMenuRecortar.disabled = true;
      if (btnMenuCortar) btnMenuCortar.disabled = true;
      
      if (btnMenuRenombrar) btnMenuRenombrar.classList.remove('activo', 'ejecutar');
      if (btnMenuRecortar) btnMenuRecortar.classList.remove('activo', 'ejecutar');
      if (btnMenuCortar) btnMenuCortar.classList.remove('activo', 'ejecutar');
      
      if (btnMenuRecortar) btnMenuRecortar.querySelector('span').textContent = 'Recortar';
      if (btnMenuCortar) btnMenuCortar.querySelector('span').textContent = 'Cortar PDF';
      return;
    }

    if (btnMenuRenombrar) btnMenuRenombrar.disabled = false;
    if (btnMenuRecortar) btnMenuRecortar.disabled = false;
    if (btnMenuCortar) btnMenuCortar.disabled = false;

    // 1. Botón Renombrar (Acción directa siempre)
    if (btnMenuRenombrar) btnMenuRenombrar.classList.remove('activo', 'ejecutar');

    // 2. Botón Recortar
    if (btnMenuRecortar) {
      if (modoActual === 'recortar') {
        btnMenuRecortar.classList.add('activo');
        if (herramientaRecorteActiva) {
          btnMenuRecortar.classList.add('ejecutar');
          btnMenuRecortar.querySelector('span').textContent = 'Aplicar Recorte';
        } else {
          btnMenuRecortar.classList.remove('ejecutar');
          btnMenuRecortar.querySelector('span').textContent = 'Iniciar Recorte';
        }
      } else {
        btnMenuRecortar.classList.remove('activo', 'ejecutar');
        btnMenuRecortar.querySelector('span').textContent = 'Recortar';
      }
    }

    // 3. Botón Cortar
    if (btnMenuCortar) {
      if (modoActual === 'crear') {
        btnMenuCortar.classList.add('activo');
        const totalSeleccionadas = paginasSeleccionadas.size;
        if (totalSeleccionadas > 0) {
          btnMenuCortar.classList.add('ejecutar');
          btnMenuCortar.querySelector('span').textContent = `Crear PDF (${totalSeleccionadas})`;
        } else {
          btnMenuCortar.classList.remove('ejecutar');
          btnMenuCortar.querySelector('span').textContent = 'Seleccionar Hojas';
        }
      } else {
        btnMenuCortar.classList.remove('activo', 'ejecutar');
        btnMenuCortar.querySelector('span').textContent = 'Cortar PDF';
      }
    }
  }



  function activarModo(modo) {
    modoActual = modo;
    desactivarHerramientaRecorte();
    
    if (modo === 'recortar') {
      contenedorLienzoPdf.classList.remove('oculto');
      visorControlesBarra.classList.remove('oculto');
      contenedorRejillaMiniaturas.classList.add('oculto');
      
      // Mostrar caja de recorte si existiera
      mostrarCajaRecorteElemento();
    } else {
      contenedorLienzoPdf.classList.add('oculto');
      visorControlesBarra.classList.add('oculto');
      contenedorRejillaMiniaturas.classList.remove('oculto');
      
      // Ocultar la caja de recorte al salir
      ocultarCajaRecorteElemento();
      
      // Cargar rejilla
      cargarMiniaturasRejilla();
    }

    actualizarNombreSugerido();
    actualizarMenuLateral();
  }

  // Listeners de los botones del menú lateral para alternar modos e iniciar/confirmar acciones
  if (btnMenuRecortar) {
    btnMenuRecortar.addEventListener('click', () => {
      if (!archivoSeleccionado) return;

      if (modoActual !== 'recortar') {
        activarModo('recortar');
        // Activar guías automáticamente al entrar
        alternarHerramientaRecorte(true);
      } else {
        // Si ya está en modo recortar, alternar la herramienta o ejecutar la confirmación si las guías están activas
        if (!herramientaRecorteActiva) {
          alternarHerramientaRecorte(true);
        } else {
          // Ejecutar el recorte
          ejecutarRecorteGeometrico();
        }
      }
    });
  }

  if (btnMenuCortar) {
    btnMenuCortar.addEventListener('click', () => {
      if (!archivoSeleccionado) return;

      if (modoActual !== 'crear') {
        activarModo('crear');
      } else {
        // Si ya está en modo crear y hay páginas seleccionadas, proceder con la acción
        if (paginasSeleccionadas.size > 0) {
          ejecutarCreacionPdf();
        } else {
          alert('Por favor, selecciona al menos una hoja de la cuadrícula de miniaturas para crear el nuevo PDF.');
        }
      }
    });
  }

  function alternarHerramientaRecorte(forzarEstado) {
    if (modoActual !== 'recortar') return;
    
    if (typeof forzarEstado === 'boolean') {
      herramientaRecorteActiva = forzarEstado;
    } else {
      herramientaRecorteActiva = !herramientaRecorteActiva;
    }
    
    if (capaRecorteInteractiva) {
      capaRecorteInteractiva.classList.toggle('activa', herramientaRecorteActiva);
    }
    
    if (herramientaRecorteActiva) {
      // Posiciones de inicio por defecto
      guiaSuperior = 10;
      guiaInferior = 90;
      guiaIzquierda = 10;
      guiaDerecha = 90;
      inicializarGuiasRecorte();
    } else {
      eliminarElementosRecorte();
    }
    actualizarMenuLateral();
  }

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
    actualizarMenuLateral();
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

  async function aplicarZoomIn() {
    if (zoomActual < 3.0) {
      zoomActual = parseFloat((zoomActual + 0.15).toFixed(2));
      textoZoom.textContent = `${Math.round(zoomActual * 100)}%`;
      await renderizarPagina(paginaActiva);
    }
  }

  async function aplicarZoomOut() {
    if (zoomActual > 0.4) {
      zoomActual = parseFloat((zoomActual - 0.15).toFixed(2));
      textoZoom.textContent = `${Math.round(zoomActual * 100)}%`;
      await renderizarPagina(paginaActiva);
    }
  }

  btnZoomIn.addEventListener('click', async () => {
    if (zoomActual < 3.0) {
      zoomActual = parseFloat((zoomActual + 0.25).toFixed(2));
      textoZoom.textContent = `${Math.round(zoomActual * 100)}%`;
      await renderizarPagina(paginaActiva);
    }
  });

  btnZoomOut.addEventListener('click', async () => {
    if (zoomActual > 0.4) {
      zoomActual = parseFloat((zoomActual - 0.25).toFixed(2));
      textoZoom.textContent = `${Math.round(zoomActual * 100)}%`;
      await renderizarPagina(paginaActiva);
    }
  });

  // Vincular eventos de scroll con la tecla Control para el zoom interactivo
  if (contenedorLienzoPdf) {
    contenedorLienzoPdf.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          aplicarZoomIn();
        } else {
          aplicarZoomOut();
        }
      }
    }, { passive: false });
  }

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
      <code>Solo números (hasta 5 dígitos)</code>
      <br>Ejemplo sugerido:
      <code>12345</code> o <code>00123</code>
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
    
    let numeroSugerido = paginaActiva;
    if (modoActual === 'crear' && paginasSeleccionadas.size > 0) {
      const paginasOrdenadas = Array.from(paginasSeleccionadas).sort((a, b) => a - b);
      numeroSugerido = paginasOrdenadas[0];
    }
    
    // Sugerir la página actual formateada a 5 dígitos (solo números)
    inputNuevoNombre.value = String(numeroSugerido).padStart(5, '0');
  }

  // ==========================================================================
  // EJECUCIÓN REAL DE PROCESAMIENTO POR IPC (Renombrar y Cortar)
  // ==========================================================================
  
  // ==========================================================================
  // EJECUCIÓN REAL DE PROCESAMIENTO POR IPC (Renombrar, Recortar y Cortar)
  // ==========================================================================
  
  // 1. Ejecutar Renombrado
  async function ejecutarRenombrado() {
    if (!archivoSeleccionado) {
      alert('Selecciona un archivo PDF de la lista.');
      return;
    }

    const nuevoNombre = inputNuevoNombre.value.trim();
    if (!nuevoNombre) {
      alert('Ingresa un nuevo nombre para el archivo.');
      return;
    }

    // Validar regla de renombrado (solo dígitos, hasta 5 dígitos)
    const esNombreValido = /^\d{1,5}$/.test(nuevoNombre);
    if (!esNombreValido) {
      alert('Error: El nombre debe contener únicamente números y tener un máximo de 5 dígitos (ej: 00123).');
      return;
    }

    if (window.apiProyecto && typeof window.apiProyecto.renombrarPDF === 'function') {
      try {
        if (btnMenuRenombrar) btnMenuRenombrar.disabled = true;
        const respuesta = await window.apiProyecto.renombrarPDF({
          rutaOriginal: archivoSeleccionado.rutaLocal,
          nuevoNombre: nuevoNombre
        });
        
        if (btnMenuRenombrar) btnMenuRenombrar.disabled = false;
        
        if (respuesta.exito) {
          alert('¡Archivo renombrado con éxito!');
          visorPlaceholder.classList.remove('oculto');
          visorActivo.classList.add('oculto');
          archivoSeleccionado = null;
          pdfDocumento = null;
          paginasSeleccionadas.clear();
          actualizarMenuLateral();
          
          await cargarListaPDFs();
        } else {
          alert(`Error al renombrar: ${respuesta.mensaje}`);
        }
      } catch (error) {
        if (btnMenuRenombrar) btnMenuRenombrar.disabled = false;
        console.error('Error al renombrar:', error);
        alert('Ocurrió un error inesperado al renombrar.');
      }
    }
  }

  // Vincular evento de renombrado
  if (btnMenuRenombrar) {
    btnMenuRenombrar.addEventListener('click', ejecutarRenombrado);
  }

  // 2. Ejecutar Recorte Geométrico
  async function ejecutarRecorteGeometrico() {
    if (!archivoSeleccionado) {
      alert('Selecciona un archivo PDF de la lista.');
      return;
    }

    if (!herramientaRecorteActiva || !cajaRecorteElemento) {
      alert('Activa la herramienta de recorte y ajusta las guías antes de recortar.');
      return;
    }

    const anchoProporcional = guiaDerecha - guiaIzquierda;
    const altoProporcional = guiaInferior - guiaSuperior;
    const xProporcional = guiaIzquierda;
    const yProporcional = guiaSuperior;

    const confirmar = confirm(`¿Estás seguro de que deseas recortar los márgenes de la página ${paginaActiva} y guardar el resultado directamente en el PDF original?\n\nEsta acción modificará físicamente el archivo.`);
    if (!confirmar) return;

    if (window.apiProyecto && typeof window.apiProyecto.recortarMargenesPDF === 'function') {
      try {
        if (btnMenuRecortar) {
          btnMenuRecortar.disabled = true;
          btnMenuRecortar.querySelector('span').textContent = 'Recortando...';
        }

        const respuesta = await window.apiProyecto.recortarMargenesPDF({
          rutaOriginal: archivoSeleccionado.rutaLocal,
          numPagina: paginaActiva,
          x: xProporcional,
          y: yProporcional,
          ancho: anchoProporcional,
          alto: altoProporcional
        });

        if (btnMenuRecortar) btnMenuRecortar.disabled = false;
        actualizarMenuLateral();

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
        if (btnMenuRecortar) btnMenuRecortar.disabled = false;
        actualizarMenuLateral();
        console.error('Error al recortar márgenes:', error);
        alert('Ocurrió un error inesperado al recortar.');
      }
    }
  }

  // 3. Ejecutar Creación de PDF desde Miniaturas
  async function ejecutarCreacionPdf() {
    if (!archivoSeleccionado) {
      alert('Selecciona un archivo PDF de la lista.');
      return;
    }

    // Obtener sugerencia actual
    let sugerenciaActual = inputNuevoNombre.value.trim();
    if (!/^\d{1,5}$/.test(sugerenciaActual)) {
      const paginasOrdenadas = Array.from(paginasSeleccionadas).sort((a, b) => a - b);
      const pagRef = paginasOrdenadas.length > 0 ? paginasOrdenadas[0] : paginaActiva;
      sugerenciaActual = String(pagRef).padStart(5, '0');
    }

    // Pedir renombrar expresamente para el nuevo PDF
    const nuevoNombre = prompt(
      'Ingresa el nombre del nuevo PDF (únicamente números, máximo 5 dígitos):',
      sugerenciaActual
    );

    // Cancelar creación si presiona Cancelar
    if (nuevoNombre === null) {
      return;
    }

    const nombreLimpio = nuevoNombre.trim();
    if (!/^\d{1,5}$/.test(nombreLimpio)) {
      alert('Error: El nombre ingresado debe contener únicamente números y tener un máximo de 5 dígitos (ej: 00123).');
      return;
    }

    // Guardar el nombre validado en el input
    inputNuevoNombre.value = nombreLimpio;

    const paginasACortar = paginasSeleccionadas.size > 0
      ? Array.from(paginasSeleccionadas).sort((a, b) => a - b)
      : [paginaActiva];

    if (window.apiProyecto && typeof window.apiProyecto.cortarPaginasPDF === 'function') {
      try {
        if (btnMenuCortar) {
          btnMenuCortar.disabled = true;
          btnMenuCortar.querySelector('span').textContent = 'Procesando...';
        }

        const respuesta = await window.apiProyecto.cortarPaginasPDF({
          rutaOriginal: archivoSeleccionado.rutaLocal,
          paginas: paginasACortar,
          nombreSalida: nombreLimpio
        });

        if (btnMenuCortar) btnMenuCortar.disabled = false;
        actualizarMenuLateral();

        if (respuesta.exito) {
          alert('¡Nuevo archivo PDF creado con éxito con las páginas seleccionadas!');
          
          // Limpiar selecciones
          paginasSeleccionadas.clear();
          actualizarMenuLateral();

          // Refrescar cuadrícula
          document.querySelectorAll('.tarjeta-miniatura').forEach(t => t.classList.remove('seleccionada'));

          // Recargar cola de archivos
          await cargarListaPDFs();
        } else {
          alert(`Error al crear el PDF: ${respuesta.mensaje}`);
        }
      } catch (error) {
        if (btnMenuCortar) btnMenuCortar.disabled = false;
        actualizarMenuLateral();
        console.error('Error al cortar:', error);
        alert('Ocurrió un error inesperado al crear el PDF.');
      }
    }
  }

  // Inicializar estado del menú lateral
  actualizarMenuLateral();
});
