// Pruebas del parser con Node, sin dependencias: node tests/parser.test.js
// Todos los datos son sintéticos (RUC, CDC y montos inventados).
const assert = require('assert');
const p = require('../parser.js');

let pasadas = 0;
const fallas = [];
function prueba(nombre, fn) {
  try { fn(); pasadas++; } catch (e) { fallas.push(`✗ ${nombre}\n  ${e.message}`); }
}

const hex = s => Buffer.from(s).toString('hex');
// CDC sintético: tipo 01, RUC 80000001, DV 1, est 001, punto 002, número 0000123, contrib 1, fecha, emisión 1, seguridad, DV
const cdcSintetico = (fecha = '20261102', numero = '0000123') =>
  '01' + '80000001' + '1' + '001' + '002' + numero + '1' + fecha + '1' + '123456789' + '0';
const enlace = (cdc, fecha, total = '139.900,0000', iva = '12718') =>
  `https://ekuatia.set.gov.py/consultas/qr?nVersion=150&Id=${cdc}&dFeEmiDE=${hex(fecha + 'T10:00:00')}&dRucRec=1234567&dTotGralOpe=${total}&dTotIVA=${iva}&cItems=2`;

// ---------- parseMonto (regla fija) ----------
prueba('parseMonto: formato paraguayo con coma decimal', () => assert.strictEqual(p.parseMonto('139.900,0000'), 139900));
prueba('parseMonto: punto decimal', () => assert.strictEqual(p.parseMonto('1090.909091'), 1090.909091));
prueba('parseMonto: vacío y nulo', () => { assert.strictEqual(p.parseMonto(''), 0); assert.strictEqual(p.parseMonto(null), 0); });
prueba('parseMonto: texto inválido', () => assert.strictEqual(p.parseMonto('abc'), 0));

prueba('hexToStr', () => assert.strictEqual(p.hexToStr(hex('2026-11-02')), '2026-11-02'));

// ---------- parsearEnlace ----------
prueba('parsearEnlace: lee una factura del período', () => {
  const r = p.parsearEnlace(enlace(cdcSintetico(), '2026-11-02'), '2026-11');
  assert.ok(r.ok);
  const f = r.factura;
  assert.strictEqual(f.numeroCompleto, '001-002-0000123');
  assert.strictEqual(f.rucEmisor, '80000001');
  assert.strictEqual(f.dvEmisor, '1');
  assert.strictEqual(f.total, 139900);
  assert.strictEqual(f.iva, 12718);
  assert.strictEqual(f.periodo, '2026-11');
  assert.strictEqual(f.tipo, 'QR');
  assert.strictEqual(f.origen, 'QR');
  assert.strictEqual(f.excluirConciliacion, false);
  assert.strictEqual(f.id, f.cdc);
});
prueba('parsearEnlace: rechaza otro período', () => {
  const r = p.parsearEnlace(enlace(cdcSintetico('20261005'), '2026-10-05'), '2026-11');
  assert.ok(!r.ok);
  assert.ok(r.periodoDistinto);
});
prueba('parsearEnlace: rechaza enlaces que no son de factura', () => {
  assert.ok(!p.parsearEnlace('https://ejemplo.com/?Id=123', '2026-11').ok);
  assert.ok(!p.parsearEnlace('no es un enlace', '2026-11').ok);
});

// ---------- Excel ----------
const COLUMNAS = ['Fecha emisión', 'Número', 'Timbrado', 'RUC emisor', 'DV emisor', 'Razón social', 'Cuenta', 'Descripción',
  'Condición', 'Gravada 10 %', 'Gravada 5 %', 'Exenta', 'Total (Gs)', 'IVA (Gs)', 'Tipo', 'Origen de los datos',
  'Excluir de conciliación', 'Estado', 'RUC receptor', 'Período', 'Tipo doc', 'Establecimiento', 'Punto', 'Ítems',
  'Versión XML', 'Fecha de lectura', 'Enlace QR', 'CDC'];
prueba('aFilaExcel: 28 columnas, datos principales primero y CDC al final', () => {
  const f = p.parsearEnlace(enlace(cdcSintetico(), '2026-11-02'), '2026-11').factura;
  assert.deepStrictEqual(Object.keys(p.aFilaExcel(f)), COLUMNAS);
  const fila = p.aFilaExcel(f);
  assert.strictEqual(fila['Estado'], 'Pendiente Marangatu');
  assert.strictEqual(fila['Tipo'], 'QR');
  assert.strictEqual(fila['Excluir de conciliación'], 'No');
  assert.strictEqual(fila['Origen de los datos'], 'QR');
});
prueba('aFilaExcel: factura manual sin CDC', () => {
  const fila = p.aFilaExcel({ tipo: 'Manual', origen: 'Manual', excluirConciliacion: true, numeroCompleto: '001-003-0000456',
    fecha: '2026-11-10', periodo: '2026-11', rucEmisor: '1234567', dvEmisor: '8', total: 33000, iva: 3000,
    total5: 0, total10: 33000, exenta: 0, timbrado: '12345678', condicion: 'Contado', razonSocial: 'Comercio Ejemplo',
    cuenta: 'ÚTILES DE OFICINA', descripcion: 'CUADERNOS' });
  assert.deepStrictEqual(Object.keys(fila), COLUMNAS);
  assert.strictEqual(fila['CDC'], '');
  assert.strictEqual(fila['Establecimiento'], '001');
  assert.strictEqual(fila['Punto'], '003');
  assert.strictEqual(fila['Excluir de conciliación'], 'Sí');
  assert.strictEqual(fila['Enlace QR'], '');
  assert.strictEqual(fila['Cuenta'], 'ÚTILES DE OFICINA');
  assert.strictEqual(fila['Descripción'], 'CUADERNOS');
  assert.strictEqual(fila['Timbrado'], '12345678');
});

