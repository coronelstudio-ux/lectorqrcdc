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

// Lee un enlace del QR de e-Kuatia (DNIT, ex SET) y devuelve todos sus datos.
// periodoEsperado: "AAAA-MM". Si la factura es de otro mes, devuelve error de período.
function parsearEnlace(texto, periodoEsperado) {
  let url;
  try { url = new URL(String(texto).trim()); } catch { return { ok: false, error: 'No es un enlace válido.' }; }

  const p = url.searchParams;
  const cdc = p.get('Id') || '';
  if (!/^\d{44}$/.test(cdc)) return { ok: false, error: 'No corresponde a una factura electrónica DNIT.' };

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
    leidoEl: new Date().toISOString(),
    tipo: 'QR',
    origen: 'QR',
    excluirConciliacion: false,
    razonSocial: '',
    timbrado: '',
    condicion: '',
    total5: null,
    total10: null,
    exenta: null,
    revisar: []
  };
  factura.id = claveFactura(factura);

  if (periodoEsperado && periodo !== periodoEsperado) {
    return { ok: false, periodoDistinto: true, factura, error: `Factura de ${periodo}, fuera del período ${periodoEsperado}.` };
  }
  return { ok: true, factura };
}

// ---------- Facturas sin QR (lectura con IA o carga manual) ----------

const TIPOS = ['QR', 'Electrónica sin QR', 'Manual'];
const ORIGENES = ['QR', 'IA', 'Manual'];
const CAMPOS_IA = ['tipo', 'rucEmisor', 'dvEmisor', 'razonSocial', 'numeroCompleto', 'fecha', 'timbrado',
  'condicion', 'total5', 'total10', 'exenta', 'total', 'iva', 'cdc'];
const CAMPOS_MONTO = ['total5', 'total10', 'exenta', 'total', 'iva'];

// Valor por defecto de "Excluir de conciliación": las manuales no tienen CDC para cruzar con Marangatu
function excluirPorDefecto(tipo) { return tipo === 'Manual'; }

// Monto escrito por una persona o por la IA. "139.900" (solo puntos de miles) se lee como 139900;
// el resto se pasa a parseMonto sin cambiar su regla ("139.900,0000" o "1090.909091").
function montoFlexible(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let t = String(v).trim().replace(/\s/g, '').replace(/^gs\.?/i, '');
  if (t === '') return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^-?[\d.,]+$/.test(t)) return null;
  return parseMonto(t);
}

// "80012345-6", "80012345 - 6" o "80012345" (sin DV) -> { ruc, dv }
function separarRuc(txt) {
  const t = String(txt ?? '').replace(/\s/g, '');
  const m = t.match(/^(\d{1,8})(?:-(\d))?$/);
  return m ? { ruc: m[1], dv: m[2] ?? '' } : { ruc: t, dv: '' };
}

// "1-1-123" o "001001-0000123" -> "001-001-0000123"; null si no se puede
function formatearNumero(txt) {
  const t = String(txt ?? '').trim();
  const partes = t.split(/[-\s.\/]+/).filter(Boolean);
  if (partes.length === 3 && partes.every(p => /^\d+$/.test(p)) && partes[0].length <= 3 && partes[1].length <= 3 && partes[2].length <= 7) {
    return `${partes[0].padStart(3, '0')}-${partes[1].padStart(3, '0')}-${partes[2].padStart(7, '0')}`;
  }
  const d = t.replace(/\D/g, '');
  if (d.length === 13) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return null;
}

// "2026-11-02", "02/11/2026" o "02-11-2026" -> "2026-11-02"; null si no es una fecha real
function normalizarFecha(txt) {
  const t = String(txt ?? '').trim();
  let a, m, d;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) { [, a, m, d] = r; } else {
    r = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (!r) return null;
    [, d, m, a] = r;
  }
  const f = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(f + 'T00:00:00Z');
  return !isNaN(dt) && dt.toISOString().slice(0, 10) === f ? f : null;
}

function normalizarCondicion(txt) {
  const t = String(txt ?? '').trim().toLowerCase();
  if (t.startsWith('cont')) return 'Contado';
  if (t.startsWith('cr')) return 'Crédito';
  return '';
}

