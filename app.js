const KEY_LISTA = 'lectorQR_lista';
const KEY_PERIODO = 'lectorQR_periodo';
const KEY_SONIDO = 'lectorQR_sonido';

const $ = id => document.getElementById(id);
const el = {
  periodo: $('periodo'), periodoTexto: $('periodoTexto'), video: $('video'), vistaEscanear: $('vistaEscanear'),
  marco: $('marco'), btnCamara: $('btnCamara'), estado: $('estado'), resolucion: $('resolucion'),
  contadorFlotante: $('contadorFlotante'), totalFlotante: $('totalFlotante'),
  btnLinterna: $('btnLinterna'), btnZoom: $('btnZoom'), panelZoom: $('panelZoom'), zoom: $('zoom'), zoomMax: $('zoomMax'),
  btnSonido: $('btnSonido'), btnFoto: $('btnFoto'), archivoFoto: $('archivoFoto'), btnPegar: $('btnPegar'),
  contador: $('contador'), buscar: $('buscar'), tabla: $('tabla'), insignia: $('insignia'),
  expPeriodo: $('expPeriodo'), expCantidad: $('expCantidad'), expTotal: $('expTotal'), expIva: $('expIva'),
  btnCompartir: $('btnCompartir'), btnBorrar: $('btnBorrar'),
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

function textoPeriodo(p) {
  if (!/^\d{4}-\d{2}$/.test(p || '')) return 'Período';
  return `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
}

function cargarLista() {
  try { lista = JSON.parse(leerLS(KEY_LISTA) || '[]'); } catch { lista = []; }
}
function guardarLista() { escribirLS(KEY_LISTA, JSON.stringify(lista)); }

function listaDelPeriodo() {
  return lista.filter(f => f.periodo === periodoActual());
}

function render() {
  const items = listaDelPeriodo();
  const total = items.reduce((s, f) => s + (f.total || 0), 0);
  const iva = items.reduce((s, f) => s + (f.iva || 0), 0);
  const p = periodoActual();

  el.periodoTexto.textContent = textoPeriodo(p);
  el.contadorFlotante.textContent = items.length;
  el.totalFlotante.textContent = gs(total);
  el.insignia.textContent = items.length;
  el.insignia.hidden = items.length === 0;
  el.contador.textContent = `${items.length} factura(s) en ${textoPeriodo(p)} · Gs. ${gs(total)}`;
  el.expPeriodo.textContent = textoPeriodo(p);
  el.expCantidad.textContent = items.length;
  el.expTotal.textContent = gs(total);
  el.expIva.textContent = gs(iva);
  el.btnCompartir.disabled = items.length === 0;

  const q = el.buscar.value.trim().toLowerCase();
  const visibles = items
    .filter(f => !q || [f.numeroCompleto, f.rucEmisor, f.cdc].some(v => String(v).toLowerCase().includes(q)))
    .slice().reverse(); // la más reciente arriba

  if (!visibles.length) {
    el.tabla.innerHTML = `<div class="vacio"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
      <p>${items.length ? 'Ninguna factura coincide con la búsqueda.' : 'Todavía no hay facturas en este período.<br>Ve a Escanear para empezar.'}</p></div>`;
    return;
  }
  el.tabla.innerHTML = visibles.map(f => `
    <div class="tarjeta">
      <div class="avatar"><svg viewBox="0 0 24 24"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
      <div class="datos">
        <div class="fila1"><span class="num">${esc(f.numeroCompleto)}</span><span class="monto">Gs. ${gs(f.total)}</span></div>
        <div class="fila2">${esc(f.fecha)} · RUC ${esc(f.rucEmisor)}-${esc(f.dvEmisor)} · IVA ${gs(f.iva)}</div>
        <div class="cdc">${esc(f.cdc)}</div>
        <span class="etiqueta">Pendiente Marangatu</span>
      </div>
      <button class="borrar" data-cdc="${esc(f.cdc)}" aria-label="Borrar factura"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
    </div>`).join('');
}

function agregar(texto) {
  if (!periodoActual()) { respuesta('Elige primero el período (mes).', 'err'); return false; }
  const r = parsearEnlace(texto, periodoActual());
  if (!r.ok) {
    respuesta(r.periodoDistinto ? `Ignorada ${r.factura.numeroCompleto}: es de ${textoPeriodo(r.factura.periodo)}.` : r.error, 'err');
    return false;
  }
  if (lista.some(f => f.cdc === r.factura.cdc)) {
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
  if (!periodoActual()) { avisar('Elige primero el período (mes).', 'err'); return; }
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
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
  } catch (e) {
    const motivo = { NotAllowedError: 'permiso denegado', NotFoundError: 'no hay cámara', NotReadableError: 'la cámara está en uso' }[e.name] || e.message;
    avisar('No se pudo acceder a la cámara: ' + motivo + '.', 'err');
    return;
  }
  el.video.srcObject = stream;
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
  if (!periodoActual()) { avisar('Elige primero el período (mes).', 'err'); return; }
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

// Excel en memoria: se entrega con el menú de compartir (Google Drive, etc.), sin descarga directa
async function compartirExcel() {
  const items = listaDelPeriodo();
  if (!items.length) { avisar('No hay facturas en este período.', 'err'); return; }
  if (typeof XLSX === 'undefined') { avisar('No se cargó la librería de Excel. Revisa la conexión.', 'err'); return; }

  const ws = XLSX.utils.json_to_sheet(items.map(aFilaExcel));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'QR');
  const datos = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const nombre = `QR_facturas_${periodoActual()}.xlsx`;
  const archivo = new File([datos], nombre, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      avisar('Archivo enviado al menú de compartir. Elige Google Drive.', 'ok');
    } catch (e) {
      if (e.name !== 'AbortError') avisar('No se pudo compartir: ' + e.message, 'err');
    }
  } else {
    avisar('Este navegador no permite compartir archivos. Usa Chrome en Android.', 'err');
  }
}

// Navegación por pestañas; la cámara se apaga al salir de Escanear para ahorrar batería
function mostrarVista(id) {
  document.querySelectorAll('.vista').forEach(v => v.classList.toggle('activa', v.id === id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('activa', b.dataset.vista === id));
  if (id !== 'vistaEscanear' && stream) detenerCamara();
}

function abrirHoja() {
  el.fondoHoja.classList.add('abierta');
  el.hojaEnlace.classList.add('abierta');
  setTimeout(() => el.manual.focus(), 250);
}
function cerrarHoja() {
  el.fondoHoja.classList.remove('abierta');
  el.hojaEnlace.classList.remove('abierta');
}

function pintarSonido() {
  document.getElementById('icoSonido').innerHTML = sonidoOn ? ICO_SONIDO_ON : ICO_SONIDO_OFF;
}

// Eventos
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => mostrarVista(b.dataset.vista)));
el.btnCamara.addEventListener('click', () => (stream ? detenerCamara() : iniciarCamara()));
el.btnLinterna.addEventListener('click', alternarLinterna);
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
el.btnPegar.addEventListener('click', abrirHoja);
el.fondoHoja.addEventListener('click', cerrarHoja);
el.btnPortapapeles.addEventListener('click', async () => {
  try { el.manual.value = await navigator.clipboard.readText(); } catch { avisar('Mantén pulsado el cuadro y elige Pegar.', 'info'); }
});
el.btnManual.addEventListener('click', () => {
  if (!el.manual.value.trim()) return;
  if (agregar(el.manual.value)) { el.manual.value = ''; cerrarHoja(); }
});
el.buscar.addEventListener('input', render);
el.tabla.addEventListener('click', e => {
  const b = e.target.closest('.borrar');
  if (!b) return;
  const f = lista.find(x => x.cdc === b.dataset.cdc);
  if (!f || !confirm(`¿Borrar la factura ${f.numeroCompleto}?`)) return;
  lista = lista.filter(x => x.cdc !== f.cdc);
  guardarLista();
  render();
  avisar(`Factura ${f.numeroCompleto} borrada.`, 'info');
});
el.btnCompartir.addEventListener('click', compartirExcel);
el.btnBorrar.addEventListener('click', () => {
  if (!confirm(`¿Borrar todas las facturas de ${textoPeriodo(periodoActual())}?`)) return;
  lista = lista.filter(f => f.periodo !== periodoActual());
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
  pintarSonido();
  cargarLista();
  render();
})();