// ---------- Valores por defecto ----------
prueba('excluirPorDefecto: solo las manuales', () => {
  assert.strictEqual(p.excluirPorDefecto('QR'), false);
  assert.strictEqual(p.excluirPorDefecto('Electrónica sin QR'), false);
  assert.strictEqual(p.excluirPorDefecto('Manual'), true);
});
prueba('completarFactura: lista vieja queda como QR', () => {
  const f = p.completarFactura({ cdc: cdcSintetico(), numeroCompleto: '001-002-0000123', total: 1 });
  assert.strictEqual(f.tipo, 'QR');
  assert.strictEqual(f.origen, 'QR');
  assert.strictEqual(f.excluirConciliacion, false);
  assert.strictEqual(f.id, f.cdc);
});

// ---------- Formatos ----------
prueba('montoFlexible: miles con punto, números y formato paraguayo', () => {
  assert.strictEqual(p.montoFlexible('139.900'), 139900);
  assert.strictEqual(p.montoFlexible('1.234.567'), 1234567);
  assert.strictEqual(p.montoFlexible('139.900,0000'), 139900);
  assert.strictEqual(p.montoFlexible(55000), 55000);
  assert.strictEqual(p.montoFlexible('Gs. 10.000'), 10000);
  assert.strictEqual(p.montoFlexible(null), null);
  assert.strictEqual(p.montoFlexible(''), null);
  assert.strictEqual(p.montoFlexible('diez'), null);
});
prueba('separarRuc', () => {
  assert.deepStrictEqual(p.separarRuc('80012345-6'), { ruc: '80012345', dv: '6' });
  assert.deepStrictEqual(p.separarRuc('1234567 - 8'), { ruc: '1234567', dv: '8' });
  assert.deepStrictEqual(p.separarRuc('1234567'), { ruc: '1234567', dv: '' });
});
prueba('formatearNumero', () => {
  assert.strictEqual(p.formatearNumero('1-1-123'), '001-001-0000123');
  assert.strictEqual(p.formatearNumero('001-002-0000123'), '001-002-0000123');
  assert.strictEqual(p.formatearNumero('0010020000123'), '001-002-0000123');
  assert.strictEqual(p.formatearNumero('12345'), null);
});
prueba('normalizarFecha', () => {
  assert.strictEqual(p.normalizarFecha('2026-11-02'), '2026-11-02');
  assert.strictEqual(p.normalizarFecha('02/11/2026'), '2026-11-02');
  assert.strictEqual(p.normalizarFecha('2-11-2026'), '2026-11-02');
  assert.strictEqual(p.normalizarFecha('31/02/2026'), null);
  assert.strictEqual(p.normalizarFecha('ayer'), null);
});

// ---------- claveFactura ----------
prueba('claveFactura: CDC para electrónicas', () => assert.strictEqual(p.claveFactura({ cdc: cdcSintetico() }), cdcSintetico()));
prueba('claveFactura: número + RUC + fecha + total para manuales', () => {
  const a = p.claveFactura({ numeroCompleto: '001-001-0000001', rucEmisor: '01234567', fecha: '2026-11-02', total: 50000 });
  const b = p.claveFactura({ numeroCompleto: '001-001-0000001', rucEmisor: '1234567', fecha: '2026-11-02', total: 50000.2 });
  assert.strictEqual(a, '001-001-0000001|1234567|2026-11-02|50000');
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, p.claveFactura({ numeroCompleto: '001-001-0000001', rucEmisor: '1234567', fecha: '2026-11-02', total: 50001 }));
});