// Identificador único: CDC para electrónicas; número + RUC emisor + fecha + total para las demás
function claveFactura(f) {
  if (/^\d{44}$/.test(f.cdc || '')) return f.cdc;
  const ruc = String(f.rucEmisor || '').replace(/^0+/, '');
  return `${f.numeroCompleto}|${ruc}|${f.fecha}|${Math.round(Number(f.total) || 0)}`;
}

// Datos que se sacan del CDC (44 dígitos)
function datosDeCdc(cdc) {
  if (!/^\d{44}$/.test(cdc || '')) return null;
  return {
    tipoDoc: cdc.slice(0, 2),
    rucEmisor: cdc.slice(2, 10).replace(/^0+/, ''),
    dvEmisor: cdc.slice(10, 11),
    numeroCompleto: `${cdc.slice(11, 14)}-${cdc.slice(14, 17)}-${cdc.slice(17, 24)}`,
    fecha: `${cdc.slice(25, 29)}-${cdc.slice(29, 31)}-${cdc.slice(31, 33)}`
  };
}

// Revisa una factura cargada a mano o por IA. Devuelve { ok, errores: { campo: mensaje } }.
function validarFactura(f, periodo) {
  const errores = {};
  const ruc = `${f.rucEmisor ?? ''}-${f.dvEmisor ?? ''}`;
  if (!/^\d{1,8}-\d$/.test(ruc)) errores.rucEmisor = 'RUC con DV: formato 0000000-0.';
  if (!/^\d{3}-\d{3}-\d{7}$/.test(f.numeroCompleto || '')) errores.numeroCompleto = 'Formato 000-000-0000000.';
  if (!normalizarFecha(f.fecha)) errores.fecha = 'Fecha inválida.';
  else if (periodo && f.fecha.slice(0, 7) !== periodo) errores.fecha = `Fuera del período ${periodo}.`;
  if (!TIPOS.includes(f.tipo)) errores.tipo = 'Tipo inválido.';
  if (f.cdc && !/^\d{44}$/.test(f.cdc)) errores.cdc = 'El CDC tiene 44 dígitos.';

  const t5 = f.total5 ?? 0, t10 = f.total10 ?? 0, ex = f.exenta ?? 0;
  for (const c of CAMPOS_MONTO) {
    if (f[c] !== null && f[c] !== undefined && (typeof f[c] !== 'number' || !isFinite(f[c]) || f[c] < 0)) errores[c] = 'Monto inválido.';
  }
  if (typeof f.total !== 'number' || !(f.total > 0)) errores.total = 'Falta el total.';
  else if (!errores.total5 && !errores.total10 && !errores.exenta && Math.round(f.total) !== Math.round(t5 + t10 + ex)) {
    errores.total = `El total no coincide con 5 % + 10 % + exenta (${Math.round(t5 + t10 + ex)}).`;
  }
  // IVA incluido: 10 % = gravada / 11; 5 % = gravada / 21. Tolerancia de 1 Gs por cada tasa usada.
  const ivaEsperado = t10 / 11 + t5 / 21;
  const tolerancia = Math.max(1, (t10 > 0 ? 1 : 0) + (t5 > 0 ? 1 : 0));
  if (typeof f.iva !== 'number') errores.iva = 'Falta el IVA.';
  else if (!errores.iva && Math.abs(f.iva - ivaEsperado) > tolerancia) {
    errores.iva = `El IVA debería ser ${Math.round(ivaEsperado)} (10 %/11 + 5 %/21).`;
  }
  if (f.cdc && !errores.cdc) {
    const c = datosDeCdc(f.cdc);
    if (c.numeroCompleto !== f.numeroCompleto) errores.cdc = 'El número no coincide con el CDC.';
    else if (c.rucEmisor !== String(f.rucEmisor).replace(/^0+/, '')) errores.cdc = 'El RUC no coincide con el CDC.';
    else if (c.fecha !== f.fecha) errores.cdc = 'La fecha no coincide con el CDC.';
  }
  return { ok: Object.keys(errores).length === 0, errores };
}

