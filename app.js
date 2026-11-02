const KEY_LISTA = 'lectorQR_lista';
const KEY_PERIODO = 'lectorQR_periodo';

const $ = id => document.getElementById(id);
const el = {
  periodo: $('periodo'), video: $('video'), btnCamara: $('btnCamara'), btnDetener: $('btnDetener'),
  estado: $('estado'), ultimo: $('ultimo'), manual: $('manual'), btnManual: $('btnManual'),
  contador: $('contador'), tabla: $('tabla'), btnCompartir: $('btnCompartir'), btnBorrar: $('btnBorrar'),
  resolucion: $('resolucion')
};

let lista = [];
let stream = null;
let timer = null;
let detector = null;
let ultimoTexto = '';
let ultimoMomento = 0;
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Errores de JavaScript visibles en pantalla
window.onerror = (msg, src, line) => setEstado('Error en la página: ' + msg + ' (línea ' + line + ')', true);

function setEstado(msg, esError = false) {
  el.estado.textContent = msg;
  el.estado.className = esError ? 'estado error' : 'estado';
}

function periodoActual() { return el.periodo.value; }

function cargarLista() {
  try { lista = JSON.parse(localStorage.getItem(KEY_LISTA) || '[]'); } catch { lista = []; }
}
function guardarLista() {
  try { localStorage.setItem(KEY_LISTA, JSON.stringify(lista)); } catch { /* sin almacenamiento: sigue en memoria */ }
}

function listaDelPeriodo() {
  return lista.filter(f => f.periodo === periodoActual());
}

function render() {
  const items = listaDelPeriodo();
  el.tabla.innerHTML = '';
  for (const f of items) {
    const div = document.createElement('div');
    div.className = 'fila';
    div.innerHTML = `<b>${f.numeroCompleto}</b> · ${f.fecha}<br>
      RUC ${f.rucEmisor} · Gs. ${f.total.toLocaleString('es-PY')} (IVA ${f.iva.toLocaleString('es-PY')})
      <div class="cdc">${f.cdc}</div>`;
    el.tabla.appendChild(div);
  }
  el.contador.textContent = `${items.length} factura(s) en ${periodoActual() || 'sin período'}`;
}

function agregar(texto) {
  if (!periodoActual()) { setEstado('Elige primero el período (mes).', true); return false; }
  const r = parsearEnlace(texto, periodoActual());
  if (!r.ok) {
    setEstado(r.error, true);
    if (r.periodoDistinto) el.ultimo.textContent = `Ignorada: ${r.factura.numeroCompleto} (${r.factura.fecha})`;
    return false;
  }
  if (lista.some(f => f.cdc === r.factura.cdc)) {
    setEstado(`Ya estaba registrada: ${r.factura.numeroCompleto}`);
    return false;
  }
  lista.push(r.factura);
  guardarLista();
  render();
  el.ultimo.textContent = `Última: ${r.factura.numeroCompleto} · Gs. ${r.factura.total.toLocaleString('es-PY')}`;
  setEstado('Registrada.');
  if (navigator.vibrate) navigator.vibrate(120);
  return true;
}

