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
// rucCliente (opcional): RUC del cliente elegido. Si el RUC receptor (dRucRec) no coincide, se rechaza.
function parsearEnlace(texto, periodoEsperado, rucCliente) {
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
  if (rucCliente && !rucCoincide(factura.rucReceptor, rucCliente)) {
    const error = factura.rucReceptor
      ? `Factura de otro cliente (RUC receptor ${factura.rucReceptor}).`
      : 'La factura no tiene RUC receptor: no corresponde al cliente elegido.';
    return { ok: false, rucDistinto: true, factura, error };
  }
  return { ok: true, factura };
}

// ---------- Facturas sin QR (lectura con IA o carga manual) ----------

const TIPOS = ['QR', 'Electrónica sin QR', 'Manual'];
const ORIGENES = ['QR', 'IA', 'Manual'];
const CAMPOS_IA = ['tipo', 'rucEmisor', 'dvEmisor', 'razonSocial', 'rucReceptor', 'numeroCompleto', 'fecha', 'timbrado',
  'condicion', 'total5', 'total10', 'exenta', 'total', 'iva', 'cdc', 'cuenta', 'descripcion'];

// ---------- Cuentas de ContAdis (solo las que puede llevar una factura de compra) ----------
// [Id de ContAdis, texto exacto]. El texto se copia tal cual de ContAdis, incluidos los nombres
// cortados (182 y 184). El Excel lleva solo el texto; el Id queda aquí como referencia.
// Nombres repetidos en ContAdis (79/80, 81-82/16-17, 193/201) se incluyen una sola vez.
const CUENTAS_COMPRA = [
  { grupo: 'Mercaderías e inventario', cuentas: [
    [67, 'MERCADERÍAS GRAVADAS POR EL IVA AL 10%'],
    [68, 'MERCADERÍAS GRAVADAS POR EL IVA AL 5%'],
    [69, 'MERCADERÍAS EXENTAS DEL IVA'],
    [70, 'MERCADERÍAS RÉGIMEN DE TURISMO'],
    [71, 'MERCADERÍAS ZONA FRANCA'],
    [72, 'MERCADERÍAS RÉGIMEN DE MAQUILA'],
    [73, 'MERCADERÍAS OTROS REGÍMENES ESPECIALES'],
    [77, 'MATERIAS PRIMAS'],
    [78, 'MATERIALES, SUMINISTROS Y REPUESTOS'],
    [79, 'PRODUCTOS AGRÍCOLAS'],
    [81, 'ACTIVOS BIOLÓGICOS EN PRODUCCIÓN'],
    [82, 'ACTIVOS BIOLÓGICOS EN DESARROLLO'],
    [83, 'IMPORTACIONES EN CURSO']
  ] },
  { grupo: 'Activo fijo', cuentas: [
    [91, 'INMUEBLES'],
    [92, 'RODADOS/TRANSPORTES'],
    [93, 'MUEBLES, ÚTILES Y ENSERES'],
    [94, 'MAQUINARIAS'],
    [95, 'EQUIPOS'],
    [96, 'HERRAMIENTAS'],
    [98, 'MEJORAS EN PREDIO AJENO'],
    [99, 'BIENES INCORPORADOS AL AMPARO DE LA LEY Nº 60/90']
  ] },
  { grupo: 'Intangibles y cargos diferidos', cuentas: [
    [103, 'GASTOS DE CONSTITUCIÓN'],
    [104, 'GASTOS DE ORGANIZACIÓN'],
    [105, 'GASTOS DE DESARROLLO'],
    [106, 'GASTOS DE PROYECTOS DE INVERSIÓN'],
    [108, 'LICENCIAS, MARCAS Y PATENTES'],
    [109, 'FRANQUICIAS']
  ] },
  { grupo: 'Pagos por adelantado', cuentas: [
    [9, 'ALQUILERES PAGADOS POR ADELANTADO'],
    [10, 'SEGUROS A DEVENGAR']
  ] },
  { grupo: 'Costos', cuentas: [
    [155, 'COSTO DE MERCADERÍAS GRAVADAS POR EL IVA'],
    [156, 'COSTO DE MERCADERÍAS EXENTAS DEL IVA'],
    [157, 'COSTO DE VENTAS DE SOJA Y SUS DERIVADOS'],
    [158, 'COSTO DE VENTAS DE MAÍZ'],
    [159, 'COSTO DE VENTAS DE TRIGO'],
    [160, 'COSTO DE VENTAS DE OTROS PRODUCTOS AGRÍCOLAS'],
    [161, 'COSTO DE VENTAS DE GANADO'],
    [162, 'COSTO DE VENTAS DE PRODUCTOS FRUTÍCOLAS Y HORTÍCOLAS'],
    [163, 'COSTO DE VENTAS DE PRODUCTOS DE LA EXPLOTACIÓN FORESTAL'],
    [164, 'COSTO DE EXPORTACIONES A EMPRESAS VINCULADAS'],
    [165, 'COSTO DE EXPORTACIONES A TERCEROS NO VINCULADOS'],
    [166, 'COSTO DE OTROS PRODUCTOS AGRÍCOLAS EXPORTADOS'],
    [167, 'COSTO DE PRODUCTOS FARMACÉUTICOS EXPORTADOS'],
    [168, 'COSTO DE MAQUINARIAS Y EQUIPOS EXPORTADOS'],
    [169, 'COSTO DE OTROS PRODUCTOS INDUSTRIALIZADOS EXPORTADOS'],
    [170, 'COSTO DE OTROS PRODUCTOS EXPORTADOS'],
    [171, 'COSTO DE SERVICIOS GRAVADOS'],
    [172, 'COSTO DE VENTAS A EXTRANJEROS'],
    [173, 'COSTO DE VENTAS A DISTRIBUIDORES LOCALES'],
    [174, 'COSTO DE VENTAS A CLIENTES LOCALES'],
    [175, 'COSTO DE MERCADERÍAS - ZONA FRANCA'],
    [176, 'COSTO DE VENTAS POR RÉGIMEN DE MAQUILA'],
    [177, 'COSTO DE VENTAS BAJO OTROS REGÍMENES ESPECIALES'],
    [178, 'COSTO DE VENTAS EXENTAS DEL IVA'],
    [182, '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DEL SECTOR AG'],
    [183, '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE GANADO'],
    [184, '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DE LA ACTIVID']
  ] },
  { grupo: 'Gastos de ventas', cuentas: [
    [193, 'OTROS BENEFICIOS AL PERSONAL'],
    [194, 'COMISIONES PAGADAS SOBRE VENTAS'],
    [195, 'VIÁTICOS A VENDEDORES'],
    [196, 'PUBLICIDAD Y PROPAGANDA'],
    [197, 'FLETES PAGADOS'],
    [198, 'OTROS GASTOS DE VENTAS']
  ] },
  { grupo: 'Gastos de administración', cuentas: [
    [203, 'GASTOS DE REPRESENTACIÓN'],
    [204, 'HONORARIOS PERSONALES'],
    [205, 'ALQUILERES'],
    [206, 'AGUA, LUZ, TELÉFONO E INTERNET'],
    [207, 'MOVILIDAD'],
    [208, 'COMBUSTIBLES Y LUBRICANTES'],
    [209, 'REPARACIONES Y MANTENIMIENTOS'],
    [210, 'SEGUROS PAGADOS'],
    [211, 'ÚTILES DE OFICINA']
  ] },
  { grupo: 'Gastos financieros y otros', cuentas: [
    [212, 'GASTOS PAGADOS EN EL EXTERIOR'],
    [213, 'JUICIOS Y GASTOS JUDICIALES'],
    [214, 'GASTOS DE COBRANZAS'],
    [215, 'DONACIONES Y CONTRIBUCIONES'],
    [216, 'COMISIONES Y GASTOS BANCARIOS OPERACIONALES'],
    [217, 'IMPUESTOS, PATENTES, TASAS Y OTRAS CONTRIBUCIONES'],
    [218, 'MULTAS Y SANCIONES'],
    [219, 'INTERESES PAGADOS A ENTIDADES BANCARIAS Y FINANCIERAS'],
    [220, 'OTROS INTERESES PAGADOS'],
    [221, 'COMISIONES Y GASTOS BANCARIOS SOBRE OPERACIONES ACREDITICIAS']
  ] }
];
const CUENTAS = CUENTAS_COMPRA.flatMap(g => g.cuentas.map(c => c[1]));
const ID_CUENTA = Object.fromEntries(CUENTAS_COMPRA.flatMap(g => g.cuentas.map(c => [c[1], c[0]])));
// Mercaderías para reventa: inventario según la tasa con mayor monto
const MERCADERIAS_POR_TASA = {
  total10: 'MERCADERÍAS GRAVADAS POR EL IVA AL 10%',
  total5: 'MERCADERÍAS GRAVADAS POR EL IVA AL 5%',
  exenta: 'MERCADERÍAS EXENTAS DEL IVA'
};
// Textos usados en versiones anteriores de la app -> texto actual de ContAdis
const CUENTAS_RENOMBRADAS = {
  'COMBUSTIBLES Y LUBRICANES': 'COMBUSTIBLES Y LUBRICANTES',
  '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DEL SECTOR AGROPECUARIO': '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DEL SECTOR AG',
  '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DE LA ACTIVIDAD': '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DE LA ACTIVID'
};
// ---------- Cuentas de ContAdis para ventas (facturas emitidas por el cliente) ----------
// Fuera: 153/154 (descuentos y devoluciones, van en notas de crédito), 188/189 y 51/52 (Sector Público).
// 179 y 181 van cortados como en ContAdis.
const CUENTAS_VENTA = [
  { grupo: 'Mercaderías y servicios', cuentas: [
    [135, 'VENTAS DE MERCADERÍAS GRAVADAS POR EL IVA'],
    [136, 'VENTAS DE MERCADERÍAS EXENTAS DEL IVA'],
    [40, 'OTRAS VENTAS EXENTAS DEL IVA'],
    [134, 'VENTAS DE SERVICIOS GRAVADOS'],
    [149, 'VENTAS A CLIENTES LOCALES'],
    [148, 'VENTAS A DISTRIBUIDORES LOCALES'],
    [147, 'VENTAS A EXTRANJEROS']
  ] },
  { grupo: 'Productos agropecuarios', cuentas: [
    [130, 'VENTAS DE GANADO'],
    [131, 'VENTAS DE PRODUCTOS FRUTÍCOLAS Y HORTÍCOLAS'],
    [132, 'VENTAS DE PRODUCTOS DE LA EXPLOTACIÓN FORESTAL'],
    [137, 'VENTAS DE SOJA Y SUS DERIVADOS'],
    [138, 'VENTAS DE MAÍZ'],
    [139, 'VENTAS DE TRIGO'],
    [140, 'OTROS PRODUCTOS AGRÍCOLAS'],
    [179, 'INGRESOS POR PRODUCCIÓN Y/O TENENCIA DE BIENES DEL SECTOR AG'],
    [180, 'INGRESOS POR PRODUCCIÓN Y/O TENENCIA DE GANADO'],
    [181, 'INGSOS POR PRODUCCIÓN Y/O TENENCIA DE BIENES DE LA ACTIVIDA']
  ] },
  { grupo: 'Exportaciones', cuentas: [
    [133, 'EXPORTACIONES DE OTROS PRODUCTOS'],
    [141, 'EXPORTACIONES A EMPRESAS VINCULADAS'],
    [142, 'EXPORTACIONES A TERCEROS NO VINCULADOS'],
    [143, 'EXPORTACIONES DE OTROS PRODUCTOS AGRÍCOLAS'],
    [144, 'EXPORTACIONES DE PRODUCTOS FARMACÉUTICOS'],
    [145, 'EXPORTACIONES DE MAQUINARIAS Y EQUIPOS'],
    [146, 'EXPORTACIONES DE OTROS PRODUCTOS INDUSTRIALES']
  ] },
  { grupo: 'Regímenes especiales', cuentas: [
    [150, 'VENTAS DE MERCADERÍAS - ZONA FRANCA'],
    [151, 'VENTAS POR RÉGIMEN DE MAQUILA'],
    [152, 'VENTAS BAJO OTROS REGÍMENES ESPECIALES']
  ] },
  { grupo: 'Otros ingresos', cuentas: [
    [186, 'INTERESES GANADOS'],
    [187, 'COMISIONES COBRADAS'],
    [227, 'UTILIDAD/PÉRDIDA EN VENTA DE ACTIVOS FIJOS']
  ] }
];
const CUENTAS_VENTAS = CUENTAS_VENTA.flatMap(g => g.cuentas.map(c => c[1]));
Object.assign(ID_CUENTA, Object.fromEntries(CUENTAS_VENTA.flatMap(g => g.cuentas.map(c => [c[1], c[0]]))));
const OPERACIONES = ['compra', 'venta'];
const esVenta = f => f && f.operacion === 'venta';
const gruposCuentas = op => (op === 'venta' ? CUENTAS_VENTA : CUENTAS_COMPRA);
const cuentasDe = op => (op === 'venta' ? CUENTAS_VENTAS : CUENTAS);
// Venta a consumidor final (innominado de la DNIT)
const CONSUMIDOR_FINAL = { ruc: '44444401', dv: '7', razonSocial: 'SIN NOMBRE' };
const CAMPOS_IA_VENTA = [...CAMPOS_IA, 'dvReceptor', 'razonSocialReceptor'];