// Convierte lo que devuelve la IA (JSON con las claves del esquema) en un borrador de factura.
// Nunca guarda: el usuario confirma en el formulario de revisión.
function normalizarIA(datos, origen = 'IA') {
  const d = datos && typeof datos === 'object' ? datos : {};
  const revisar = new Set((Array.isArray(d.revisar) ? d.revisar : []).filter(c => CAMPOS_IA.includes(c)));
  const texto = v => (v === null || v === undefined ? '' : String(v).trim());

  const cdc = texto(d.cdc).replace(/\s/g, '');
  let tipo = TIPOS.includes(d.tipo) && d.tipo !== 'QR' ? d.tipo : (/^\d{44}$/.test(cdc) ? 'Electrónica sin QR' : 'Manual');

  let { ruc, dv } = separarRuc(d.rucEmisor);
  if (texto(d.dvEmisor)) dv = texto(d.dvEmisor);
  ruc = ruc.replace(/^0+/, '');
  const numero = formatearNumero(d.numeroCompleto);
  const fecha = normalizarFecha(d.fecha);

  const f = {
    tipo, origen,
    excluirConciliacion: excluirPorDefecto(tipo),
    rucEmisor: ruc, dvEmisor: dv,
    razonSocial: texto(d.razonSocial),
    numeroCompleto: numero || texto(d.numeroCompleto),
    fecha: fecha || texto(d.fecha),
    periodo: fecha ? fecha.slice(0, 7) : '',
    timbrado: texto(d.timbrado).replace(/\s/g, ''),
    condicion: normalizarCondicion(d.condicion),
    cdc: /^\d{44}$/.test(cdc) ? cdc : (cdc ? cdc : ''),
    revisar: []
  };
  for (const c of CAMPOS_MONTO) {
    f[c] = montoFlexible(d[c]);
    if (d[c] !== null && d[c] !== undefined && d[c] !== '' && f[c] === null) revisar.add(c);
  }

  // Si hay CDC, completa lo que falte y marca lo que no coincida
  const c = datosDeCdc(f.cdc);
  if (c) {
    if (!f.rucEmisor) { f.rucEmisor = c.rucEmisor; f.dvEmisor = f.dvEmisor || c.dvEmisor; }
    if (!numero) f.numeroCompleto = c.numeroCompleto;
    if (!fecha) { f.fecha = c.fecha; f.periodo = c.fecha.slice(0, 7); }
  } else if (f.cdc) revisar.add('cdc');

  // Campos vacíos o con formato dudoso quedan resaltados
  if (!f.rucEmisor || !f.dvEmisor) revisar.add('rucEmisor');
  if (!numero && !c) revisar.add('numeroCompleto');
  if (!normalizarFecha(f.fecha)) revisar.add('fecha');
  if (f.total === null) revisar.add('total');
  if (f.iva === null) revisar.add('iva');
  if (f.total5 === null && f.total10 === null && f.exenta === null) { revisar.add('total5'); revisar.add('total10'); revisar.add('exenta'); }
  if (!f.timbrado) revisar.add('timbrado');
  if (!f.razonSocial) revisar.add('razonSocial');
  if (!f.condicion) revisar.add('condicion');

  f.revisar = [...revisar];
  return f;
}

// Completa una factura con los campos nuevos (para listas guardadas antes de esta versión)
function completarFactura(f) {
  const r = Object.assign({
    tipo: 'QR', origen: 'QR', razonSocial: '', timbrado: '', condicion: '',
    total5: null, total10: null, exenta: null, revisar: []
  }, f);
  if (typeof r.excluirConciliacion !== 'boolean') r.excluirConciliacion = excluirPorDefecto(r.tipo);
  if (!r.id) r.id = claveFactura(r);
  return r;
}

