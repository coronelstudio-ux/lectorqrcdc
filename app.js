const KEY_LISTA = 'lectorQR_lista';
const KEY_PERIODO = 'lectorQR_periodo';
const KEY_SONIDO = 'lectorQR_sonido';
const KEY_CAMARA = 'lectorQR_camara';
const KEY_IA = 'lectorQR_ia';
const KEY_CLIENTES = 'lectorQR_clientes';
const KEY_CLIENTE = 'lectorQR_cliente';
const KEY_CLAVE = { gemini: 'lectorQR_clave_gemini', claude: 'lectorQR_clave_claude' };
const MODELOS = { gemini: 'gemini-flash-latest', claude: 'claude-haiku-5-5' };
const NOMBRE_IA = { gemini: 'Gemini', claude: 'Claude', manual: 'copiar y pegar' };

const $ = id => document.getElementById(id);
const el = {
  periodo: $('periodo'), periodoTexto: $('periodoTexto'), video: $('video'), vistaEscanear: $('vistaEscanear'),
  marco: $('marco'), btnCamara: $('btnCamara'), estado: $('estado'), resolucion: $('resolucion'),
  contadorFlotante: $('contadorFlotante'), totalFlotante: $('totalFlotante'),
  btnLinterna: $('btnLinterna'), btnZoom: $('btnZoom'), panelZoom: $('panelZoom'), zoom: $('zoom'), zoomMax: $('zoomMax'),
  btnSonido: $('btnSonido'), btnCambiar: $('btnCambiar'),
  btnInstalar: $('btnInstalar'), btnInstalar2: $('btnInstalar2'), appTitulo: $('appTitulo'), appTexto: $('appTexto'), pasosIOS: $('pasosIOS'),
  actualizar: $('actualizar'), btnActualizar: $('btnActualizar'), btnFoto: $('btnFoto'), archivoFoto: $('archivoFoto'), btnPegar: $('btnPegar'),
  contador: $('contador'), buscar: $('buscar'), tabla: $('tabla'), insignia: $('insignia'),
  expPeriodo: $('expPeriodo'), expCantidad: $('expCantidad'), expTotal: $('expTotal'), expIva: $('expIva'),
  btnCliente: $('btnCliente'), clienteTexto: $('clienteTexto'), expCliente: $('expCliente'),
  hojaClientes: $('hojaClientes'), cliSubtitulo: $('cliSubtitulo'), cliLista: $('cliLista'), cliHuerfanas: $('cliHuerfanas'),
  cliFormTitulo: $('cliFormTitulo'), cNombre: $('c_nombre'), cRuc: $('c_ruc'), cliNotaRuc: $('cliNotaRuc'),
  btnCancelarCli: $('btnCancelarCli'), btnGuardarCli: $('btnGuardarCli'),
  btnGuardar: $('btnGuardar'), btnBorrar: $('btnBorrar'), expConciliar: $('expConciliar'), expExcluidas: $('expExcluidas'),
  btnSinQR: $('btnSinQR'), btnAMano: $('btnAMano'), hojaIA: $('hojaIA'), iaSubtitulo: $('iaSubtitulo'), iaOpcionesFoto: $('iaOpcionesFoto'),
  btnIACamara: $('btnIACamara'), btnIAGaleria: $('btnIAGaleria'), fotoIACamara: $('fotoIACamara'), fotoIAGaleria: $('fotoIAGaleria'),
  iaLeyendo: $('iaLeyendo'), iaLeyendoTexto: $('iaLeyendoTexto'), iaManual: $('iaManual'), btnCopiarPrompt: $('btnCopiarPrompt'),
  iaJson: $('iaJson'), btnPegarJson: $('btnPegarJson'), btnRevisarJson: $('btnRevisarJson'),
  hojaRevision: $('hojaRevision'), revTitulo: $('revTitulo'), revSubtitulo: $('revSubtitulo'), revFoto: $('revFoto'), revErrores: $('revErrores'),
  btnCancelarRev: $('btnCancelarRev'), btnConfirmarRev: $('btnConfirmarRev'),
  iaProveedor: $('iaProveedor'), iaClave: $('iaClave'), iaClaveFila: $('iaClaveFila'), iaModelo: $('iaModelo'), iaModeloFila: $('iaModeloFila'),
  btnGuardarIA: $('btnGuardarIA'), btnBorrarClave: $('btnBorrarClave'), iaEstado: $('iaEstado'),
  aviso: $('aviso'), avisoIcono: $('avisoIcono'), avisoTexto: $('avisoTexto'),
  fondoHoja: $('fondoHoja'), hojaEnlace: $('hojaEnlace'), manual: $('manual'), btnManual: $('btnManual'), btnPortapapeles: $('btnPortapapeles')
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ICONOS = {
  ok: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  err: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
};
const ICO_CAMARA = '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>';
const ICO_DETENER = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
const ICO_SONIDO_ON = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>';
const ICO_SONIDO_OFF = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>';

let lista = [];
let clientes = [];        // [{ id, nombre, ruc, dv }]
let clienteId = '';
let editandoCliente = '';
let stream = null;
let pista = null;
let timer = null;
let detector = null;
let ultimoTexto = '';
let ultimoMomento = 0;
let linternaOn = false;
let sonidoOn = true;
let audioCtx = null;
let avisoTimer = null;
let marcoTimer = null;
let camara = 'environment'; // 'environment' = trasera, 'user' = frontal
let cambiando = false;
let eventoInstalar = null;
let borrador = null;      // factura en revisión (aún no guardada)
let fotoUrl = null;       // foto mostrada en el formulario de revisión
let excluirTocado = false;
let iaOcupada = false;
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Errores de JavaScript visibles en pantalla
window.onerror = (msg, src, line) => avisar('Error en la página: ' + msg + ' (línea ' + line + ')', 'err');

const gs = n => Number(n || 0).toLocaleString('es-PY');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function leerLS(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
function escribirLS(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }

// Pista fija sobre la cámara
function setEstado(msg) { el.estado.textContent = msg; }

// Aviso flotante con color: ok (verde), warn (ámbar), err (rojo), info (gris)
function avisar(msg, tipo = 'info') {
  el.avisoTexto.textContent = msg;
  el.avisoIcono.innerHTML = ICONOS[tipo] || ICONOS.info;
  el.aviso.className = 'visible ' + tipo;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { el.aviso.className = ''; }, tipo === 'err' ? 4000 : 2600);
}

function destellarMarco(tipo) {
  el.marco.className = 'marco ' + tipo;
  clearTimeout(marcoTimer);
  marcoTimer = setTimeout(() => { el.marco.className = 'marco'; }, 900);
}

// Pitido corto con Web Audio (sin archivos de sonido)
function pitar(tipo) {
  if (!sonidoOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const tonos = tipo === 'ok' ? [1320] : tipo === 'warn' ? [880, 880] : [300];
    tonos.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gan = audioCtx.createGain();
      const t0 = audioCtx.currentTime + i * 0.16;
      osc.frequency.value = f;
      osc.type = tipo === 'err' ? 'square' : 'sine';
      gan.gain.setValueAtTime(0.0001, t0);
      gan.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
      gan.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      osc.connect(gan).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.13);
    });
  } catch { /* sin audio */ }
}