const MAX_DESCRIPCION = 60;

const sinAcentos = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
// Devuelve la cuenta exacta del listado (sin importar mayúsculas, acentos ni espacios) o '' si no está
function normalizarCuenta(txt, operacion = 'compra') {
  const t = sinAcentos(txt);
  if (!t) return '';
  if (operacion !== 'venta') {
    const viejo = Object.keys(CUENTAS_RENOMBRADAS).find(v => sinAcentos(v) === t);
    if (viejo) return CUENTAS_RENOMBRADAS[viejo];
  }
  return cuentasDe(operacion).find(c => sinAcentos(c) === t) || '';
}

// Si la cuenta es de mercaderías por tasa (10 %, 5 % o exentas), elige la tasa con mayor monto
function cuentaMercaderiaPorTasa(f) {
  const tasas = Object.values(MERCADERIAS_POR_TASA);
  if (!tasas.includes(f.cuenta)) return f.cuenta;
  const montos = Object.keys(MERCADERIAS_POR_TASA).map(k => [k, Number(f[k]) || 0]);
  const [mayor, monto] = montos.reduce((a, b) => (b[1] > a[1] ? b : a));
  return monto > 0 ? MERCADERIAS_POR_TASA[mayor] : f.cuenta;
}
function normalizarDescripcion(txt) {
  return String(txt ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, MAX_DESCRIPCION);
}