// ---------- validarFactura ----------
const base = () => ({
  tipo: 'Manual', origen: 'Manual', rucEmisor: '1234567', dvEmisor: '8', numeroCompleto: '001-001-0000010',
  fecha: '2026-11-15', total5: 21000, total10: 55000, exenta: 4000, total: 80000, iva: 6000, cdc: '',
  timbrado: '12345678', cuenta: 'COSTO DE MERCADERÍAS GRAVADAS POR EL IVA', descripcion: 'MERCADERÍAS VARIAS'
});
prueba('validarFactura: factura correcta', () => {
  const r = p.validarFactura(base(), '2026-11');
  assert.ok(r.ok, JSON.stringify(r.errores));
});
prueba('validarFactura: total distinto de 5 % + 10 % + exenta', () => {
  const r = p.validarFactura(Object.assign(base(), { total: 80500 }), '2026-11');
  assert.ok(r.errores.total);
});
prueba('validarFactura: RUC sin DV o con letras', () => {
  assert.ok(p.validarFactura(Object.assign(base(), { dvEmisor: '' }), '2026-11').errores.rucEmisor);
  assert.ok(p.validarFactura(Object.assign(base(), { rucEmisor: '12A4567' }), '2026-11').errores.rucEmisor);
  assert.ok(p.validarFactura(Object.assign(base(), { rucEmisor: '123456789' }), '2026-11').errores.rucEmisor);
});
prueba('validarFactura: fecha fuera del período', () => {
  assert.ok(p.validarFactura(Object.assign(base(), { fecha: '2026-10-31' }), '2026-11').errores.fecha);
  assert.ok(p.validarFactura(Object.assign(base(), { fecha: '2026-11-31' }), '2026-11').errores.fecha);
});
prueba('validarFactura: número con formato incorrecto', () => {
  assert.ok(p.validarFactura(Object.assign(base(), { numeroCompleto: '1-1-10' }), '2026-11').errores.numeroCompleto);
});
prueba('validarFactura: IVA con tolerancia de 1 Gs por tasa', () => {
  // 55000/11 = 5000 y 21000/21 = 1000 -> 6000
  assert.ok(p.validarFactura(Object.assign(base(), { iva: 6001 }), '2026-11').ok);
  assert.ok(p.validarFactura(Object.assign(base(), { iva: 5998 }), '2026-11').ok);
  assert.ok(p.validarFactura(Object.assign(base(), { iva: 6003 }), '2026-11').errores.iva);
  // Solo 10 %: tolerancia 1 Gs (100000/11 = 9090,9)
  const solo10 = Object.assign(base(), { total5: 0, exenta: 0, total10: 100000, total: 100000, iva: 9091 });
  assert.ok(p.validarFactura(solo10, '2026-11').ok);
  assert.ok(p.validarFactura(Object.assign(solo10, { iva: 9093 }), '2026-11').errores.iva);
});
prueba('validarFactura: CDC debe coincidir con número, RUC y fecha', () => {
  const f = Object.assign(base(), { tipo: 'Electrónica sin QR', cdc: cdcSintetico('20261115', '0000010'),
    rucEmisor: '80000001', dvEmisor: '1', numeroCompleto: '001-002-0000010' });
  assert.ok(p.validarFactura(f, '2026-11').ok, JSON.stringify(p.validarFactura(f, '2026-11').errores));
  assert.ok(p.validarFactura(Object.assign({}, f, { numeroCompleto: '001-002-0000011' }), '2026-11').errores.cdc);
  assert.ok(p.validarFactura(Object.assign({}, f, { cdc: '123' }), '2026-11').errores.cdc);
});

// ---------- normalizarIA ----------
prueba('normalizarIA: respuesta completa', () => {
  const f = p.normalizarIA({
    tipo: 'Manual', rucEmisor: '1234567', dvEmisor: '8', razonSocial: 'Comercio Ejemplo SA', rucReceptor: '0001234500-1', numeroCompleto: '1-1-10',
    fecha: '15/11/2026', timbrado: '12345678', condicion: 'CONTADO', total5: '21.000', total10: 55000, exenta: 4000,
    total: '80.000', iva: 6000, cdc: null, cuenta: 'costo de mercaderias gravadas por el iva', descripcion: 'Bebidas varias',
    revisar: ['timbrado', 'clave_inventada']
  });
  assert.strictEqual(f.tipo, 'Manual');
  assert.strictEqual(f.origen, 'IA');
  assert.strictEqual(f.excluirConciliacion, true);
  assert.strictEqual(f.numeroCompleto, '001-001-0000010');
  assert.strictEqual(f.fecha, '2026-11-15');
  assert.strictEqual(f.periodo, '2026-11');
  assert.strictEqual(f.condicion, 'Contado');
  assert.strictEqual(f.total5, 21000);
  assert.strictEqual(f.total, 80000);
  assert.deepStrictEqual(f.revisar, ['timbrado']);
  assert.strictEqual(f.rucReceptor, '1234500');
  assert.strictEqual(f.cuenta, 'COSTO DE MERCADERÍAS GRAVADAS POR EL IVA');
  assert.strictEqual(f.descripcion, 'BEBIDAS VARIAS');
  assert.ok(p.validarFactura(f, '2026-11').ok);
  assert.ok(p.validarFactura(f, '2026-11', '1234500').ok);
  assert.ok(p.validarFactura(f, '2026-11', '7777777').errores.rucReceptor);
});
prueba('normalizarIA: campos ausentes quedan en null y marcados', () => {
  const f = p.normalizarIA({ tipo: 'Manual', rucEmisor: '1234567-8', numeroCompleto: null, fecha: null, total: null,
    iva: null, total5: null, total10: null, exenta: null, timbrado: null, razonSocial: null, condicion: null, cdc: null, revisar: [] });
  assert.strictEqual(f.rucEmisor, '1234567');
  assert.strictEqual(f.dvEmisor, '8');
  assert.strictEqual(f.total, null);
  assert.strictEqual(f.iva, null);
  for (const c of ['numeroCompleto', 'fecha', 'total', 'iva', 'total5', 'total10', 'exenta', 'timbrado']) {
    assert.ok(f.revisar.includes(c), 'falta marcar ' + c);
  }
  assert.ok(!p.validarFactura(f, '2026-11').ok);
});
prueba('normalizarIA: electrónica sin QR completa datos desde el CDC', () => {
  const cdc = cdcSintetico('20261120', '0000777');
  const f = p.normalizarIA({ tipo: null, cdc: cdc.replace(/(\d{4})/g, '$1 '), rucEmisor: null, dvEmisor: null,
    numeroCompleto: null, fecha: null, total10: 11000, total5: 0, exenta: 0, total: 11000, iva: 1000, revisar: [],
    timbrado: '87654321', cuenta: 'COMBUSTIBLES Y LUBRICANTES', descripcion: 'NAFTA' });
  assert.strictEqual(f.tipo, 'Electrónica sin QR');
  assert.strictEqual(f.excluirConciliacion, false);
  assert.strictEqual(f.cdc, cdc);
  assert.strictEqual(f.rucEmisor, '80000001');
  assert.strictEqual(f.dvEmisor, '1');
  assert.strictEqual(f.numeroCompleto, '001-002-0000777');
  assert.strictEqual(f.fecha, '2026-11-20');
  assert.ok(p.validarFactura(f, '2026-11').ok, JSON.stringify(p.validarFactura(f, '2026-11').errores));
  assert.strictEqual(p.claveFactura(f), cdc);
});
prueba('normalizarIA: el tipo QR no se acepta desde la IA', () => {
  assert.strictEqual(p.normalizarIA({ tipo: 'QR', cdc: null }).tipo, 'Manual');
});
prueba('normalizarIA: tolera respuesta vacía', () => {
  const f = p.normalizarIA(null);
  assert.strictEqual(f.tipo, 'Manual');
  assert.ok(f.revisar.length > 0);
});