function vibrar(tipo) {
  if (!navigator.vibrate) return;
  navigator.vibrate(tipo === 'ok' ? 120 : tipo === 'warn' ? [60, 60, 60] : [200, 80, 200]);
}

function respuesta(msg, tipo) {
  avisar(msg, tipo);
  destellarMarco(tipo);
  pitar(tipo);
  vibrar(tipo);
}

function periodoActual() { return el.periodo.value; }
function clienteActual() { return clientes.find(c => c.id === clienteId) || null; }

function cargarClientes() {
  try { clientes = JSON.parse(leerLS(KEY_CLIENTES) || '[]'); } catch { clientes = []; }
  if (!Array.isArray(clientes)) clientes = [];
  clienteId = leerLS(KEY_CLIENTE) || '';
  if (!clienteActual()) clienteId = clientes.length ? clientes[0].id : '';
}
function guardarClientes() {
  escribirLS(KEY_CLIENTES, JSON.stringify(clientes));
  escribirLS(KEY_CLIENTE, clienteId);
}

// Antes de cargar una factura hace falta cliente y período
function listo(conRespuesta) {
  const fallar = msg => { (conRespuesta ? respuesta : avisar)(msg, 'err'); return false; };
  if (!clienteActual()) { fallar('Elige o crea primero el cliente.'); abrirClientes(); return false; }
  if (!periodoActual()) return fallar('Elige primero el período (mes).');
  return true;
}