// Datos obligatorios para ContAdis que no trae el QR: timbrado, cuenta y descripción.
// opciones.timbrados: timbrados de venta registrados del cliente (en ventas el timbrado debe ser uno de ellos).
function validarComplementos(f, opciones = {}) {
  const errores = {};
  if (!/^\d{8}$/.test(String(f.timbrado ?? ''))) errores.timbrado = 'El timbrado tiene 8 dígitos.';
  else if (esVenta(f)) {
    const t = opciones.timbrados || [];
    if (!t.length) errores.timbrado = 'Registra el timbrado de venta en el perfil del cliente.';
    else if (!t.includes(String(f.timbrado))) errores.timbrado = 'No es un timbrado registrado del cliente.';
  }
  if (!cuentasDe(f.operacion).includes(f.cuenta)) errores.cuenta = 'Elige la cuenta.';
  const d = String(f.descripcion ?? '').trim();
  if (!d) errores.descripcion = 'Falta la descripción.';
  else if (d.length > MAX_DESCRIPCION) errores.descripcion = `Máximo ${MAX_DESCRIPCION} caracteres.`;
  return errores;
}
// Lista de datos que le faltan a una factura para poder generar el Excel
function faltantes(f, opciones = {}) {
  const nombres = { timbrado: 'timbrado', cuenta: 'cuenta', descripcion: 'descripción' };
  return Object.keys(validarComplementos(f, opciones)).map(c => nombres[c]);
}

