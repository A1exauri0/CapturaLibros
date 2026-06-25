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
  
  // Elementos del Visor de PDF Real
  const visorPlaceholder = document.getElementById('visor-placeholder');
  const visorActivo = document.getElementById('visor-activo');
  const visorTituloDoc = document.getElementById('visor-titulo-doc');
  const iframeVisorPdf = document.getElementById('iframe-visor-pdf');

  // Elementos del Panel de Control
  const inputNuevoNombre = document.getElementById('input-nuevo-nombre');
  const textoReglaEjemplo = document.getElementById('texto-regla-ejemplo');
  const btnRenombrar = document.getElementById('btn-renombrar');
  const btnRecortar = document.getElementById('btn-recortar');

  // Elementos de Conexión
  const indicadorConexion = document.querySelector('.punto-conexion');
  const textoConexion = document.getElementById('texto-conexion');

  // Estado local
  let archivosPdfs = [];
  let archivoSeleccionado = null;

  // ==========================================================================
  // GESTIÓN DE TEMA CLARO / OSCURO
  // ==========================================================================
  function aplicarTema(tema) {
    if (tema === 'claro') {
      document.body.classList.add('tema-claro');
      if (iconoTema) iconoTema.setAttribute('icon', 'mdi:weather-sunny');
    } else {
      document.body.classList.remove('tema-claro');
      if (iconoTema) iconoTema.setAttribute('icon', 'mdi:weather-night');
    }
  }

  // Cargar tema inicial desde localStorage
  const temaGuardado = localStorage.getItem('tema-captura') || 'oscuro';
  aplicarTema(temaGuardado);

  if (btnTema) {
    btnTema.addEventListener('click', () => {
      const esTemaClaroActual = document.body.classList.contains('tema-claro');
      const nuevoTema = esTemaClaroActual ? 'oscuro' : 'claro';
      aplicarTema(nuevoTema);
      localStorage.setItem('tema-captura', nuevoTema);
    });
  }

  // ==========================================================================
  // VERIFICAR CONEXIÓN LOCAL CON ELECTRON
  // ==========================================================================
  function verificarConexionLocal() {
    if (window.apiProyecto && typeof window.apiProyecto.verificarConexion === 'function') {
      window.apiProyecto.verificarConexion()
        .then(respuesta => {
          if (respuesta && respuesta.conectado) {
            if (indicadorConexion) indicadorConexion.className = 'punto-conexion activo';
            if (textoConexion) textoConexion.textContent = 'Servicio Local Activo';
          }
        })
        .catch(error => {
          console.error('Error de conexión local:', error);
          marcarDesconectado();
        });
    } else {
      marcarDesconectado();
    }
  }

  function marcarDesconectado() {
    if (indicadorConexion) indicadorConexion.className = 'punto-conexion inactivo';
    if (textoConexion) textoConexion.textContent = 'Sin conexión al proceso principal';
  }

  verificarConexionLocal();

  // ==========================================================================
  // FLUJO DE INICIO DE SESIÓN
  // ==========================================================================
  formularioLogin.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const usuario = inputUsuario.value.trim();
    const contrasena = inputContrasena.value.trim();

    // Login simulado
    if (usuario === 'usuario' && contrasena === 'clave123') {
      errorLogin.textContent = '';
      seccionLogin.classList.add('oculto');
      seccionCaptura.classList.remove('oculto');
      
      // Inicializar la captura y cargar archivos reales
      inicializarCapturaPDFs();
    } else {
      errorLogin.textContent = 'Credenciales incorrectas. Usa: usuario / clave123';
    }
  });

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

  // Seleccionar y cargar el PDF en el visor real
  function seleccionarArchivo(archivo) {
    archivoSeleccionado = archivo;
    
    // Marcar como activo en la lista
    renderizarListaArchivos();

    // Mostrar visor y ocultar placeholder
    visorPlaceholder.classList.add('oculto');
    visorActivo.classList.remove('oculto');
    
    // Título
    visorTituloDoc.textContent = archivo.nombre;

    // Convertir ruta local a URL segura del protocolo registrado en principal.js
    if (window.apiProyecto && typeof window.apiProyecto.obtenerRutaArchivo === 'function') {
      const urlSegura = window.apiProyecto.obtenerRutaArchivo(archivo.rutaLocal);
      
      // Asignar al iframe del visor
      if (iframeVisorPdf) {
        iframeVisorPdf.src = urlSegura;
      }
    }

    // Proponer nuevo nombre bajo la regla sugerida
    actualizarNombreSugerido();
  }

  // Mostrar regla activa del lote
  function actualizarReglaEjemplo() {
    textoReglaEjemplo.innerHTML = `
      Regla de Renombrado activa:
      <code>[TOMO]_[PAGINA_INICIAL]-[PAGINA_FINAL]_[ANIO]</code>
      <br>Ejemplo sugerido:
      <code>T01_001-010_2026.pdf</code>
    `;
  }

  // Proponer nombre sugerido según el archivo seleccionado
  function actualizarNombreSugerido() {
    if (!archivoSeleccionado) return;
    
    // Proponemos un rango de páginas por defecto 001-010 y el año/tomo del archivo
    inputNuevoNombre.value = `${archivoSeleccionado.tomo}_001-010_${archivoSeleccionado.anio}`;
  }

  // ==========================================================================
  // ACCIONES DE LOS BOTONES (SIMULADAS)
  // ==========================================================================
  
  // Renombrar PDF
  btnRenombrar.addEventListener('click', () => {
    if (!archivoSeleccionado) {
      alert('Selecciona un archivo PDF de la lista.');
      return;
    }

    const nuevoNombre = inputNuevoNombre.value.trim();
    if (!nuevoNombre) {
      alert('Ingresa un nuevo nombre para el archivo.');
      return;
    }

    // Ficticio: simulamos renombre
    archivoSeleccionado.nombre = `${nuevoNombre}.pdf`;
    archivoSeleccionado.procesado = true;
    
    alert(`[Simulación] Archivo renombrado a:\n${nuevoNombre}.pdf`);

    // Refrescar lista y cabecera del visor
    renderizarListaArchivos();
    visorTituloDoc.textContent = archivoSeleccionado.nombre;
  });

  // Recortar PDF
  btnRecortar.addEventListener('click', () => {
    if (!archivoSeleccionado) {
      alert('Selecciona un archivo PDF de la lista.');
      return;
    }

    // Ficticio: simulamos recorte
    alert(`[Simulación Recorte]\nRecortando los márgenes del archivo:\n"${archivoSeleccionado.nombre}"\nse creará una versión optimizada en la carpeta del lote.`);
  });
});