function textoPeriodo(p) {
  if (!/^\d{4}-\d{2}$/.test(p || '')) return 'Período';
  return `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
}

function cargarLista() {
  try { lista = JSON.parse(leerLS(KEY_LISTA) || '[]'); } catch { lista = []; }
  if (!Array.isArray(lista)) lista = [];
  lista = lista.map(completarFactura); // listas viejas: tipo y origen "QR"
}
function guardarLista() { escribirLS(KEY_LISTA, JSON.stringify(lista)); }

function listaDelPeriodo() {
  if (!clienteId) return []; // sin cliente no se muestra nada (ni las facturas sin asignar)
  return lista.filter(f => f.periodo === periodoActual() && f.clienteId === clienteId);
}

function render() {
  const items = listaDelPeriodo();
  const total = items.reduce((s, f) => s + (f.total || 0), 0);
  const iva = items.reduce((s, f) => s + (f.iva || 0), 0);
  const p = periodoActual();

  const cli = clienteActual();
  el.periodoTexto.textContent = textoPeriodo(p);
  el.clienteTexto.textContent = cli ? cli.nombre : 'Elegir cliente';
  el.btnCliente.classList.toggle('falta', !cli);
  el.expCliente.textContent = cli ? `${cli.nombre} · ${cli.ruc}-${cli.dv}` : '—';
  el.contadorFlotante.textContent = items.length;
  el.totalFlotante.textContent = gs(total);
  el.insignia.textContent = items.length;
  el.insignia.hidden = items.length === 0;
  el.contador.textContent = `${cli ? cli.nombre + ' · ' : ''}${items.length} factura(s) en ${textoPeriodo(p)} · Gs. ${gs(total)}`;
  el.expPeriodo.textContent = textoPeriodo(p);
  el.expCantidad.textContent = items.length;
  el.expTotal.textContent = gs(total);
  el.expIva.textContent = gs(iva);
  el.btnGuardar.disabled = items.length === 0;
  const excluidas = items.filter(f => f.excluirConciliacion).length;
  el.expConciliar.textContent = items.length - excluidas;
  el.expExcluidas.textContent = excluidas;

  const q = el.buscar.value.trim().toLowerCase();
  const visibles = items
    .filter(f => !q || [f.numeroCompleto, f.rucEmisor, f.cdc, f.razonSocial].some(v => String(v || '').toLowerCase().includes(q)))
    .slice().reverse(); // la más reciente arriba

  if (!visibles.length) {
    el.tabla.innerHTML = `<div class="vacio"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
      <p>${!cli ? 'Elige o crea un cliente para empezar.' : items.length ? 'Ninguna factura coincide con la búsqueda.' : 'Todavía no hay facturas de este cliente en el período.<br>Ve a Escanear para empezar.'}</p></div>`;
    return;
  }
  el.tabla.innerHTML = visibles.map(f => `
    <div class="tarjeta${f.excluirConciliacion ? ' excluida' : ''}">
      <div class="avatar"><svg viewBox="0 0 24 24"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
      <div class="datos">
        <div class="fila1"><span class="num">${esc(f.numeroCompleto)}</span><span class="monto">Gs. ${gs(f.total)}</span></div>
        <div class="fila2">${esc(f.fecha)} · RUC ${esc(f.rucEmisor)}-${esc(f.dvEmisor)} · IVA ${gs(f.iva)}</div>
        ${f.razonSocial ? `<div class="fila2">${esc(f.razonSocial)}</div>` : ''}
        ${f.cdc ? `<div class="cdc">${esc(f.cdc)}</div>` : ''}
        <div class="chips">
          <span class="chip">${esc(f.tipo)}</span>
          <span class="chip${f.origen === 'IA' ? ' ia' : ''}">Origen: ${esc(f.origen)}</span>
          ${f.excluirConciliacion ? '' : '<span class="etiqueta" style="margin:0">Pendiente Marangatu</span>'}
        </div>
        <label class="casilla"><input type="checkbox" class="excluir" data-id="${esc(f.id)}"${f.excluirConciliacion ? ' checked' : ''}>Excluir de conciliación</label>
      </div>
      <button class="borrar" data-id="${esc(f.id)}" aria-label="Borrar factura"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
    </div>`).join('');
}

function agregar(texto) {
  if (!listo(true)) return false;
  const cli = clienteActual();
  const r = parsearEnlace(texto, periodoActual(), cli.ruc);
  if (!r.ok) {
    let msg = r.error;
    if (r.periodoDistinto) msg = `Ignorada ${r.factura.numeroCompleto}: es de ${textoPeriodo(r.factura.periodo)}.`;
    else if (r.rucDistinto) {
      const otro = clientes.find(c => rucCoincide(c.ruc, r.factura.rucReceptor));
      msg = otro ? `Ignorada ${r.factura.numeroCompleto}: es de ${otro.nombre}. Cambia de cliente para cargarla.`
                 : `Ignorada ${r.factura.numeroCompleto}: ${r.error}`;
    }
    respuesta(msg, 'err');
    return false;
  }
  r.factura.clienteId = cli.id;
  if (lista.some(f => f.id === r.factura.id)) {
    respuesta(`Ya estaba registrada: ${r.factura.numeroCompleto}`, 'warn');
    return false;
  }
  lista.push(r.factura);
  guardarLista();
  render();
  respuesta(`Registrada ${r.factura.numeroCompleto} · Gs. ${gs(r.factura.total)}`, 'ok');
  return true;
}

// Detección: nativa si existe (Chrome Android); si no, jsQR con el cuadro completo y luego el centro ampliado
async function detectarEnFuente(fuente, w, h) {
  if (detector) {
    const codigos = await detector.detect(fuente);
    if (codigos.length) return codigos[0].rawValue;
  }
  if (typeof jsQR !== 'function') return null;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(fuente, 0, 0, w, h);
  let code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
  if (code) return code.data;

  const cw = Math.round(w * 0.8), ch = Math.round(h * 0.8);
  const sx = Math.round((w - cw) / 2), sy = Math.round((h - ch) / 2);
  canvas.width = Math.round(cw * 1.5); canvas.height = Math.round(ch * 1.5);
  ctx.drawImage(fuente, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return code ? code.data : null;
}

function crearDetector() {
  if (detector || !('BarcodeDetector' in window)) return;
  try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
}

async function iniciarCamara() {
  if (!listo()) return;
  if (!window.isSecureContext || !navigator.mediaDevices) {
    avisar('La cámara requiere HTTPS. Abre la página desde GitHub Pages, no como archivo local.', 'err');
    return;
  }
  crearDetector();
  if (!detector && typeof jsQR !== 'function') {
    avisar('No se cargó el lector de QR (jsQR). Revisa la conexión y recarga.', 'err');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: camara }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
  } catch (e) {
    const motivo = { NotAllowedError: 'permiso denegado', NotFoundError: 'no hay cámara', NotReadableError: 'la cámara está en uso' }[e.name] || e.message;
    avisar('No se pudo acceder a la cámara: ' + motivo + '.', 'err');
    return;
  }
  el.video.srcObject = stream;
  el.video.classList.toggle('espejo', camara === 'user');
  el.video.onloadedmetadata = () => {
    el.resolucion.textContent = `Cámara: ${el.video.videoWidth}×${el.video.videoHeight}`;
  };
  pista = stream.getVideoTracks()[0];
  configurarControles();
  el.vistaEscanear.classList.add('escaneando');
  document.getElementById('icoDisparador').innerHTML = ICO_DETENER;
  setEstado('Acerca el QR hasta que ocupe casi todo el recuadro.');

  timer = setInterval(async () => {
    if (el.video.readyState < 2) return;
    try {
      const texto = await detectarEnFuente(el.video, el.video.videoWidth, el.video.videoHeight);
      if (!texto) return;
      const ahora = Date.now();
      if (texto === ultimoTexto && ahora - ultimoMomento < 3000) return;
      ultimoTexto = texto;
      ultimoMomento = ahora;
      agregar(texto);
    } catch (e) {
      avisar('Error al leer: ' + e.message, 'err');
    }
  }, 300);
}

function detenerCamara() {
  clearInterval(timer);
  timer = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  pista = null;
  linternaOn = false;
  el.video.srcObject = null;
  el.resolucion.textContent = '';
  el.btnLinterna.hidden = true;
  el.btnLinterna.classList.remove('on');
  el.btnZoom.hidden = true;
  el.btnZoom.classList.remove('on');
  el.btnCambiar.hidden = true;
  el.panelZoom.hidden = true;
  el.vistaEscanear.classList.remove('escaneando');
  document.getElementById('icoDisparador').innerHTML = ICO_CAMARA;
  setEstado('');
}

// Linterna y zoom: solo se muestran si la cámara del celular los soporta
function configurarControles() {
  const cap = pista && pista.getCapabilities ? pista.getCapabilities() : {};
  el.btnLinterna.hidden = !cap.torch;
  if (cap.zoom && cap.zoom.max > cap.zoom.min) {
    el.btnZoom.hidden = false;
    el.zoom.min = cap.zoom.min;
    el.zoom.max = Math.min(cap.zoom.max, 8);
    el.zoom.step = cap.zoom.step || 0.1;
    el.zoom.value = (pista.getSettings && pista.getSettings().zoom) || cap.zoom.min;
    el.zoomMax.textContent = `${Number(el.zoom.max).toFixed(0)}×`;
  } else {
    el.btnZoom.hidden = true;
  }
  mostrarCambiarCamara();
}

// El botón de cambiar cámara solo aparece si hay más de una cámara
async function mostrarCambiarCamara() {
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    el.btnCambiar.hidden = dispositivos.filter(d => d.kind === 'videoinput').length < 2;
  } catch {
    el.btnCambiar.hidden = true;
  }
}

async function cambiarCamara() {
  if (cambiando) return;
  cambiando = true;
  camara = camara === 'environment' ? 'user' : 'environment';
  escribirLS(KEY_CAMARA, camara);
  if (stream) {
    detenerCamara();
    await iniciarCamara();
  }
  avisar(camara === 'user' ? 'Cámara frontal' : 'Cámara trasera', 'info');
  cambiando = false;
}

async function alternarLinterna() {
  if (!pista) return;
  try {
    linternaOn = !linternaOn;
    await pista.applyConstraints({ advanced: [{ torch: linternaOn }] });
    el.btnLinterna.classList.toggle('on', linternaOn);
  } catch {
    linternaOn = false;
    el.btnLinterna.classList.remove('on');
    avisar('No se pudo encender la linterna.', 'err');
  }
}

async function aplicarZoom() {
  if (!pista) return;
  try { await pista.applyConstraints({ advanced: [{ zoom: Number(el.zoom.value) }] }); } catch { /* sin zoom */ }
}

// Leer el QR desde una foto de la galería
async function leerFoto(archivo) {
  if (!archivo) return;
  if (!listo()) return;
  crearDetector();
  try {
    const img = await createImageBitmap(archivo);
    const escala = Math.min(1, 2000 / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
    let texto = null;
    if (escala < 1) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      texto = await detectarEnFuente(c, w, h);
    } else {
      texto = await detectarEnFuente(img, w, h);
    }
    if (texto) agregar(texto);
    else respuesta('No se encontró un QR en la foto. Prueba con una imagen más nítida.', 'err');
  } catch (e) {
    avisar('No se pudo leer la foto: ' + e.message, 'err');
  }
}

// Excel en memoria. Se guarda con "Guardar como" (elige carpeta) si el navegador lo permite;
// si no, se descarga a la carpeta Descargas del celular.
async function guardarExcel() {
  const items = listaDelPeriodo();
  if (!clienteActual()) { avisar('Elige primero el cliente.', 'err'); return; }
  if (!items.length) { avisar('No hay facturas de este cliente en el período.', 'err'); return; }
  if (typeof XLSX === 'undefined') { avisar('No se cargó la librería de Excel. Revisa la conexión.', 'err'); return; }

  const ws = XLSX.utils.json_to_sheet(items.map(aFilaExcel));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'QR');
  const datos = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const nombre = `QR_facturas_${clienteActual().ruc}_${periodoActual()}.xlsx`;
  const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob = new Blob([datos], { type: tipo });

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const destino = await window.showSaveFilePicker({
        suggestedName: nombre,
        types: [{ description: 'Libro de Excel', accept: { [tipo]: ['.xlsx'] } }]
      });
      const escritor = await destino.createWritable();
      await escritor.write(blob);
      await escritor.close();
      avisar(`Excel guardado: ${destino.name || nombre}`, 'ok');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // el usuario cerró la ventana
      // Otro error: se sigue con la descarga normal
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  avisar(`Excel guardado en Descargas: ${nombre}`, 'ok');
}

// Navegación por pestañas; la cámara se apaga al salir de Escanear para ahorrar batería
function mostrarVista(id) {
  document.querySelectorAll('.vista').forEach(v => v.classList.toggle('activa', v.id === id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('activa', b.dataset.vista === id));
  if (id !== 'vistaEscanear' && stream) detenerCamara();
}

function abrirHoja(hoja) {
  document.querySelectorAll('.hoja.abierta').forEach(x => x.classList.remove('abierta'));
  el.fondoHoja.classList.add('abierta');
  hoja.classList.add('abierta');
  hoja.scrollTop = 0;
}
function cerrarHoja() {
  el.fondoHoja.classList.remove('abierta');
  document.querySelectorAll('.hoja.abierta').forEach(x => x.classList.remove('abierta'));
  borrador = null;
  if (fotoUrl) { URL.revokeObjectURL(fotoUrl); fotoUrl = null; }
}

// ---------- Clientes ----------

const ICO_EDITAR = '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const ICO_BORRAR = '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
const facturasDe = id => lista.filter(f => f.clienteId === id).length;
const nuevoIdCliente = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function renderClientes() {
  el.cliLista.innerHTML = clientes.length ? clientes.map(c => `
    <div class="cliente-fila${c.id === clienteId ? ' activo' : ''}">
      <button class="elegir" data-id="${esc(c.id)}">
        <b>${esc(c.nombre)}</b>
        <small>RUC ${esc(c.ruc)}-${esc(c.dv)} · ${facturasDe(c.id)} factura(s)${c.id === clienteId ? ' · <span class="marca-activo">EN USO</span>' : ''}</small>
      </button>
      <button class="icono-btn editar" data-id="${esc(c.id)}" aria-label="Editar cliente">${ICO_EDITAR}</button>
      <button class="icono-btn borrar-cli" data-id="${esc(c.id)}" aria-label="Borrar cliente">${ICO_BORRAR}</button>
    </div>`).join('') : '';
  // Facturas guardadas antes de tener clientes (o de un cliente borrado sin facturas)
  const huerfanas = lista.filter(f => !f.clienteId);
  const rucs = [...new Set(huerfanas.map(f => rucBase(f.rucReceptor)).filter(Boolean))];
  el.cliHuerfanas.hidden = !huerfanas.length;
  el.cliHuerfanas.textContent = huerfanas.length
    ? `Hay ${huerfanas.length} factura(s) guardada(s) sin cliente${rucs.length ? ` (RUC receptor ${rucs.join(', ')})` : ''}. Crea el cliente con ese RUC y se le asignan solas.`
    : '';
}

function limpiarFormCliente() {
  editandoCliente = '';
  el.cNombre.value = '';
  el.cRuc.value = '';
  el.cRuc.disabled = false;
  el.cliNotaRuc.hidden = true;
  el.cliFormTitulo.textContent = 'Nuevo cliente';
  el.btnGuardarCli.textContent = 'Agregar cliente';
  for (const i of [el.cNombre, el.cRuc]) { i.closest('.campo').classList.remove('error'); i.closest('.campo').querySelector('small').textContent = ''; }
}

function abrirClientes() {
  if (stream) detenerCamara();
  limpiarFormCliente();
  renderClientes();
  el.cliSubtitulo.textContent = clientes.length
    ? 'Elige con qué contribuyente trabajas. La lista, los totales y el Excel son de ese cliente.'
    : 'Crea tu primer cliente (el contribuyente que compra). Las facturas se controlan con su RUC.';
  abrirHoja(el.hojaClientes);
  if (!clientes.length) setTimeout(() => el.cNombre.focus(), 250);
}

function elegirCliente(id) {
  clienteId = id;
  guardarClientes();
  cerrarHoja();
  el.buscar.value = '';
  render();
  avisar(`Cliente: ${clienteActual().nombre}`, 'info');
}

// Asigna al cliente las facturas sin cliente cuyo RUC receptor es el suyo.
// Si es el único cliente, también las que no tienen RUC receptor.
function asignarHuerfanas(c) {
  let n = 0;
  for (const f of lista) {
    if (f.clienteId) continue;
    if (rucCoincide(f.rucReceptor, c.ruc) || (clientes.length === 1 && !rucBase(f.rucReceptor))) { f.clienteId = c.id; n++; }
  }
  return n;
}

function guardarCliente() {
  const { ruc, dv } = separarRuc(el.cRuc.value);
  const previo = clientes.find(c => c.id === editandoCliente);
  const c = { id: editandoCliente || nuevoIdCliente(), nombre: el.cNombre.value.trim(), ruc: rucBase(ruc) || ruc, dv };
  if (previo && el.cRuc.disabled) { c.ruc = previo.ruc; c.dv = previo.dv; }
  const { ok, errores } = validarCliente(c, clientes);
  const marcar = (input, msg) => { input.closest('.campo').classList.toggle('error', !!msg); input.closest('.campo').querySelector('small').textContent = msg || ''; };
  marcar(el.cNombre, errores.nombre);
  marcar(el.cRuc, errores.ruc);
  if (!ok) return;
  if (previo) {
    Object.assign(previo, c);
    guardarClientes();
    limpiarFormCliente();
    renderClientes();
    render();
    avisar('Cliente actualizado.', 'ok');
    return;
  }
  clientes.push(c);
  const asignadas = asignarHuerfanas(c);
  guardarLista();
  clienteId = c.id;
  guardarClientes();
  cerrarHoja();
  render();
  avisar(`Creado: ${c.nombre}${asignadas ? `. Se le asignaron ${asignadas} factura(s) guardada(s)` : ''}.`, 'ok');
}

function editarCliente(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  limpiarFormCliente();
  editandoCliente = id;
  el.cNombre.value = c.nombre;
  el.cRuc.value = `${c.ruc}-${c.dv}`;
  const conFacturas = facturasDe(id) > 0;
  el.cRuc.disabled = conFacturas;
  el.cliNotaRuc.hidden = !conFacturas;
  el.cliFormTitulo.textContent = 'Editar cliente';
  el.btnGuardarCli.textContent = 'Guardar cambios';
  el.cNombre.focus();
}

function borrarCliente(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  const n = facturasDe(id);
  const pregunta = n
    ? `¿Borrar a ${c.nombre}? También se borrarán sus ${n} factura(s) guardada(s) en este celular.`
    : `¿Borrar a ${c.nombre}?`;
  if (!confirm(pregunta)) return;
  clientes = clientes.filter(x => x.id !== id);
  lista = lista.filter(f => f.clienteId !== id);
  if (clienteId === id) clienteId = clientes.length ? clientes[0].id : '';
  guardarLista();
  guardarClientes();
  limpiarFormCliente();
  renderClientes();
  render();
  avisar(`Borrado: ${c.nombre}.`, 'info');
}

// ---------- Lectura con IA (facturas sin QR) ----------

function configIA() {
  let c = {};
  try { c = JSON.parse(leerLS(KEY_IA) || '{}') || {}; } catch { c = {}; }
  const proveedor = ['gemini', 'claude', 'manual'].includes(c.proveedor) ? c.proveedor : 'gemini';
  const modelos = Object.assign({}, MODELOS, c.modelos || {});
  return { proveedor, modelos };
}
const claveIA = prov => (KEY_CLAVE[prov] ? leerLS(KEY_CLAVE[prov]) || '' : '');

function pintarAjustesIA(prov) {
  const c = configIA();
  prov = prov || c.proveedor;
  el.iaProveedor.value = prov;
  const manual = prov === 'manual';
  el.iaClaveFila.hidden = manual;
  el.iaModeloFila.hidden = manual;
  el.btnBorrarClave.hidden = manual;
  el.iaClave.value = claveIA(prov);
  el.iaModelo.value = c.modelos[prov] || '';
  el.iaModelo.placeholder = MODELOS[prov] || '';
  const k = claveIA(prov);
  el.iaEstado.textContent = manual
    ? 'Modo manual: la app te da las instrucciones y tú pegas el JSON que responde la IA.'
    : (k ? `Clave de ${NOMBRE_IA[prov]} guardada (termina en …${k.slice(-4)}).` : `Sin clave de ${NOMBRE_IA[prov]}.`);
}

function guardarAjustesIA() {
  const prov = el.iaProveedor.value;
  const c = configIA();
  c.proveedor = prov;
  if (prov !== 'manual') {
    c.modelos[prov] = el.iaModelo.value.trim() || MODELOS[prov];
    const k = el.iaClave.value.trim();
    if (k) escribirLS(KEY_CLAVE[prov], k);
  }
  escribirLS(KEY_IA, JSON.stringify(c));
  pintarAjustesIA(prov);
  avisar('Configuración de IA guardada.', 'ok');
}

function abrirSinQR() {
  if (!listo()) return;
  if (stream) detenerCamara();
  const c = configIA();
  const manual = c.proveedor === 'manual';
  const sinClave = !manual && !claveIA(c.proveedor);
  el.iaOpcionesFoto.hidden = manual;
  el.iaLeyendo.hidden = true;
  el.iaManual.open = manual || sinClave;
  el.iaSubtitulo.textContent = manual
    ? 'Modo manual: copia las instrucciones, úsalas con la foto en Gemini o Claude y pega aquí el JSON.'
    : sinClave
      ? `Falta la API key de ${NOMBRE_IA[c.proveedor]} (Exportar → Lectura con IA). Mientras tanto puedes usar copiar y pegar.`
      : `Saca una foto nítida de la factura completa. ${NOMBRE_IA[c.proveedor]} la lee y tú revisas antes de guardar.`;
  abrirHoja(el.hojaIA);
}

// Reduce la foto (lado mayor 1600 px, JPEG) para enviar menos datos y gastar menos tokens
async function imagenBase64(archivo) {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

function mensajeErrorApi(status, detalle) {
  const base = {
    400: 'Solicitud rechazada',
    401: 'API key inválida',
    403: 'La API key no tiene permiso',
    404: 'Modelo no encontrado: revisa el nombre en Exportar → Lectura con IA',
    429: 'Límite de uso o saldo agotado; espera un momento o revisa tu cuenta'
  }[status] || (status >= 500 ? 'El servicio de IA no responde; intenta de nuevo' : `Error ${status}`);
  return detalle ? `${base}. ${detalle}` : base + '.';
}

async function pedirJson(url, opciones) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opciones));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(mensajeErrorApi(r.status, j && j.error && j.error.message));
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('La IA tardó demasiado. Intenta de nuevo.');
    if (e instanceof TypeError) throw new Error('Sin conexión con el servicio de IA. Revisa internet.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Claude: Messages API directo desde el navegador, con respuesta JSON según el esquema
async function leerConClaude(b64, clave, modelo) {
  const j = await pedirJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': clave,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 16000,
      system: PROMPT_IA,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_IA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text: 'Lee esta factura y devuelve solo el JSON.' }
        ]
      }]
    })
  });
  if (j.stop_reason === 'refusal') throw new Error('La IA no pudo procesar esta imagen.');
  if (j.stop_reason === 'max_tokens') throw new Error('La respuesta de la IA quedó incompleta. Intenta de nuevo.');
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

// Gemini: generateContent con respuesta en JSON
async function leerConGemini(b64, clave, modelo) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
  const j = await pedirJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT_IA }] },
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: 'image/jpeg', data: b64 } },
        { text: 'Lee esta factura y devuelve solo el JSON.' }
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 }
    })
  });
  const cand = (j.candidates || [])[0];
  const texto = cand && cand.content ? (cand.content.parts || []).map(p => p.text || '').join('') : '';
  if (!texto) {
    const motivo = (j.promptFeedback && j.promptFeedback.blockReason) || (cand && cand.finishReason) || 'sin respuesta';
    throw new Error(`La IA no devolvió datos (${motivo}).`);
  }
  return texto;
}

async function leerConIA(archivo) {
  if (!archivo || iaOcupada) return;
  const c = configIA();
  const clave = claveIA(c.proveedor);
  if (c.proveedor === 'manual' || !clave) { el.iaManual.open = true; avisar('Carga la API key en Exportar → Lectura con IA, o usa copiar y pegar.', 'err'); return; }
  iaOcupada = true;
  el.iaOpcionesFoto.hidden = true;
  el.iaLeyendo.hidden = false;
  el.iaLeyendoTexto.textContent = `Leyendo la factura con ${NOMBRE_IA[c.proveedor]}…`;
  try {
    const b64 = await imagenBase64(archivo);
    const leer = c.proveedor === 'claude' ? leerConClaude : leerConGemini;
    const texto = await leer(b64, clave, c.modelos[c.proveedor] || MODELOS[c.proveedor]);
    const datos = extraerJson(texto);
    abrirRevision(normalizarIA(datos, 'IA'), URL.createObjectURL(archivo));
  } catch (e) {
    avisar(e.message || 'No se pudo leer la factura.', 'err');
    el.iaOpcionesFoto.hidden = false;
  } finally {
    el.iaLeyendo.hidden = true;
    iaOcupada = false;
  }
}

function revisarJsonPegado() {
  try {
    const datos = extraerJson(el.iaJson.value);
    el.iaJson.value = '';
    abrirRevision(normalizarIA(datos, 'IA'), null);
  } catch (e) {
    avisar('El texto pegado no es un JSON válido. Copia solo la respuesta de la IA.', 'err');
  }
}

function cargarAMano() {
  if (!listo()) return;
  if (stream) detenerCamara();
  abrirRevision({
    tipo: 'Manual', origen: 'Manual', excluirConciliacion: excluirPorDefecto('Manual'),
    rucEmisor: '', dvEmisor: '', razonSocial: '', numeroCompleto: '', fecha: '', timbrado: '', condicion: '',
    total5: null, total10: null, exenta: null, total: null, iva: null, cdc: '', revisar: []
  }, null);
}

// ---------- Formulario de revisión ----------

const CAMPOS_FORM = ['tipo', 'origen', 'rucEmisor', 'timbrado', 'razonSocial', 'rucReceptor', 'numeroCompleto', 'fecha', 'condicion',
  'total10', 'total5', 'exenta', 'total', 'iva', 'cdc'];
const campoForm = c => $('f_' + c);
const montoTexto = v => (v === null || v === undefined || v === '' ? '' : gs(v));

function abrirRevision(f, foto) {
  const fotoAnterior = fotoUrl;
  fotoUrl = null; // que cerrar/abrir no la libere antes de mostrarla
  abrirHoja(el.hojaRevision);
  if (fotoAnterior && fotoAnterior !== foto) URL.revokeObjectURL(fotoAnterior);
  borrador = f;
  fotoUrl = foto;
  excluirTocado = false;
  el.revTitulo.textContent = f.origen === 'IA' ? 'Revisar lectura de la IA' : 'Cargar factura a mano';
  el.revSubtitulo.textContent = f.origen === 'IA'
    ? 'La IA puede equivocarse. Compara con la foto: los campos en ámbar son dudosos. Nada se guarda hasta que confirmes.'
    : 'Completa los datos tal como figuran en la factura.';
  el.revFoto.hidden = !foto;
  if (foto) el.revFoto.src = foto; else el.revFoto.removeAttribute('src');

  campoForm('tipo').value = f.tipo === 'Electrónica sin QR' ? 'Electrónica sin QR' : 'Manual';
  campoForm('origen').value = f.origen;
  $('f_excluirConciliacion').checked = !!f.excluirConciliacion;
  campoForm('rucEmisor').value = f.rucEmisor ? `${f.rucEmisor}${f.dvEmisor ? '-' + f.dvEmisor : ''}` : '';
  campoForm('timbrado').value = f.timbrado || '';
  campoForm('razonSocial').value = f.razonSocial || '';
  const cli = clienteActual();
  const receptor = f.rucReceptor || (cli ? cli.ruc : '');
  campoForm('rucReceptor').value = cli && rucCoincide(receptor, cli.ruc) ? `${cli.ruc}-${cli.dv}` : receptor;
  campoForm('numeroCompleto').value = f.numeroCompleto || '';
  campoForm('fecha').value = normalizarFecha(f.fecha) || '';
  campoForm('condicion').value = f.condicion || '';
  for (const c of ['total10', 'total5', 'exenta', 'total', 'iva']) campoForm(c).value = montoTexto(f[c]);
  campoForm('cdc').value = f.cdc || '';

  const dudosos = new Set((f.revisar || []).map(c => (c === 'dvEmisor' ? 'rucEmisor' : c)));
  for (const c of CAMPOS_FORM) campoForm(c).closest('.campo').classList.toggle('dudoso', dudosos.has(c));
  validarFormulario();
}

function leerFormulario() {
  const { ruc, dv } = separarRuc(campoForm('rucEmisor').value);
  const numTxt = campoForm('numeroCompleto').value.trim();
  const fecha = campoForm('fecha').value;
  return {
    tipo: campoForm('tipo').value,
    origen: borrador ? borrador.origen : 'Manual',
    excluirConciliacion: $('f_excluirConciliacion').checked,
    rucEmisor: ruc.replace(/^0+/, ''),
    dvEmisor: dv,
    razonSocial: campoForm('razonSocial').value.trim(),
    rucReceptor: rucBase(campoForm('rucReceptor').value),
    numeroCompleto: formatearNumero(numTxt) || numTxt,
    fecha,
    periodo: fecha.slice(0, 7),
    timbrado: campoForm('timbrado').value.replace(/\s/g, ''),
    condicion: campoForm('condicion').value,
    total10: montoFlexible(campoForm('total10').value),
    total5: montoFlexible(campoForm('total5').value),
    exenta: montoFlexible(campoForm('exenta').value),
    total: montoFlexible(campoForm('total').value),
    iva: montoFlexible(campoForm('iva').value),
    cdc: campoForm('cdc').value.replace(/\s/g, '')
  };
}

function validarFormulario() {
  const f = leerFormulario();
  const cli = clienteActual();
  const { ok, errores } = validarFactura(f, periodoActual(), cli ? cli.ruc : '');
  for (const c of CAMPOS_FORM) {
    const campo = campoForm(c).closest('.campo');
    campo.classList.toggle('error', !!errores[c]);
    campo.querySelector('small').textContent = errores[c] || '';
  }
  el.revErrores.textContent = ok ? '' : `Hay ${Object.keys(errores).length} dato(s) para corregir antes de confirmar.`;
  return { f, ok, errores };
}

function confirmarRevision() {
  if (!borrador || !listo()) return;
  const { f, ok, errores } = validarFormulario();
  if (!ok) {
    const primero = CAMPOS_FORM.find(c => errores[c]);
    if (primero) campoForm(primero).focus();
    avisar('Corrige los datos marcados en rojo.', 'err');
    return;
  }
  f.id = claveFactura(f);
  if (lista.some(x => x.id === f.id)) {
    respuesta(`Ya estaba registrada: ${f.numeroCompleto}`, 'warn');
    return;
  }
  const d = datosDeCdc(f.cdc);
  Object.assign(f, {
    tipoDoc: d ? d.tipoDoc : '',
    establecimiento: f.numeroCompleto.slice(0, 3),
    punto: f.numeroCompleto.slice(4, 7),
    numero: f.numeroCompleto.slice(8),
    clienteId,
    items: '', version: '', enlace: '', parametros: '',
    leidoEl: new Date().toISOString(),
    revisar: []
  });
  lista.push(f);
  guardarLista();
  cerrarHoja();
  render();
  respuesta(`Registrada ${f.numeroCompleto} · Gs. ${gs(f.total)}`, 'ok');
}

// Instalación como app (PWA)
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function pintarInstalacion() {
  const puede = !!eventoInstalar;
  el.btnInstalar.hidden = !puede;
  el.btnInstalar2.hidden = !puede;
  el.pasosIOS.hidden = !(esIOS && !instalada());
  if (instalada()) {
    el.appTitulo.textContent = 'App instalada';
    el.appTexto.textContent = 'Estás usando el lector como app. Funciona sin internet, también para guardar el Excel.';
  } else if (puede || esIOS) {
    el.appTexto.textContent = 'Instala el lector en la pantalla de inicio: abre sin barra del navegador y funciona sin internet.';
  } else {
    el.appTexto.textContent = 'Si no aparece el botón, abre el menú de Chrome (⋮) y elige "Instalar app" o "Agregar a la pantalla principal".';
  }
}

async function instalar() {
  if (!eventoInstalar) return;
  eventoInstalar.prompt();
  const r = await eventoInstalar.userChoice;
  eventoInstalar = null;
  pintarInstalacion();
  if (r.outcome === 'accepted') avisar('Instalando la app…', 'ok');
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  // Solo se recarga cuando el usuario pidió actualizar (no en la primera instalación)
  let pidioActualizar = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!pidioActualizar) return;
    pidioActualizar = false;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const avisarNueva = sw => {
      el.actualizar.hidden = false;
      el.btnActualizar.onclick = () => { pidioActualizar = true; el.actualizar.hidden = true; sw.postMessage('activar'); };
    };
    // Solo hay "versión nueva" si ya había una app controlando la página
    if (reg.waiting && navigator.serviceWorker.controller) avisarNueva(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarNueva(nuevo);
      });
    });
  }).catch(() => { /* sin service worker: la página sigue funcionando en línea */ });
}

function pintarSonido() {
  document.getElementById('icoSonido').innerHTML = sonidoOn ? ICO_SONIDO_ON : ICO_SONIDO_OFF;
}

// Eventos
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => mostrarVista(b.dataset.vista)));
el.btnCamara.addEventListener('click', () => (stream ? detenerCamara() : iniciarCamara()));
el.btnLinterna.addEventListener('click', alternarLinterna);
el.btnCambiar.addEventListener('click', cambiarCamara);
el.btnInstalar.addEventListener('click', instalar);
el.btnInstalar2.addEventListener('click', instalar);
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  eventoInstalar = e;
  pintarInstalacion();
});
window.addEventListener('appinstalled', () => {
  eventoInstalar = null;
  pintarInstalacion();
  avisar('App instalada en la pantalla de inicio.', 'ok');
});
el.btnZoom.addEventListener('click', () => {
  el.panelZoom.hidden = !el.panelZoom.hidden;
  el.btnZoom.classList.toggle('on', !el.panelZoom.hidden);
});
el.zoom.addEventListener('input', aplicarZoom);
el.btnSonido.addEventListener('click', () => {
  sonidoOn = !sonidoOn;
  escribirLS(KEY_SONIDO, sonidoOn ? '1' : '0');
  pintarSonido();
  if (sonidoOn) pitar('ok');
});
el.btnFoto.addEventListener('click', () => el.archivoFoto.click());
el.archivoFoto.addEventListener('change', () => {
  leerFoto(el.archivoFoto.files[0]);
  el.archivoFoto.value = '';
});
el.btnPegar.addEventListener('click', () => { abrirHoja(el.hojaEnlace); setTimeout(() => el.manual.focus(), 250); });
el.btnSinQR.addEventListener('click', abrirSinQR);
el.btnCliente.addEventListener('click', abrirClientes);
el.btnCancelarCli.addEventListener('click', cerrarHoja);
el.btnGuardarCli.addEventListener('click', guardarCliente);
el.cliLista.addEventListener('click', e => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  if (b.classList.contains('elegir')) elegirCliente(b.dataset.id);
  else if (b.classList.contains('editar')) editarCliente(b.dataset.id);
  else if (b.classList.contains('borrar-cli')) borrarCliente(b.dataset.id);
});
el.btnAMano.addEventListener('click', cargarAMano);
el.btnIACamara.addEventListener('click', () => el.fotoIACamara.click());
el.btnIAGaleria.addEventListener('click', () => el.fotoIAGaleria.click());
for (const input of [el.fotoIACamara, el.fotoIAGaleria]) {
  input.addEventListener('change', () => { leerConIA(input.files[0]); input.value = ''; });
}
el.btnCopiarPrompt.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(PROMPT_IA); avisar('Instrucciones copiadas. Pégalas en Gemini o Claude junto con la foto.', 'ok'); }
  catch { el.iaJson.value = PROMPT_IA; el.iaJson.select(); avisar('Copia el texto del cuadro manualmente.', 'info'); }
});
el.btnPegarJson.addEventListener('click', async () => {
  try { el.iaJson.value = await navigator.clipboard.readText(); } catch { avisar('Mantén pulsado el cuadro y elige Pegar.', 'info'); }
});
el.btnRevisarJson.addEventListener('click', revisarJsonPegado);
el.btnCancelarRev.addEventListener('click', cerrarHoja);
el.btnConfirmarRev.addEventListener('click', confirmarRevision);
el.hojaRevision.addEventListener('input', e => {
  const campo = e.target.closest('.campo');
  if (campo) campo.classList.remove('dudoso'); // el usuario ya lo revisó
  if (e.target.id === 'f_excluirConciliacion') excluirTocado = true;
  validarFormulario();
});
el.hojaRevision.addEventListener('change', e => {
  if (e.target.id === 'f_tipo' && !excluirTocado) $('f_excluirConciliacion').checked = excluirPorDefecto(e.target.value);
  if (e.target.id === 'f_excluirConciliacion') excluirTocado = true;
  // Al salir de un monto se muestra con separador de miles
  if (/^f_(total|total5|total10|exenta|iva)$/.test(e.target.id)) {
    const n = montoFlexible(e.target.value);
    if (n !== null) e.target.value = gs(n);
  }
  validarFormulario();
});
el.iaProveedor.addEventListener('change', () => pintarAjustesIA(el.iaProveedor.value));
el.btnGuardarIA.addEventListener('click', guardarAjustesIA);
el.btnBorrarClave.addEventListener('click', () => {
  const prov = el.iaProveedor.value;
  if (!KEY_CLAVE[prov] || !confirm(`¿Borrar la API key de ${NOMBRE_IA[prov]} de este celular?`)) return;
  try { localStorage.removeItem(KEY_CLAVE[prov]); } catch { /* sin almacenamiento */ }
  pintarAjustesIA(prov);
  avisar('API key borrada.', 'info');
});
el.fondoHoja.addEventListener('click', cerrarHoja);
el.btnPortapapeles.addEventListener('click', async () => {
  try { el.manual.value = await navigator.clipboard.readText(); } catch { avisar('Mantén pulsado el cuadro y elige Pegar.', 'info'); }
});
el.btnManual.addEventListener('click', () => {
  if (!el.manual.value.trim()) return;
  if (agregar(el.manual.value)) { el.manual.value = ''; cerrarHoja(); }
});
el.buscar.addEventListener('input', render);
el.tabla.addEventListener('change', e => {
  if (!e.target.classList.contains('excluir')) return;
  const f = lista.find(x => x.id === e.target.dataset.id);
  if (!f) return;
  f.excluirConciliacion = e.target.checked;
  guardarLista();
  render();
  avisar(f.excluirConciliacion ? `${f.numeroCompleto}: excluida de conciliación.` : `${f.numeroCompleto}: se concilia con Marangatu.`, 'info');
});
el.tabla.addEventListener('click', e => {
  const b = e.target.closest('.borrar');
  if (!b) return;
  const f = lista.find(x => x.id === b.dataset.id);
  if (!f || !confirm(`¿Borrar la factura ${f.numeroCompleto}?`)) return;
  lista = lista.filter(x => x.id !== f.id);
  guardarLista();
  render();
  avisar(`Factura ${f.numeroCompleto} borrada.`, 'info');
});
el.btnGuardar.addEventListener('click', guardarExcel);
el.btnBorrar.addEventListener('click', () => {
  const cli = clienteActual();
  if (!cli) return;
  if (!confirm(`¿Borrar todas las facturas de ${cli.nombre} en ${textoPeriodo(periodoActual())}?`)) return;
  lista = lista.filter(f => !(f.periodo === periodoActual() && f.clienteId === cli.id));
  guardarLista();
  render();
  avisar('Lista del período vacía.', 'info');
});
el.periodo.addEventListener('change', () => {
  escribirLS(KEY_PERIODO, periodoActual());
  render();
  avisar(`Período: ${textoPeriodo(periodoActual())}`, 'info');
});

(function init() {
  const hoy = new Date();
  el.periodo.value = leerLS(KEY_PERIODO) || `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  sonidoOn = leerLS(KEY_SONIDO) !== '0';
  camara = leerLS(KEY_CAMARA) === 'user' ? 'user' : 'environment';
  pintarInstalacion();
  registrarServiceWorker();
  pintarSonido();
  pintarAjustesIA();
  cargarLista();
  cargarClientes();
  guardarLista(); // guarda la migración de listas viejas
  render();
  if (!clientes.length) abrirClientes(); // primer uso: crear el primer cliente
})();