// ---------- Memoria por proveedor (para sugerir sin gastar IA) ----------
// { timbrados: { rucEmisor: '12345678' }, cuentas: { clienteId: { rucEmisor: { cuenta, descripcion } } } }
function memoriaVacia() { return { timbrados: {}, cuentas: {}, ventas: {} }; }
function sugerenciaProveedor(memoria, clienteId, rucEmisor) {
  const m = memoria || memoriaVacia();
  const ruc = String(rucEmisor ?? '').replace(/^0+/, '');
  const c = ((m.cuentas || {})[clienteId] || {})[ruc] || {};
  return { timbrado: (m.timbrados || {})[ruc] || '', cuenta: normalizarCuenta(c.cuenta), descripcion: c.descripcion || '' };
}
// Ventas: cuenta y descripción por cliente y comprador, con lo último usado del cliente como respaldo
function sugerenciaVenta(memoria, clienteId, rucReceptor) {
  const v = ((memoria || {}).ventas || {})[clienteId] || {};
  const c = v[rucBase(rucReceptor)] || v._ultimo || {};
  return { cuenta: normalizarCuenta(c.cuenta, 'venta'), descripcion: c.descripcion || '' };
}
function recordarVenta(memoria, clienteId, f) {
  const m = memoria && memoria.timbrados ? memoria : memoriaVacia();
  m.ventas = m.ventas || {};
  if (!clienteId || !CUENTAS_VENTAS.includes(f.cuenta)) return m;
  const dato = { cuenta: f.cuenta, descripcion: normalizarDescripcion(f.descripcion) };
  m.ventas[clienteId] = m.ventas[clienteId] || {};
  m.ventas[clienteId]._ultimo = dato;
  const r = rucBase(f.rucReceptor);
  if (r) m.ventas[clienteId][r] = dato;
  return m;
}
function recordarProveedor(memoria, clienteId, f) {
  const m = memoria && memoria.timbrados ? memoria : memoriaVacia();
  m.cuentas = m.cuentas || {};
  m.ventas = m.ventas || {};
  const ruc = String(f.rucEmisor ?? '').replace(/^0+/, '');
  if (!ruc) return m;
  if (/^\d{8}$/.test(String(f.timbrado ?? ''))) m.timbrados[ruc] = String(f.timbrado);
  if (clienteId && CUENTAS.includes(f.cuenta)) {
    m.cuentas[clienteId] = m.cuentas[clienteId] || {};
    m.cuentas[clienteId][ruc] = { cuenta: f.cuenta, descripcion: normalizarDescripcion(f.descripcion) };
  }
  return m;
}

// ---------- Clientes (contribuyentes que atiende el usuario) ----------

// RUC sin DV y sin ceros a la izquierda: "80012345-6" y "080012345" -> "80012345"
function rucBase(r) {
  return String(r ?? '').replace(/\s/g, '').split('-')[0].replace(/\D/g, '').replace(/^0+/, '');
}
// Compara dos RUC sin importar el DV ni los ceros a la izquierda
function rucCoincide(a, b) {
  const x = rucBase(a), y = rucBase(b);
  return x !== '' && x === y;
}