// ---------- Respuesta de la IA ----------
prueba('extraerJson: con bloque de código y texto alrededor', () => {
  assert.deepStrictEqual(p.extraerJson('Aquí está:\n```json\n{"total": 1000}\n```'), { total: 1000 });
  assert.throws(() => p.extraerJson('sin datos'));
});
prueba('ESQUEMA_IA: todas las claves requeridas y sin propiedades extra', () => {
  assert.strictEqual(p.ESQUEMA_IA.additionalProperties, false);
  assert.deepStrictEqual(p.ESQUEMA_IA.required.slice().sort(), [...p.CAMPOS_IA, 'revisar'].sort());
});
prueba('PROMPT_IA: pide solo JSON y null sin estimar', () => {
  assert.ok(/únicamente un objeto JSON/.test(p.PROMPT_IA));
  assert.ok(/devuelve null/.test(p.PROMPT_IA));
  for (const c of p.CAMPOS_IA) assert.ok(p.PROMPT_IA.includes(c + ':'), 'el prompt no menciona ' + c);
});

// ---------- Clientes ----------
prueba('rucBase y rucCoincide: sin DV ni ceros a la izquierda', () => {
  assert.strictEqual(p.rucBase('80012345-6'), '80012345');
  assert.strictEqual(p.rucBase('080012345'), '80012345');
  assert.strictEqual(p.rucBase(null), '');
  assert.ok(p.rucCoincide('1234567', '01234567-8'));
  assert.ok(!p.rucCoincide('1234567', '1234568'));
  assert.ok(!p.rucCoincide('', ''));
});
prueba('validarCliente: nombre, RUC con DV y sin repetir', () => {
  assert.ok(p.validarCliente({ id: 'a', nombre: 'Cliente Ejemplo', ruc: '1234567', dv: '8' }).ok);
  assert.ok(p.validarCliente({ nombre: '', ruc: '1234567', dv: '8' }).errores.nombre);
  assert.ok(p.validarCliente({ nombre: 'X', ruc: '1234567', dv: '' }).errores.ruc);
  const otros = [{ id: 'a', nombre: 'Uno', ruc: '1234567', dv: '8' }];
  assert.ok(p.validarCliente({ id: 'b', nombre: 'Dos', ruc: '01234567', dv: '8' }, otros).errores.ruc);
  assert.ok(p.validarCliente({ id: 'a', nombre: 'Uno renombrado', ruc: '1234567', dv: '8' }, otros).ok);
});
prueba('parsearEnlace: acepta si el RUC receptor es del cliente', () => {
  const r = p.parsearEnlace(enlace(cdcSintetico(), '2026-11-02'), '2026-11', '1234567');
  assert.ok(r.ok, r.error);
});
prueba('parsearEnlace: rechaza factura de otro cliente', () => {
  const r = p.parsearEnlace(enlace(cdcSintetico(), '2026-11-02'), '2026-11', '7654321');
  assert.ok(!r.ok);
  assert.ok(r.rucDistinto);
  assert.strictEqual(r.factura.rucReceptor, '1234567');
});
prueba('parsearEnlace: rechaza factura sin RUC receptor cuando hay cliente', () => {
  const sinReceptor = enlace(cdcSintetico(), '2026-11-02').replace('&dRucRec=1234567', '');
  const r = p.parsearEnlace(sinReceptor, '2026-11', '1234567');
  assert.ok(!r.ok);
  assert.ok(r.rucDistinto);
  assert.ok(p.parsearEnlace(sinReceptor, '2026-11').ok); // sin cliente no se controla
});
prueba('parsearEnlace: el período se controla antes que el cliente', () => {
  const r = p.parsearEnlace(enlace(cdcSintetico('20261005'), '2026-10-05'), '2026-11', '7654321');
  assert.ok(r.periodoDistinto);
});
prueba('validarFactura: exige RUC receptor cuando hay cliente', () => {
  const f = Object.assign(base(), { rucReceptor: '' });
  assert.ok(p.validarFactura(f, '2026-11', '1234500').errores.rucReceptor);
  assert.ok(p.validarFactura(Object.assign(f, { rucReceptor: '1234500' }), '2026-11', '1234500-3').ok);
});
prueba('completarFactura: conserva el cliente y deja vacío si no hay', () => {
  assert.strictEqual(p.completarFactura({ cdc: cdcSintetico(), clienteId: 'c1' }).clienteId, 'c1');
  assert.strictEqual(p.completarFactura({ cdc: cdcSintetico() }).clienteId, '');
});