// Detección: nativa si existe (Chrome Android); si no, jsQR con el cuadro completo y luego el centro ampliado
async function detectarTexto() {
  if (detector) {
    const codigos = await detector.detect(el.video);
    return codigos.length ? codigos[0].rawValue : null;
  }
  if (typeof jsQR !== 'function') return null;
  const w = el.video.videoWidth, h = el.video.videoHeight;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(el.video, 0, 0, w, h);
  let code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
  if (code) return code.data;

  const cw = Math.round(w * 0.8), ch = Math.round(h * 0.8);
  const sx = Math.round((w - cw) / 2), sy = Math.round((h - ch) / 2);
  canvas.width = Math.round(cw * 1.5); canvas.height = Math.round(ch * 1.5);
  ctx.drawImage(el.video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return code ? code.data : null;
}

async function iniciarCamara() {
  if (!periodoActual()) { setEstado('Elige primero el período (mes).', true); return; }
  if (!window.isSecureContext || !navigator.mediaDevices) {
    setEstado('La cámara requiere HTTPS. Abre la página desde GitHub Pages, no como archivo local.', true);
    return;
  }
  const hayNativo = 'BarcodeDetector' in window;
  if (!hayNativo && typeof jsQR !== 'function') {
    setEstado('No se cargó el lector de QR (jsQR). Revisa la conexión y recarga.', true);
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
  } catch (e) {
    const motivo = { NotAllowedError: 'permiso denegado', NotFoundError: 'no hay cámara', NotReadableError: 'la cámara está en uso' }[e.name] || e.message;
    setEstado('No se pudo acceder a la cámara: ' + motivo + '.', true);
    return;
  }
  el.video.srcObject = stream;
  el.video.onloadedmetadata = () => {
    el.resolucion.textContent = `Cámara: ${el.video.videoWidth}×${el.video.videoHeight}`;
  };
  detector = hayNativo ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  el.btnCamara.disabled = true;
  el.btnDetener.disabled = false;
  setEstado('Escaneando… acerca el QR hasta que ocupe casi todo el recuadro.');

  timer = setInterval(async () => {
    if (el.video.readyState < 2) return;
    try {
      const texto = await detectarTexto();
      if (!texto) return;
      const ahora = Date.now();
      if (texto === ultimoTexto && ahora - ultimoMomento < 3000) return;
      ultimoTexto = texto;
      ultimoMomento = ahora;
      agregar(texto);
    } catch (e) {
      setEstado('Error al leer: ' + e.message, true);
    }
  }, 300);
}

function detenerCamara() {
  clearInterval(timer);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  el.video.srcObject = null;
  el.btnCamara.disabled = false;
  el.btnDetener.disabled = true;
  setEstado('Cámara detenida.');
}

// Excel en memoria: se entrega con el menú de compartir (Google Drive, etc.), sin descarga directa
async function compartirExcel() {
  const items = listaDelPeriodo();
  if (!items.length) { setEstado('No hay facturas en este período.', true); return; }
  if (typeof XLSX === 'undefined') { setEstado('No se cargó la librería de Excel. Revisa la conexión.', true); return; }

  const ws = XLSX.utils.json_to_sheet(items.map(aFilaExcel));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'QR');
  const datos = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const nombre = `QR_facturas_${periodoActual()}.xlsx`;
  const archivo = new File([datos], nombre, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      setEstado('Archivo enviado al menú de compartir. Elige Google Drive.');
    } catch (e) {
      if (e.name !== 'AbortError') setEstado('No se pudo compartir: ' + e.message, true);
    }
  } else {
    setEstado('Este navegador no permite compartir archivos. Usa Chrome en Android.', true);
  }
}

el.btnCamara.addEventListener('click', iniciarCamara);
el.btnDetener.addEventListener('click', detenerCamara);
el.btnManual.addEventListener('click', () => {
  if (el.manual.value.trim()) { agregar(el.manual.value); el.manual.value = ''; }
});
el.btnCompartir.addEventListener('click', compartirExcel);
el.btnBorrar.addEventListener('click', () => {
  if (!confirm(`¿Borrar las facturas de ${periodoActual()}?`)) return;
  lista = lista.filter(f => f.periodo !== periodoActual());
  guardarLista();
  render();
  setEstado('Lista del período vacía.');
});
el.periodo.addEventListener('change', () => {
  localStorage.setItem(KEY_PERIODO, periodoActual());
  render();
  setEstado(`Período: ${periodoActual()}`);
});

(function init() {
  const hoy = new Date();
  const guardado = localStorage.getItem(KEY_PERIODO);
  el.periodo.value = guardado || `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  cargarLista();
  render();
  setEstado('Listo. Elige el período y pulsa Iniciar cámara.');
})();