// Revisa los datos de un cliente. Devuelve { ok, errores: { campo: mensaje } }.
function validarCliente(c, otros = []) {
  const errores = {};
  if (String(c.actividades ?? '').length > 500) errores.actividades = 'Máximo 500 caracteres.';
  if ((c.timbradosVenta || []).some(t => !/^\d{8}$/.test(t))) errores.timbradosVenta = 'Cada timbrado tiene 8 dígitos (sepáralos con coma).';
  if (String(c.nombreArchivo ?? '').length > 40) errores.nombreArchivo = 'Máximo 40 caracteres.';
  if (!String(c.nombre ?? '').trim()) errores.nombre = 'Falta el nombre.';
  if (!/^\d{1,8}-\d$/.test(`${c.ruc ?? ''}-${c.dv ?? ''}`)) errores.ruc = 'RUC con DV: formato 0000000-0.';
  else if (otros.some(o => o.id !== c.id && rucCoincide(o.ruc, c.ruc))) errores.ruc = 'Ya existe un cliente con ese RUC.';
  return { ok: Object.keys(errores).length === 0, errores };
}
// "12345678, 87654321" -> ['12345678', '87654321'] (sin repetidos)
function separarTimbrados(txt) {
  return [...new Set(String(txt ?? '').split(/[\s,;]+/).map(t => t.replace(/\D/g, '')).filter(Boolean))];
}