// ---------- Cuenta, descripción y timbrado ----------
prueba('CUENTAS: 81 conceptos de compra, sin repetidos y con el texto e Id de ContAdis', () => {
  assert.strictEqual(p.CUENTAS.length, 81);
  assert.strictEqual(new Set(p.CUENTAS).size, p.CUENTAS.length);
  assert.strictEqual(new Set(Object.values(p.ID_CUENTA)).size, p.CUENTAS.length + p.CUENTAS_VENTAS.length);
  assert.strictEqual(p.ID_CUENTA['COMBUSTIBLES Y LUBRICANTES'], 208);
  assert.strictEqual(p.ID_CUENTA['MERCADERÍAS GRAVADAS POR EL IVA AL 10%'], 67);
  assert.strictEqual(p.ID_CUENTA['RODADOS/TRANSPORTES'], 92);
  assert.strictEqual(p.ID_CUENTA['SEGUROS A DEVENGAR'], 10);
  // 182 y 184 van cortados como en ContAdis
  assert.ok(p.CUENTAS.includes('(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DEL SECTOR AG'));
  assert.ok(p.CUENTAS.includes('(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DE LA ACTIVID'));
  // No vienen de una factura de compra
  for (const c of ['SUELDOS Y JORNALES', 'APORTE PATRONAL', 'Caja', 'IVA - CRÉDITO FISCAL', 'PROVEEDORES LOCALES',
    'DEPRECIACIONES DEL EJERCICIO', 'PRODUCTOS TERMINADOS EXENTOS DEL IVA', 'REMUNERACIÓN PERSONAL SUPERIOR']) {
    assert.ok(!p.CUENTAS.includes(c), 'no debería estar: ' + c);
  }
  assert.ok(!p.CUENTAS.some(c => c.startsWith('VENTAS') || c.startsWith('INGRESOS') || c.startsWith('INGSOS')));
});
prueba('normalizarCuenta: textos de versiones anteriores pasan al texto actual', () => {
  assert.strictEqual(p.normalizarCuenta('COMBUSTIBLES Y LUBRICANES'), 'COMBUSTIBLES Y LUBRICANTES');
  assert.strictEqual(p.normalizarCuenta('(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DEL SECTOR AGROPECUARIO'),
    '(-) COSTO DE PRODUCCIÓN Y/O TENENCIA DE BIENES DEL SECTOR AG');
  assert.strictEqual(p.completarFactura({ cuenta: 'COMBUSTIBLES Y LUBRICANES' }).cuenta, 'COMBUSTIBLES Y LUBRICANTES');
});
prueba('cuentaMercaderiaPorTasa: inventario según la tasa con mayor monto', () => {
  const m10 = 'MERCADERÍAS GRAVADAS POR EL IVA AL 10%', m5 = 'MERCADERÍAS GRAVADAS POR EL IVA AL 5%', mex = 'MERCADERÍAS EXENTAS DEL IVA';
  assert.strictEqual(p.cuentaMercaderiaPorTasa({ cuenta: m10, total10: 1000, total5: 5000, exenta: 0 }), m5);
  assert.strictEqual(p.cuentaMercaderiaPorTasa({ cuenta: m5, total10: 9000, total5: 1000, exenta: 0 }), m10);
  assert.strictEqual(p.cuentaMercaderiaPorTasa({ cuenta: m10, total10: 0, total5: 0, exenta: 300 }), mex);
  assert.strictEqual(p.cuentaMercaderiaPorTasa({ cuenta: m5, total10: null, total5: null, exenta: null }), m5); // sin montos no cambia
  assert.strictEqual(p.cuentaMercaderiaPorTasa({ cuenta: 'ALQUILERES', total10: 0, total5: 9000 }), 'ALQUILERES'); // otras cuentas no cambian
  const f = p.normalizarIA({ tipo: 'Manual', cuenta: m10, total10: 2200, total5: 21000, exenta: 0, total: 23200 });
  assert.strictEqual(f.cuenta, m5);
});
prueba('normalizarCuenta: sin importar mayúsculas, acentos ni espacios', () => {
  assert.strictEqual(p.normalizarCuenta('utiles de  oficina'), 'ÚTILES DE OFICINA');
  assert.strictEqual(p.normalizarCuenta('Agua, luz, telefono e internet'), 'AGUA, LUZ, TELÉFONO E INTERNET');
  assert.strictEqual(p.normalizarCuenta('CUENTA INVENTADA'), '');
  assert.strictEqual(p.normalizarCuenta(null), '');
});
prueba('normalizarDescripcion: mayúsculas, sin espacios dobles y hasta 60 caracteres', () => {
  assert.strictEqual(p.normalizarDescripcion('  galletitas   dulces '), 'GALLETITAS DULCES');
  assert.strictEqual(p.normalizarDescripcion('x'.repeat(80)).length, p.MAX_DESCRIPCION);
});
prueba('validarComplementos y faltantes: timbrado de 8 dígitos, cuenta del listado y descripción', () => {
  assert.deepStrictEqual(p.faltantes(base()), []);
  assert.deepStrictEqual(p.faltantes({}), ['timbrado', 'cuenta', 'descripción']);
  assert.ok(p.validarComplementos(Object.assign(base(), { timbrado: '1234567' })).timbrado);
  assert.ok(p.validarComplementos(Object.assign(base(), { cuenta: 'OTRA' })).cuenta);
  assert.ok(p.validarComplementos(Object.assign(base(), { descripcion: 'x'.repeat(61) })).descripcion);
  assert.ok(p.validarFactura(Object.assign(base(), { timbrado: '' }), '2026-11').errores.timbrado);
});
prueba('normalizarIA: cuenta fuera del listado queda vacía y marcada', () => {
  const f = p.normalizarIA({ tipo: 'Manual', cuenta: 'GASTOS VARIOS', descripcion: null, timbrado: '123' });
  assert.strictEqual(f.cuenta, '');
  for (const c of ['cuenta', 'descripcion', 'timbrado']) assert.ok(f.revisar.includes(c), 'falta marcar ' + c);
});
prueba('armarPromptIA: incluye actividades y todas las cuentas', () => {
  const t = p.armarPromptIA('Despensa y venta de bebidas');
  assert.ok(t.includes('Actividades del cliente: Despensa y venta de bebidas'));
  for (const c of p.CUENTAS) assert.ok(t.includes(c), 'falta ' + c);
  assert.ok(p.armarPromptIA('').includes('Actividades del cliente: no informadas'));
});
prueba('ESQUEMA_IA: la cuenta solo puede ser del listado', () => {
  assert.deepStrictEqual(p.ESQUEMA_IA.properties.cuenta.anyOf[0].enum, p.CUENTAS);
});
prueba('memoria por proveedor: timbrado global y cuenta por cliente', () => {
  let m = p.memoriaVacia();
  m = p.recordarProveedor(m, 'c1', { rucEmisor: '080000001', timbrado: '12345678', cuenta: 'COMBUSTIBLES Y LUBRICANTES', descripcion: 'nafta' });
  assert.deepStrictEqual(p.sugerenciaProveedor(m, 'c1', '80000001'), { timbrado: '12345678', cuenta: 'COMBUSTIBLES Y LUBRICANTES', descripcion: 'NAFTA' });
  assert.deepStrictEqual(p.sugerenciaProveedor(m, 'c2', '80000001'), { timbrado: '12345678', cuenta: '', descripcion: '' });
  assert.deepStrictEqual(p.sugerenciaProveedor(null, 'c1', '1'), { timbrado: '', cuenta: '', descripcion: '' });
  // Datos inválidos no se recuerdan
  m = p.recordarProveedor(m, 'c1', { rucEmisor: '80000001', timbrado: '99', cuenta: 'OTRA', descripcion: 'x' });
  assert.strictEqual(p.sugerenciaProveedor(m, 'c1', '80000001').timbrado, '12345678');
  assert.strictEqual(p.sugerenciaProveedor(m, 'c1', '80000001').cuenta, 'COMBUSTIBLES Y LUBRICANTES');
  // Memoria guardada con un texto viejo se sugiere con el texto actual
  const vieja = { timbrados: {}, cuentas: { c1: { '7': { cuenta: 'COMBUSTIBLES Y LUBRICANES', descripcion: 'NAFTA' } } } };
  assert.strictEqual(p.sugerenciaProveedor(vieja, 'c1', '7').cuenta, 'COMBUSTIBLES Y LUBRICANTES');
});