// Instrucciones para la IA (también se copian en el modo manual)
const PROMPT_IA = `Eres un lector de facturas de compra de Paraguay (DNIT). Lee la imagen y devuelve únicamente un objeto JSON, sin texto adicional y sin bloques de código, con estas claves:
- tipo: "Electrónica sin QR" si es un KuDE de factura electrónica (tiene CDC de 44 dígitos) o "Manual" si es una factura preimpresa.
- rucEmisor: RUC del emisor (el proveedor que vende, no el cliente), solo dígitos y sin DV.
- dvEmisor: dígito verificador del RUC del emisor.
- razonSocial: nombre o razón social del emisor.
- numeroCompleto: número de factura con formato 000-000-0000000.
- fecha: fecha de emisión con formato AAAA-MM-DD.
- timbrado: número de timbrado.
- condicion: "Contado" o "Crédito".
- total5: total gravado 5 % (IVA incluido).
- total10: total gravado 10 % (IVA incluido).
- exenta: total exento.
- total: total a pagar.
- iva: total del IVA (5 % + 10 %).
- cdc: CDC de 44 dígitos sin espacios, o null si no tiene.
- revisar: lista con los nombres de las claves que no se leen con claridad o de las que dudas.
Montos: números enteros en guaraníes, sin separadores de miles.
Si un campo no aparece en la factura, devuelve null. No estimes ni calcules valores que no estén impresos.`;

// Esquema JSON para pedir la respuesta estructurada (Claude)
const ESQUEMA_IA = (() => {
  const txt = { anyOf: [{ type: 'string' }, { type: 'null' }] };
  const num = { anyOf: [{ type: 'number' }, { type: 'null' }] };
  const props = {
    tipo: { anyOf: [{ type: 'string', enum: ['Electrónica sin QR', 'Manual'] }, { type: 'null' }] },
    rucEmisor: txt, dvEmisor: txt, razonSocial: txt, numeroCompleto: txt, fecha: txt, timbrado: txt,
    condicion: { anyOf: [{ type: 'string', enum: ['Contado', 'Crédito'] }, { type: 'null' }] },
    total5: num, total10: num, exenta: num, total: num, iva: num, cdc: txt,
    revisar: { type: 'array', items: { type: 'string', enum: CAMPOS_IA } }
  };
  return { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false };
})();

// Saca el objeto JSON de la respuesta de la IA (tolera ```json ... ``` o texto alrededor)
function extraerJson(texto) {
  const t = String(texto ?? '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('La respuesta no contiene JSON.');
  return JSON.parse(t.slice(i, j + 1));
}

// Fila para el Excel (nombres de columna en español). Las 17 primeras columnas mantienen su orden;
// las nuevas van al final para no romper el script de ContAdis.
function aFilaExcel(f) {
  const num = String(f.numeroCompleto || '');
  const n = (v) => (v === null || v === undefined ? '' : v);
  return {
    'CDC': f.cdc || '',
    'Número': num,
    'Fecha emisión': f.fecha,
    'Período': f.periodo,
    'Tipo doc': n(f.tipoDoc),
    'Establecimiento': f.establecimiento || num.slice(0, 3),
    'Punto': f.punto || num.slice(4, 7),
    'RUC emisor': f.rucEmisor,
    'DV emisor': f.dvEmisor,
    'RUC receptor': n(f.rucReceptor),
    'Total (Gs)': f.total,
    'IVA (Gs)': f.iva,
    'Ítems': n(f.items),
    'Versión XML': n(f.version),
    'Fecha de lectura': f.leidoEl,
    'Estado': 'Pendiente Marangatu',
    'Enlace QR': n(f.enlace),
    'Tipo': f.tipo || 'QR',
    'Excluir de conciliación': f.excluirConciliacion ? 'Sí' : 'No',
    'Origen de los datos': f.origen || 'QR',
    'Razón social': n(f.razonSocial),
    'Timbrado': n(f.timbrado),
    'Condición': n(f.condicion),
    'Gravada 5 %': n(f.total5),
    'Gravada 10 %': n(f.total10),
    'Exenta': n(f.exenta)
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseMonto, hexToStr, parsearEnlace, aFilaExcel,
    TIPOS, ORIGENES, CAMPOS_IA, PROMPT_IA, ESQUEMA_IA,
    excluirPorDefecto, montoFlexible, separarRuc, formatearNumero, normalizarFecha, normalizarCondicion,
    claveFactura, datosDeCdc, validarFactura, normalizarIA, completarFactura, extraerJson
  };
}