// Nombre corto para los archivos: el campo del cliente o las dos primeras palabras de su nombre.
// Sin acentos ni símbolos: "José Pérez S.A." -> "Jose_Perez"
function nombreParaArchivo(c) {
  const base = String((c && (c.nombreArchivo || c.nombre)) || '').trim();
  const palabras = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const elegidas = c && c.nombreArchivo ? palabras : palabras.slice(0, 2);
  return elegidas.join('_') || 'Cliente';
}
// Compras_Juan_Perez_2026-11.xlsx / Ventas_Juan_Perez_2026-11.xlsx
function nombreArchivoExcel(c, operacion, periodo) {
  return `${operacion === 'venta' ? 'Ventas' : 'Compras'}_${nombreParaArchivo(c)}_${periodo}.xlsx`;
}

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
// En ventas lleva el prefijo "V|": una misma factura puede ser venta de un cliente y compra de otro.
function claveFactura(f) {
  const pre = esVenta(f) ? 'V|' : '';
  if (/^\d{44}$/.test(f.cdc || '')) return pre + f.cdc;
  const ruc = String(f.rucEmisor || '').replace(/^0+/, '');
  return `${pre}${f.numeroCompleto}|${ruc}|${f.fecha}|${Math.round(Number(f.total) || 0)}`;
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
// rucCliente (opcional): RUC del cliente elegido. Compras: el RUC receptor debe ser el del cliente.
// Ventas: el RUC emisor debe ser el del cliente y el comprador lleva RUC con DV (o consumidor final).
// opciones.timbrados: timbrados de venta registrados del cliente.
function validarFactura(f, periodo, rucCliente, opciones = {}) {
  const errores = {};
  if (esVenta(f)) {
    if (rucCliente && !rucCoincide(f.rucEmisor, rucCliente)) errores.rucEmisor = 'En una venta el emisor debe ser el cliente elegido.';
    if (!/^\d{1,8}-\d$/.test(`${f.rucReceptor ?? ''}-${f.dvReceptor ?? ''}`)) errores.rucReceptor = 'RUC del comprador con DV (o marca consumidor final).';
    if (!String(f.razonSocialReceptor ?? '').trim()) errores.razonSocialReceptor = 'Falta la razón social del comprador.';
  } else if (rucCliente) {
    if (!rucBase(f.rucReceptor)) errores.rucReceptor = 'Falta el RUC receptor (cliente).';
    else if (!rucCoincide(f.rucReceptor, rucCliente)) errores.rucReceptor = 'El RUC receptor no es el del cliente elegido.';
  }
  const ruc = `${f.rucEmisor ?? ''}-${f.dvEmisor ?? ''}`;
  if (!errores.rucEmisor && !/^\d{1,8}-\d$/.test(ruc)) errores.rucEmisor = 'RUC con DV: formato 0000000-0.';
  if (!/^\d{3}-\d{3}-\d{7}$/.test(f.numeroCompleto || '')) errores.numeroCompleto = 'Formato 000-000-0000000.';
  if (!normalizarFecha(f.fecha)) errores.fecha = 'Fecha inválida.';
  else if (periodo && f.fecha.slice(0, 7) !== periodo) errores.fecha = `Fuera del período ${periodo}.`;
  if (!TIPOS.includes(f.tipo)) errores.tipo = 'Tipo inválido.';
  Object.assign(errores, validarComplementos(f, opciones));
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
function normalizarIA(datos, origen = 'IA', operacion = 'compra') {
  const d = datos && typeof datos === 'object' ? datos : {};
  const venta = operacion === 'venta';
  const campos = venta ? CAMPOS_IA_VENTA : CAMPOS_IA;
  const revisar = new Set((Array.isArray(d.revisar) ? d.revisar : []).filter(c => campos.includes(c)));
  const texto = v => (v === null || v === undefined ? '' : String(v).trim());

  const cdc = texto(d.cdc).replace(/\s/g, '');
  let tipo = TIPOS.includes(d.tipo) && d.tipo !== 'QR' ? d.tipo : (/^\d{44}$/.test(cdc) ? 'Electrónica sin QR' : 'Manual');

  let { ruc, dv } = separarRuc(d.rucEmisor);
  if (texto(d.dvEmisor)) dv = texto(d.dvEmisor);
  ruc = ruc.replace(/^0+/, '');
  const numero = formatearNumero(d.numeroCompleto);
  const fecha = normalizarFecha(d.fecha);

  const receptor = separarRuc(d.rucReceptor);
  const f = {
    operacion: venta ? 'venta' : 'compra',
    tipo, origen,
    excluirConciliacion: excluirPorDefecto(tipo),
    rucEmisor: ruc, dvEmisor: dv,
    razonSocial: texto(d.razonSocial),
    numeroCompleto: numero || texto(d.numeroCompleto),
    fecha: fecha || texto(d.fecha),
    periodo: fecha ? fecha.slice(0, 7) : '',
    rucReceptor: rucBase(d.rucReceptor),
    cuenta: normalizarCuenta(d.cuenta, operacion),
    descripcion: normalizarDescripcion(d.descripcion),
    timbrado: texto(d.timbrado).replace(/\s/g, ''),
    condicion: normalizarCondicion(d.condicion),
    cdc: /^\d{44}$/.test(cdc) ? cdc : (cdc ? cdc : ''),
    revisar: []
  };
  for (const c of CAMPOS_MONTO) {
    f[c] = montoFlexible(d[c]);
    if (d[c] !== null && d[c] !== undefined && d[c] !== '' && f[c] === null) revisar.add(c);
  }
  if (venta) {
    f.rucReceptor = receptor.ruc.replace(/^0+/, '');
    f.dvReceptor = texto(d.dvReceptor) || receptor.dv;
    f.razonSocialReceptor = texto(d.razonSocialReceptor).toUpperCase();
  } else {
    f.cuenta = cuentaMercaderiaPorTasa(f);
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
  if (!venta && !f.razonSocial) revisar.add('razonSocial');
  if (venta && (!f.dvReceptor || !f.razonSocialReceptor)) revisar.add('rucReceptor');
  if (!f.condicion) revisar.add('condicion');
  if (!f.rucReceptor) revisar.add('rucReceptor');
  if (!f.cuenta) revisar.add('cuenta');
  if (!f.descripcion) revisar.add('descripcion');
  if (f.timbrado && !/^\d{8}$/.test(f.timbrado)) revisar.add('timbrado');

  f.revisar = [...revisar];
  return f;
}

// Completa una factura con los campos nuevos (para listas guardadas antes de esta versión)
function completarFactura(f) {
  const r = Object.assign({
    tipo: 'QR', origen: 'QR', razonSocial: '', timbrado: '', condicion: '',
    total5: null, total10: null, exenta: null, revisar: [], clienteId: '', cuenta: '', descripcion: '',
    operacion: 'compra'
  }, f);
  if (!OPERACIONES.includes(r.operacion)) r.operacion = 'compra';
  if (typeof r.excluirConciliacion !== 'boolean') r.excluirConciliacion = excluirPorDefecto(r.tipo);
  if (r.cuenta) r.cuenta = normalizarCuenta(r.cuenta, r.operacion) || r.cuenta; // textos de versiones anteriores
  if (!r.id) r.id = claveFactura(r);
  return r;
}

// Instrucciones para la IA (también se copian en el modo manual).
// Lleva el listado de cuentas de compra y las actividades del cliente para elegir la cuenta.
function armarPromptIA(actividades) {
  const act = String(actividades ?? '').trim() || 'no informadas';
  return `Eres un lector de facturas de compra de Paraguay (DNIT). Lee la imagen y devuelve únicamente un objeto JSON, sin texto adicional y sin bloques de código, con estas claves:
- tipo: "Electrónica sin QR" si es un KuDE de factura electrónica (tiene CDC de 44 dígitos) o "Manual" si es una factura preimpresa.
- rucEmisor: RUC del emisor (el proveedor que vende, no el cliente), solo dígitos y sin DV.
- dvEmisor: dígito verificador del RUC del emisor.
- razonSocial: nombre o razón social del emisor.
- rucReceptor: RUC del cliente que compra (receptor de la factura), solo dígitos y sin DV.
- numeroCompleto: número de factura con formato 000-000-0000000.
- fecha: fecha de emisión con formato AAAA-MM-DD.
- timbrado: número de timbrado (8 dígitos).
- condicion: "Contado" o "Crédito".
- total5: total gravado 5 % (IVA incluido).
- total10: total gravado 10 % (IVA incluido).
- exenta: total exento.
- total: total a pagar.
- iva: total del IVA (5 % + 10 %).
- cdc: CDC de 44 dígitos sin espacios, o null si no tiene.
- cuenta: exactamente una de las CUENTAS de abajo, según lo que se compra y la actividad del cliente. Mercaderías que el cliente revende: la cuenta de inventario de la tasa con mayor monto ("MERCADERÍAS GRAVADAS POR EL IVA AL 10%", "MERCADERÍAS GRAVADAS POR EL IVA AL 5%" o "MERCADERÍAS EXENTAS DEL IVA"). Insumos para producir: "MATERIAS PRIMAS" o "MATERIALES, SUMINISTROS Y REPUESTOS". Bienes durables (vehículos, muebles, equipos, maquinarias, herramientas, inmuebles): la cuenta de activo fijo. Gastos propios (combustible, útiles, servicios, honorarios, alquiler, etc.): la cuenta de gasto que corresponda.
- descripcion: resumen corto y general de lo comprado (máximo ${MAX_DESCRIPCION} caracteres). Un solo ítem: su nombre tal como figura. Varios ítems del mismo tipo: el tipo general (ej. "GALLETITAS", "BEBIDAS VARIAS"), sin marcas ni presentaciones. Ítems de distintos tipos: "MERCADERÍAS VARIAS".
- revisar: lista con los nombres de las claves que no se leen con claridad o de las que dudas.
Montos: números enteros en guaraníes, sin separadores de miles.
Si un campo no aparece en la factura, devuelve null. No estimes ni calcules valores que no estén impresos (cuenta y descripcion sí se eligen a partir del detalle).
Actividades del cliente: ${act}
CUENTAS:
${CUENTAS.join('\n')}`;
}
const PROMPT_IA = armarPromptIA('');

// Instrucciones para leer una factura de VENTA emitida por el cliente
function armarPromptVentaIA(actividades) {
  const act = String(actividades ?? '').trim() || 'no informadas';
  return `Eres un lector de facturas de venta de Paraguay (DNIT). La factura la EMITE el cliente (el vendedor) y el receptor es su comprador. Lee la imagen y devuelve únicamente un objeto JSON, sin texto adicional y sin bloques de código, con estas claves:
- tipo: "Electrónica sin QR" si es un KuDE de factura electrónica (tiene CDC de 44 dígitos) o "Manual" si es una factura preimpresa.
- rucEmisor: RUC del emisor (el que vende), solo dígitos y sin DV.
- dvEmisor: dígito verificador del RUC del emisor.
- razonSocial: nombre o razón social del emisor.
- rucReceptor: RUC o cédula del comprador, solo dígitos y sin DV. Si dice consumidor final, sin nombre o no tiene RUC, devuelve "${CONSUMIDOR_FINAL.ruc}".
- dvReceptor: dígito verificador del RUC del comprador ("${CONSUMIDOR_FINAL.dv}" si es consumidor final).
- razonSocialReceptor: nombre o razón social del comprador ("${CONSUMIDOR_FINAL.razonSocial}" si es consumidor final).
- numeroCompleto: número de factura con formato 000-000-0000000.
- fecha: fecha de emisión con formato AAAA-MM-DD.
- timbrado: número de timbrado (8 dígitos).
- condicion: "Contado" o "Crédito".
- total5: total gravado 5 % (IVA incluido).
- total10: total gravado 10 % (IVA incluido).
- exenta: total exento.
- total: total de la venta.
- iva: total del IVA (5 % + 10 %).
- cdc: CDC de 44 dígitos sin espacios, o null si no tiene.
- cuenta: exactamente una de las CUENTAS de abajo, según lo que se vende y la actividad del cliente. Mercaderías: "VENTAS DE MERCADERÍAS GRAVADAS POR EL IVA", o "VENTAS DE MERCADERÍAS EXENTAS DEL IVA" si todo es exento. Servicios: "VENTAS DE SERVICIOS GRAVADOS".
- descripcion: resumen corto y general de lo vendido (máximo ${MAX_DESCRIPCION} caracteres). Un solo ítem: su nombre tal como figura. Varios ítems del mismo tipo: el tipo general (ej. "GALLETITAS", "BEBIDAS VARIAS"), sin marcas ni presentaciones. Ítems de distintos tipos: "MERCADERÍAS VARIAS".
- revisar: lista con los nombres de las claves que no se leen con claridad o de las que dudas.
Montos: números enteros en guaraníes, sin separadores de miles.
Si un campo no aparece en la factura, devuelve null. No estimes ni calcules valores que no estén impresos (cuenta y descripcion sí se eligen a partir del detalle).
Actividades del cliente: ${act}
CUENTAS:
${CUENTAS_VENTAS.join('\n')}`;
}
const promptIA = (actividades, operacion) => (operacion === 'venta' ? armarPromptVentaIA(actividades) : armarPromptIA(actividades));

// Esquema JSON para pedir la respuesta estructurada (Claude). esquemaIA('venta') agrega los datos del comprador.
function esquemaIA(operacion = 'compra') {
  const base = JSON.parse(JSON.stringify(ESQUEMA_IA));
  if (operacion !== 'venta') return base;
  const txt = { anyOf: [{ type: 'string' }, { type: 'null' }] };
  base.properties.dvReceptor = txt;
  base.properties.razonSocialReceptor = txt;
  base.properties.cuenta = { anyOf: [{ type: 'string', enum: CUENTAS_VENTAS }, { type: 'null' }] };
  base.properties.revisar = { type: 'array', items: { type: 'string', enum: CAMPOS_IA_VENTA } };
  base.required = Object.keys(base.properties);
  return base;
}
const ESQUEMA_IA = (() => {
  const txt = { anyOf: [{ type: 'string' }, { type: 'null' }] };
  const num = { anyOf: [{ type: 'number' }, { type: 'null' }] };
  const props = {
    tipo: { anyOf: [{ type: 'string', enum: ['Electrónica sin QR', 'Manual'] }, { type: 'null' }] },
    rucEmisor: txt, dvEmisor: txt, razonSocial: txt, rucReceptor: txt, numeroCompleto: txt, fecha: txt, timbrado: txt,
    condicion: { anyOf: [{ type: 'string', enum: ['Contado', 'Crédito'] }, { type: 'null' }] },
    total5: num, total10: num, exenta: num, total: num, iva: num, cdc: txt,
    cuenta: { anyOf: [{ type: 'string', enum: CUENTAS }, { type: 'null' }] }, descripcion: txt,
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

// Fila para el Excel (nombres de columna en español). Orden aprobado por el usuario:
// primero los datos principales (con cuenta, descripción y timbrado juntos) y el CDC al final.
function aFilaExcel(f) {
  const num = String(f.numeroCompleto || '');
  const n = (v) => (v === null || v === undefined ? '' : v);
  return {
    'Fecha emisión': f.fecha,
    'Número': num,
    'Timbrado': n(f.timbrado),
    'RUC emisor': f.rucEmisor,
    'DV emisor': f.dvEmisor,
    'Razón social': n(f.razonSocial),
    'Cuenta': n(f.cuenta),
    'Descripción': n(f.descripcion),
    'Condición': n(f.condicion),
    'Gravada 10 %': n(f.total10),
    'Gravada 5 %': n(f.total5),
    'Exenta': n(f.exenta),
    'Total (Gs)': f.total,
    'IVA (Gs)': f.iva,
    'Tipo': f.tipo || 'QR',
    'Origen de los datos': f.origen || 'QR',
    'Excluir de conciliación': f.excluirConciliacion ? 'Sí' : 'No',
    'Estado': 'Pendiente Marangatu',
    'RUC receptor': n(f.rucReceptor),
    'Período': f.periodo,
    'Tipo doc': n(f.tipoDoc),
    'Establecimiento': f.establecimiento || num.slice(0, 3),
    'Punto': f.punto || num.slice(4, 7),
    'Ítems': n(f.items),
    'Versión XML': n(f.version),
    'Fecha de lectura': f.leidoEl,
    'Enlace QR': n(f.enlace),
    'CDC': f.cdc || ''
  };
}

// Fila del Excel de ventas: mismo criterio que compras (datos principales primero, CDC al final).
function aFilaExcelVenta(f) {
  const num = String(f.numeroCompleto || '');
  const n = (v) => (v === null || v === undefined ? '' : v);
  return {
    'Fecha emisión': f.fecha,
    'Número': num,
    'Timbrado': n(f.timbrado),
    'RUC comprador': n(f.rucReceptor),
    'DV comprador': n(f.dvReceptor),
    'Razón social comprador': n(f.razonSocialReceptor),
    'Cuenta': n(f.cuenta),
    'Descripción': n(f.descripcion),
    'Condición': n(f.condicion),
    'Gravada 10 %': n(f.total10),
    'Gravada 5 %': n(f.total5),
    'Exenta': n(f.exenta),
    'Total (Gs)': f.total,
    'IVA (Gs)': f.iva,
    'Tipo': f.tipo,
    'Origen de los datos': f.origen,
    'Excluir de conciliación': f.excluirConciliacion ? 'Sí' : 'No',
    'Estado': 'Pendiente Marangatu',
    'RUC emisor (cliente)': n(f.rucEmisor),
    'Período': f.periodo,
    'Tipo doc': n(f.tipoDoc),
    'Establecimiento': f.establecimiento || num.slice(0, 3),
    'Punto': f.punto || num.slice(4, 7),
    'Fecha de lectura': f.leidoEl,
    'CDC': f.cdc || ''
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseMonto, hexToStr, parsearEnlace, aFilaExcel,
    TIPOS, ORIGENES, CAMPOS_IA, PROMPT_IA, ESQUEMA_IA,
    excluirPorDefecto, montoFlexible, separarRuc, formatearNumero, normalizarFecha, normalizarCondicion,
    claveFactura, datosDeCdc, validarFactura, normalizarIA, completarFactura, extraerJson,
    rucBase, rucCoincide, validarCliente,
    CUENTAS_COMPRA, CUENTAS, ID_CUENTA, MERCADERIAS_POR_TASA, CUENTAS_RENOMBRADAS, cuentaMercaderiaPorTasa,
    MAX_DESCRIPCION, normalizarCuenta, normalizarDescripcion, validarComplementos, faltantes,
    armarPromptIA, memoriaVacia, sugerenciaProveedor, recordarProveedor,
    CUENTAS_VENTA, CUENTAS_VENTAS, OPERACIONES, CONSUMIDOR_FINAL, CAMPOS_IA_VENTA, gruposCuentas, cuentasDe,
    sugerenciaVenta, recordarVenta, separarTimbrados, nombreParaArchivo, nombreArchivoExcel,
    armarPromptVentaIA, promptIA, esquemaIA, aFilaExcelVenta
  };
}