// ---------- Ventas ----------
const venta = () => ({
  operacion: 'venta', tipo: 'Manual', origen: 'Manual', rucEmisor: '1234567', dvEmisor: '8',
  rucReceptor: '7654321', dvReceptor: '0', razonSocialReceptor: 'COMPRADOR EJEMPLO', numeroCompleto: '001-001-0000050',
  fecha: '2026-11-15', total5: 0, total10: 110000, exenta: 0, total: 110000, iva: 10000, cdc: '',
  timbrado: '11223344', cuenta: 'VENTAS DE MERCADERÍAS GRAVADAS POR EL IVA', descripcion: 'BEBIDAS VARIAS'
});
const opc = { timbrados: ['11223344'] };
prueba('CUENTAS_VENTAS: 30 conceptos de venta con su Id', () => {
  assert.strictEqual(p.CUENTAS_VENTAS.length, 30);
  assert.strictEqual(new Set(p.CUENTAS_VENTAS).size, 30);
  assert.strictEqual(p.ID_CUENTA['VENTAS DE MERCADERÍAS GRAVADAS POR EL IVA'], 135);
  assert.strictEqual(p.ID_CUENTA['INGSOS POR PRODUCCIÓN Y/O TENENCIA DE BIENES DE LA ACTIVIDA'], 181);
  for (const c of ['(-) DESCUENTOS CONCEDIDOS', '(-) DEVOLUCIONES', 'DESCUENTOS OBTENIDOS', 'SUBVENCIONES']) assert.ok(!p.CUENTAS_VENTAS.includes(c));
  assert.ok(!p.CUENTAS_VENTAS.some(c => p.CUENTAS.includes(c)), 'compras y ventas no comparten cuentas');
  assert.strictEqual(p.cuentasDe('venta'), p.CUENTAS_VENTAS);
  assert.strictEqual(p.cuentasDe('compra'), p.CUENTAS);
});
prueba('validarFactura venta: correcta', () => {
  const r = p.validarFactura(venta(), '2026-11', '1234567', opc);
  assert.ok(r.ok, JSON.stringify(r.errores));
});
prueba('validarFactura venta: el emisor debe ser el cliente', () => {
  assert.ok(p.validarFactura(Object.assign(venta(), { rucEmisor: '9999999' }), '2026-11', '1234567', opc).errores.rucEmisor);
});
prueba('validarFactura venta: timbrado registrado del cliente', () => {
  assert.ok(p.validarFactura(Object.assign(venta(), { timbrado: '99999999' }), '2026-11', '1234567', opc).errores.timbrado);
  assert.ok(p.validarFactura(venta(), '2026-11', '1234567', { timbrados: [] }).errores.timbrado);
  assert.deepStrictEqual(p.faltantes(venta(), opc), []);
  assert.deepStrictEqual(p.faltantes(venta(), {}), ['timbrado']);
});
prueba('validarFactura venta: comprador con RUC y DV, o consumidor final', () => {
  assert.ok(p.validarFactura(Object.assign(venta(), { dvReceptor: '' }), '2026-11', '1234567', opc).errores.rucReceptor);
  assert.ok(p.validarFactura(Object.assign(venta(), { razonSocialReceptor: '' }), '2026-11', '1234567', opc).errores.razonSocialReceptor);
  const cf = Object.assign(venta(), { rucReceptor: p.CONSUMIDOR_FINAL.ruc, dvReceptor: p.CONSUMIDOR_FINAL.dv, razonSocialReceptor: p.CONSUMIDOR_FINAL.razonSocial });
  assert.ok(p.validarFactura(cf, '2026-11', '1234567', opc).ok);
});
prueba('validarFactura venta: la cuenta debe ser de ventas', () => {
  assert.ok(p.validarFactura(Object.assign(venta(), { cuenta: 'ALQUILERES' }), '2026-11', '1234567', opc).errores.cuenta);
  assert.ok(p.validarFactura(Object.assign(base(), { cuenta: 'VENTAS DE SERVICIOS GRAVADOS' }), '2026-11').errores.cuenta);
});
prueba('claveFactura: la venta no choca con una compra del mismo CDC', () => {
  const cdc = cdcSintetico();
  assert.strictEqual(p.claveFactura({ cdc }), cdc);
  assert.strictEqual(p.claveFactura({ cdc, operacion: 'venta' }), 'V|' + cdc);
  assert.ok(p.claveFactura(venta()).startsWith('V|001-001-0000050|1234567|'));
});
prueba('normalizarIA venta: comprador, consumidor final y cuenta de ventas', () => {
  const f = p.normalizarIA({ tipo: 'Manual', rucEmisor: '1234567', dvEmisor: '8', rucReceptor: '7654321-0', razonSocialReceptor: 'Comprador Ejemplo',
    cuenta: 'ventas de mercaderias gravadas por el iva', descripcion: 'bebidas', total10: 11000, total: 11000, iva: 1000 }, 'IA', 'venta');
  assert.strictEqual(f.operacion, 'venta');
  assert.strictEqual(f.rucReceptor, '7654321');
  assert.strictEqual(f.dvReceptor, '0');
  assert.strictEqual(f.razonSocialReceptor, 'COMPRADOR EJEMPLO');
  assert.strictEqual(f.cuenta, 'VENTAS DE MERCADERÍAS GRAVADAS POR EL IVA');
  assert.ok(!f.revisar.includes('razonSocial'));
  const g = p.normalizarIA({ cuenta: 'ALQUILERES' }, 'IA', 'venta');
  assert.strictEqual(g.cuenta, '');
  assert.ok(g.revisar.includes('rucReceptor'));
});
prueba('promptIA y esquemaIA de ventas', () => {
  const t = p.promptIA('Despensa', 'venta');
  assert.ok(t.includes('facturas de venta') && t.includes('Actividades del cliente: Despensa'));
  for (const c of p.CUENTAS_VENTAS) assert.ok(t.includes(c), 'falta ' + c);
  for (const c of p.CAMPOS_IA_VENTA) assert.ok(t.includes(c + ':'), 'el prompt no menciona ' + c);
  assert.ok(t.includes(p.CONSUMIDOR_FINAL.ruc));
  assert.strictEqual(p.promptIA('x', 'compra'), p.armarPromptIA('x'));
  const e = p.esquemaIA('venta');
  assert.deepStrictEqual(e.required.slice().sort(), [...p.CAMPOS_IA_VENTA, 'revisar'].sort());
  assert.deepStrictEqual(e.properties.cuenta.anyOf[0].enum, p.CUENTAS_VENTAS);
  assert.deepStrictEqual(p.esquemaIA('compra'), p.ESQUEMA_IA);
});
prueba('memoria de ventas: por comprador y lo último del cliente', () => {
  let m = p.memoriaVacia();
  m = p.recordarVenta(m, 'c1', Object.assign(venta(), { descripcion: 'gaseosas' }));
  assert.deepStrictEqual(p.sugerenciaVenta(m, 'c1', '7654321'), { cuenta: 'VENTAS DE MERCADERÍAS GRAVADAS POR EL IVA', descripcion: 'GASEOSAS' });
  assert.strictEqual(p.sugerenciaVenta(m, 'c1', '1111111').descripcion, 'GASEOSAS'); // comprador nuevo: lo último del cliente
  assert.deepStrictEqual(p.sugerenciaVenta(m, 'c2', '7654321'), { cuenta: '', descripcion: '' });
  assert.deepStrictEqual(p.sugerenciaVenta({ timbrados: {}, cuentas: {} }, 'c1', '1'), { cuenta: '', descripcion: '' }); // memoria vieja
});
prueba('aFilaExcelVenta: 25 columnas, comprador primero y CDC al final', () => {
  const fila = p.aFilaExcelVenta(venta());
  const cols = Object.keys(fila);
  assert.strictEqual(cols.length, 25);
  assert.deepStrictEqual(cols.slice(0, 8), ['Fecha emisión', 'Número', 'Timbrado', 'RUC comprador', 'DV comprador', 'Razón social comprador', 'Cuenta', 'Descripción']);
  assert.strictEqual(cols[cols.length - 1], 'CDC');
  assert.strictEqual(fila['RUC emisor (cliente)'], '1234567');
  assert.strictEqual(fila['Establecimiento'], '001');
});
prueba('clientes: timbrados de venta y nombre para archivos', () => {
  assert.deepStrictEqual(p.separarTimbrados('11223344, 55667788;11223344 '), ['11223344', '55667788']);
  assert.ok(p.validarCliente({ nombre: 'X', ruc: '1', dv: '1', timbradosVenta: ['123'] }).errores.timbradosVenta);
  assert.ok(p.validarCliente({ nombre: 'X', ruc: '1', dv: '1', timbradosVenta: ['11223344'] }).ok);
  assert.strictEqual(p.nombreParaArchivo({ nombre: 'José Pérez Gómez' }), 'Jose_Perez');
  assert.strictEqual(p.nombreParaArchivo({ nombre: 'Comercial Ejemplo S.A.' }), 'Comercial_Ejemplo');
  assert.strictEqual(p.nombreParaArchivo({ nombre: 'Muy Largo SA', nombreArchivo: 'Ana Ríos' }), 'Ana_Rios');
  assert.strictEqual(p.nombreParaArchivo({ nombre: '' }), 'Cliente');
  assert.strictEqual(p.nombreArchivoExcel({ nombre: 'Juan Pérez' }, 'compra', '2026-11'), 'Compras_Juan_Perez_2026-11.xlsx');
  assert.strictEqual(p.nombreArchivoExcel({ nombre: 'Juan Pérez' }, 'venta', '2026-11'), 'Ventas_Juan_Perez_2026-11.xlsx');
});
prueba('completarFactura: las facturas viejas son compras', () => {
  assert.strictEqual(p.completarFactura({ cdc: cdcSintetico() }).operacion, 'compra');
  assert.strictEqual(p.completarFactura({ operacion: 'venta', cuenta: 'ventas de servicios gravados' }).cuenta, 'VENTAS DE SERVICIOS GRAVADOS');
});

