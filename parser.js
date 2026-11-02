// Funciones puras: no tocan el DOM, así se pueden probar con Node.

// Montos: "139.900,0000" (punto = miles, coma = decimales) o "1090.909091"
function parseMonto(txt) {
  if (txt === null || txt === undefined || txt === '') return 0;
  let t = String(txt).trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return isNaN(n) ? 0 : n;
}

function hexToStr(hex) {
  let s = '';
  for (let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return s;
}

// Lee un enlace del QR de e-Kuatia (SET) y devuelve todos sus datos.
// periodoEsperado: "AAAA-MM". Si la factura es de otro mes, devuelve error de período.
function parsearEnlace(texto, periodoEsperado) {
  let url;
  try { url = new URL(String(texto).trim()); } catch { return { ok: false, error: 'No es un enlace válido.' }; }

  const p = url.searchParams;
  const cdc = p.get('Id') || '';
  if (!/^\d{44}$/.test(cdc)) return { ok: false, error: 'No corresponde a una factura electrónica SET.' };

  const fechaHex = p.get('dFeEmiDE') || '';
  const fecha = fechaHex
    ? hexToStr(fechaHex).slice(0, 10)
    : `${cdc.slice(25, 29)}-${cdc.slice(29, 31)}-${cdc.slice(31, 33)}`;
  const periodo = fecha.slice(0, 7);

  const parametros = {};
  for (const [k, v] of p.entries()) parametros[k] = v;

  const factura = {
    cdc,
    tipoDoc: cdc.slice(0, 2),
    rucEmisor: cdc.slice(2, 10),
    dvEmisor: cdc.slice(10, 11),
    establecimiento: cdc.slice(11, 14),
    punto: cdc.slice(14, 17),
    numero: cdc.slice(17, 24),
    numeroCompleto: `${cdc.slice(11, 14)}-${cdc.slice(14, 17)}-${cdc.slice(17, 24)}`,
    fecha,
    periodo,
    rucReceptor: p.get('dRucRec') || '',
    total: parseMonto(p.get('dTotGralOpe')),
    iva: parseMonto(p.get('dTotIVA')),
    items: p.get('cItems') || '',
    version: p.get('nVersion') || '',
    tipoEmision: cdc.slice(33, 34),
    codigoSeguridad: cdc.slice(34, 43),
    dvCdc: cdc.slice(43, 44),
    enlace: String(texto).trim(),
    parametros: JSON.stringify(parametros),
    leidoEl: new Date().toISOString()
  };

  if (periodoEsperado && periodo !== periodoEsperado) {
    return { ok: false, periodoDistinto: true, factura, error: `Factura de ${periodo}, fuera del período ${periodoEsperado}.` };
  }
  return { ok: true, factura };
}

// Fila para el Excel (nombres de columna en español, orden fijo)
function aFilaExcel(f) {
  return {
    'CDC': f.cdc,
    'Número': f.numeroCompleto,
    'Fecha emisión': f.fecha,
    'Período': f.periodo,
    'Tipo doc': f.tipoDoc,
    'Establecimiento': f.establecimiento,
    'Punto': f.punto,
    'RUC emisor': f.rucEmisor,
    'DV emisor': f.dvEmisor,
    'RUC receptor': f.rucReceptor,
    'Total (Gs)': f.total,
    'IVA (Gs)': f.iva,
    'Ítems': f.items,
    'Versión XML': f.version,
    'Fecha de lectura': f.leidoEl,
    'Estado': 'Pendiente Marangatu',
    'Enlace QR': f.enlace
  };
}

if (typeof module !== 'undefined') {
  module.exports = { parseMonto, hexToStr, parsearEnlace, aFilaExcel };
}