// ---------- Diagnóstico de QR rechazados ----------
prueba('parsearEnlace: rechaza notas de crédito y remisiones; acepta autofacturas', () => {
  const nc = '05' + cdcSintetico().slice(2);
  const r = p.parsearEnlace(enlace(nc, '2026-11-02'), '2026-11');
  assert.ok(!r.ok && r.tipoDistinto);
  assert.ok(/nota de crédito/.test(r.error));
  const auto = '04' + cdcSintetico().slice(2);
  assert.ok(p.parsearEnlace(enlace(auto, '2026-11-02'), '2026-11').ok);
});
prueba('diagnosticarQR: texto, Wi-Fi, CDC suelto y otros sitios', () => {
  assert.ok(/red Wi-Fi/.test(p.diagnosticarQR('WIFI:S:Casa;T:WPA;P:clave;;', '2026-11').motivo));
  assert.ok(/texto/.test(p.diagnosticarQR('Hola', '2026-11').motivo));
  assert.ok(/CDC suelto/.test(p.diagnosticarQR(cdcSintetico(), '2026-11').motivo));
  const otro = p.diagnosticarQR('https://pagos.ejemplo.com/qr?x=1', '2026-11');
  assert.ok(/pagos\.ejemplo\.com/.test(otro.motivo));
  assert.strictEqual(otro.enlace, '');
  assert.ok(/vacío/.test(p.diagnosticarQR('', '2026-11').motivo));
});
prueba('diagnosticarQR: e-Kuatia sin CDC', () => {
  const d = p.diagnosticarQR('https://ekuatia.set.gov.py/consultas/qr?nVersion=150&Id=123', '2026-11');
  assert.ok(/no trae el CDC/.test(d.motivo));
  assert.ok(d.enlace);
});
prueba('diagnosticarQR: otro mes sugiere el período y muestra los datos', () => {
  const d = p.diagnosticarQR(enlace(cdcSintetico('20261005'), '2026-10-05'), '2026-11', '1234567');
  assert.strictEqual(d.periodoSugerido, '2026-10');
  assert.ok(d.datos.some(([k, v]) => k === 'Número' && v === '001-002-0000123'));
  assert.ok(d.datos.some(([k, v]) => k === 'Documento' && v === 'Factura electrónica'));
});
prueba('diagnosticarQR: otro cliente y sin RUC receptor', () => {
  const d = p.diagnosticarQR(enlace(cdcSintetico(), '2026-11-02'), '2026-11', '7654321');
  assert.strictEqual(d.rucReceptor, '1234567');
  assert.ok(/otro cliente/.test(d.motivo));
  const sin = p.diagnosticarQR(enlace(cdcSintetico(), '2026-11-02').replace('&dRucRec=1234567', ''), '2026-11', '7654321');
  assert.ok(/consumidor final/.test(sin.detalle));
});
prueba('diagnosticarQR: nota de crédito', () => {
  const d = p.diagnosticarQR(enlace('05' + cdcSintetico().slice(2), '2026-11-02'), '2026-11', '1234567');
  assert.ok(/nota de crédito/.test(d.motivo));
  assert.ok(d.datos.some(([k, v]) => k === 'Documento' && v === 'Nota de crédito electrónica'));
});

console.log(fallas.join('\n\n'));
console.log(`\n${pasadas} pruebas pasadas, ${fallas.length} fallidas.`);
process.exit(fallas.length ? 1 : 0);
