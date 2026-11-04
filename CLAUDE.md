# Contexto del proyecto: Lector QR de facturas DNIT

Nombre de la app: **Lector QR DNIT** (la SET ahora es la DNIT; el dominio del enlace sigue siendo `ekuatia.set.gov.py`).

## Qué es
Página web estática (sin build ni backend) para leer en tiempo real el QR de facturas electrónicas de Paraguay (e-Kuatia / SIFEN) con la cámara del celular. Arma una lista por período mensual y genera un Excel que se guarda en el celular (el usuario usa una carpeta sincronizada con Google Drive).

Es la primera etapa de un flujo mayor:
1. **Este lector (celular):** lee QR y genera el Excel del período.
2. **Cruce con Marangatu:** confirmar en el Libro IVA Compras (por CDC) cuáles coinciden, y completar en el detalle de cada factura los datos que faltan (timbrado, desglose IVA 5 %/10 %/exentas, razón social).
3. **Carga en ContAdis:** script de teclado que lee el Excel final. Usar IA en cada factura gasta muchos tokens, por eso no se hace así.

Por ahora solo se trabaja con **compras**. No tocar ventas.

## Reglas de negocio
- **Clientes:** el usuario atiende varios contribuyentes. Cada cliente tiene `id`, `nombre`, `ruc` (sin DV ni ceros a la izquierda), `dv` y `actividades` (texto libre, máx. 500). Siempre hay un cliente elegido (selector en el encabezado); la lista, los totales y el Excel son del cliente y el período elegidos. Cada factura guarda `clienteId`.
- **RUC receptor:** la factura debe ser del cliente elegido. QR: se compara `dRucRec` con el RUC del cliente (`rucCoincide`, sin DV ni ceros); si no coincide o falta, se rechaza como una de otro mes (si es de otro cliente registrado, el aviso lo nombra). IA y a mano: campo "RUC receptor (cliente)" en el formulario, precargado con el cliente y validado por `validarFactura(f, periodo, rucCliente)`.
- **Período mensual:** la app solo acepta facturas del mes elegido (campo `periodo`, formato AAAA-MM, tomado de `dFeEmiDE`). Las de otros meses se rechazan y no entran en la lista ni en el Excel.
- **Identificador único:** el CDC de 44 dígitos. Se usa para evitar duplicados y para cruzar con Marangatu.
- **Montos paraguayos:** el enlace trae `139.900,0000` (punto = miles, coma = decimales) o `1090.909091` (punto decimal). `parseMonto` acepta ambos. No cambiar esta regla.
- **Todos los parámetros del enlace** se guardan (columna "Enlace QR" y JSON interno), para no tener que releer el QR.
- **Estado inicial:** cada fila sale como "Pendiente Marangatu".
- **Tipos de factura:** `QR` (leída del QR), `Electrónica sin QR` (KuDE con CDC impreso, leída con IA) y `Manual` (preimpresa). **Origen de los datos:** `QR`, `IA` o `Manual` (cargada a mano).
- **Identificador único (`id`):** el CDC si tiene 44 dígitos; si no, `número|RUC sin ceros a la izquierda|fecha|total redondeado` (`claveFactura`).
- **Excluir de conciliación:** casilla por factura. Por defecto: QR = no, Electrónica sin QR = no, Manual = sí (`excluirPorDefecto`). La conciliación con Marangatu no está implementada; solo debe respetar esta casilla.
- **La IA nunca guarda sola:** siempre se abre el formulario de revisión con los campos dudosos (`revisar`) en ámbar y las validaciones en vivo; solo "Confirmar" agrega la factura.
- **Validaciones (`validarFactura`):** total = 5 % + 10 % + exenta; RUC con DV (1 a 8 dígitos, guion, 1 dígito); fecha real y dentro del período; número `000-000-0000000`; IVA = gravada 10 %/11 + gravada 5 %/21 con tolerancia de 1 Gs por tasa; si hay CDC, debe coincidir con número, RUC y fecha.
- **Cuenta, descripción y timbrado (obligatorios en todas las facturas):** no vienen en el QR.
  - **Cuenta:** una de `CUENTAS_COMPRA` (52 cuentas de ContAdis que puede llevar una compra, con su texto exacto, incluidos errores como "LUBRICANES"). Se excluyen ventas, ingresos, sueldos, aportes, previsiones, depreciaciones, amortizaciones y diferencias de cambio. Mercaderías = "COSTO DE MERCADERÍAS GRAVADAS POR EL IVA" (o "…EXENTAS DEL IVA" si todo es exento).
  - **Descripción:** en mayúsculas, máximo 60 caracteres y general: un ítem tal como figura; varios del mismo tipo, el tipo ("GALLETITAS", "BEBIDAS VARIAS"); de distintos tipos, "MERCADERÍAS VARIAS".
  - **Timbrado:** 8 dígitos (`validarComplementos`).
  - QR: al leer, la cámara se pausa y se abre la ventana **Completar** (cuenta, descripción, timbrado). La app recuerda por proveedor el timbrado (global) y la cuenta y descripción (por cliente), y los sugiere (`sugerenciaProveedor` / `recordarProveedor`, clave `lectorQR_proveedores`). Con un proveedor conocido basta tocar Guardar. Cancelar descarta la factura.
  - IA: elige cuenta y descripción con el detalle y las **actividades del cliente** (texto libre en el perfil). El prompt (`armarPromptIA`) lleva solo el listado de compras; en Claude la cuenta está limitada por `enum` en `ESQUEMA_IA`.
  - El Excel no se genera si alguna factura del cliente y período no tiene cuenta, descripción o timbrado válidos (`faltantes`); se completan desde el lápiz de cada tarjeta en la Lista.
- **Montos escritos a mano o por la IA:** `montoFlexible` convierte `139.900` (solo puntos de miles) en 139900 y el resto lo pasa a `parseMonto` sin cambiar su regla.

## Privacidad (importante)
- El repositorio **solo contiene código**. Nunca subir facturas, Excel, CSV, capturas ni datos de clientes (RUC, nombres, teléfonos, correos).
- `.gitignore` bloquea `*.xlsx`, `*.csv` y `*.zip`. No quitar esas reglas.
- Los datos viven en `localStorage` del navegador del celular y en el Excel que genera el usuario.
- Los ejemplos de código y los comentarios deben usar datos genéricos o sintéticos, no facturas reales.

## Arquitectura
- `index.html`: interfaz. Carga jsQR y SheetJS desde CDN, y luego `parser.js` y `app.js`.
- `parser.js`: funciones puras (sin DOM): `parseMonto`, `hexToStr`, `parsearEnlace`, `aFilaExcel`, y para facturas sin QR `validarFactura`, `normalizarIA`, `claveFactura`, `completarFactura`, `montoFlexible`, `PROMPT_IA`, `ESQUEMA_IA`. Exporta con `module.exports` si existe `module`, para probar con Node.
- `app.js`: cámara, detección, lista por período y guardado del Excel. Todo el estado está en la variable `lista` y en `localStorage` (claves `lectorQR_lista`, `lectorQR_clientes`, `lectorQR_cliente`, `lectorQR_proveedores`, `lectorQR_periodo`, `lectorQR_sonido`, `lectorQR_camara`, `lectorQR_ia` y las API keys `lectorQR_clave_gemini` / `lectorQR_clave_claude`). Al cargar, `completarFactura` migra listas viejas (tipo y origen `QR`, sin cliente).
- Facturas sin cliente (de versiones anteriores): no se muestran. Al crear un cliente se le asignan las que tienen su RUC receptor; si es el primer cliente, también las que no tienen RUC receptor (`asignarHuerfanas`). La hoja de clientes avisa cuántas quedan y con qué RUC.
- Sin clientes, la app abre la hoja "Clientes" al iniciar y no deja escanear ni cargar hasta crear uno. Borrar un cliente borra sus facturas (con confirmación). El RUC de un cliente con facturas no se puede cambiar, solo el nombre.
- `manifest.webmanifest`, `sw.js` e `icons/`: app instalable (PWA) que funciona sin internet.

### Interfaz
- Tres pestañas con navegación inferior: **Escanear** (cámara a pantalla completa con visor y línea de barrido), **Lista** (tarjetas con búsqueda y borrado individual) y **Exportar** (resumen del período y botón Guardar Excel).
- Encabezado: logo · **cliente** (abre la hoja Clientes: elegir, agregar, editar, borrar) · instalar · período. En pantallas de 480 px o menos se oculta el nombre de la app.
- El período se elige desde la etiqueta del encabezado (input `month` invisible encima).
- Respuesta de cada lectura: aviso de color (verde registrada, ámbar duplicada, rojo error u otro mes), destello del visor, vibración y pitido (Web Audio, se puede silenciar).
- Linterna y zoom solo aparecen si la cámara los soporta (`getCapabilities`).
- Leer QR desde una foto de la galería (misma detección que la cámara).
- Barra de Escanear: Foto · Sin QR · cámara · Enlace · A mano. **Sin QR** abre la lectura con IA (foto o galería, o copiar y pegar); **A mano** abre el formulario vacío.
- En la lista, cada tarjeta muestra tipo, origen, cuenta, descripción, timbrado y la casilla "Excluir de conciliación". Las incompletas van primero, en ámbar, con "Falta: …" y el lápiz para completarlas.
- Botón para cambiar entre cámara trasera y frontal (solo si hay más de una). La frontal se ve en espejo; la app recuerda la última elegida.
- La cámara se apaga al salir de la pestaña Escanear.
- Tema claro u oscuro según el sistema; la vista de cámara siempre es oscura.

### Detección de QR
1. Si existe `BarcodeDetector` (Chrome Android), se usa primero: es el lector más robusto para QR densos.
2. Si no, se usa `jsQR` sobre el cuadro completo.
3. Si falla, se prueba con el 80 % central ampliado 1.5×.

### Cámara
- Requiere HTTPS o localhost. Desde un archivo local (`file://`) Chrome Android no da permiso.
- Pide `facingMode: environment` y 1920×1080 ideal. La resolución real se muestra en pantalla para diagnóstico.

### App instalable (PWA)
- `manifest.webmanifest`: pantalla completa (`standalone`), vertical, rutas relativas para funcionar dentro de GitHub Pages (`/<repositorio>/`).
- `sw.js`: guarda la app y las librerías del CDN (cache-first). No guarda datos de facturas.
- **Al cambiar cualquier archivo de la app, subir `VERSION` en `sw.js`.** Si no, los celulares con la app instalada siguen usando la copia vieja. Con la versión nueva aparece el aviso "Nueva versión disponible" y el botón Actualizar recarga.
- Chrome Android: botón "Instalar" en el encabezado y en Exportar (evento `beforeinstallprompt`). iPhone: se muestran los pasos de Safari → Compartir → Agregar a inicio.
- Los scripts del CDN llevan `crossorigin="anonymous"` para que el service worker los pueda guardar.

### Lectura con IA (facturas sin QR)
- Proveedores: **Gemini** (por ahora el principal), **Claude** y **manual** (copiar las instrucciones, usarlas con la foto en el chat de la IA y pegar el JSON). Se eligen en Exportar → Lectura con IA.
- La API key se guarda solo en `localStorage` del celular, en un campo `type="password"`. Nunca en el repositorio.
- Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/<modelo>:generateContent`, encabezado `x-goog-api-key`, `responseMimeType: application/json`. Modelo por defecto `gemini-flash-latest` (editable en la app).
- Claude: `POST https://api.anthropic.com/v1/messages` con `claude-haiku-5-5`, `anthropic-version: 2026-10-21`, `anthropic-dangerous-direct-browser-access: true`, imagen base64 y `output_config.format` con `ESQUEMA_IA` (JSON garantizado), `effort: low`.
- La foto se reduce a 1600 px (JPEG 0,85) antes de enviarla. Requiere internet; el resto de la app funciona sin conexión.
- `PROMPT_IA` pide solo JSON con las claves del esquema y `null` para lo que no aparece (sin estimar). `normalizarIA` limpia la respuesta, completa datos desde el CDC y marca dudosos.

### Excel (guardar en el celular)
- Un Excel por cliente: SheetJS genera el `.xlsx` en memoria con el nombre `QR_facturas_<RUC cliente>_<AAAA-MM>.xlsx`, solo con las facturas del cliente y el período elegidos. La columna "RUC receptor" identifica al cliente (en las facturas sin QR se llena desde el formulario).
- Si existe `showSaveFilePicker`, se abre "Guardar como" para elegir carpeta (puede ser de Google Drive). Si el usuario cancela, no se hace nada.
- Si no existe o falla, se descarga con `<a download>` a la carpeta Descargas. En Chrome se puede activar "Preguntar dónde guardar los archivos" para elegir la carpeta.
- **No se usa `navigator.share`**: Chrome Android no permite compartir `.xlsx` (solo imágenes, PDF, texto, etc.) y daba error de permiso. El usuario pidió reemplazarlo por guardar.

## Columnas del Excel (orden fijo, no cambiar sin avisar)
Fecha emisión · Número · Timbrado · RUC emisor · DV emisor · Razón social · Cuenta · Descripción · Condición · Gravada 10 % · Gravada 5 % · Exenta · Total (Gs) · IVA (Gs) · Tipo · Origen de los datos · Excluir de conciliación · Estado · RUC receptor · Período · Tipo doc · Establecimiento · Punto · Ítems · Versión XML · Fecha de lectura · Enlace QR · CDC

28 columnas, orden aprobado por el usuario: primero los datos principales (cuenta, descripción y timbrado junto a los datos del proveedor) y el CDC al final. En facturas QR, razón social, condición y desglose quedan vacíos. "Excluir de conciliación" sale como `Sí` / `No`. Para el script de ContAdis conviene comparar las cuentas sin acentos ni mayúsculas.

## Estructura del enlace QR (e-Kuatia)
`https://ekuatia.set.gov.py/consultas/qr?nVersion=…&Id=<CDC>&dFeEmiDE=<fecha en hex>&dRucRec=…&dTotGralOpe=…&dTotIVA=…&cItems=…&DigestValue=…&IdCSC=0001&cHashQR=…`

CDC (44 dígitos): tipo doc (1-2), RUC emisor (3-10), DV (11), establecimiento (12-14), punto (15-17), número (18-24), tipo contribuyente (25), fecha AAAAMMDD (26-33), tipo emisión (34), código de seguridad (35-43), DV (44).

Atención: en JavaScript los índices son 0-based. `parser.js` ya usa `slice` con esa convención (ej.: `cdc.slice(25, 33)` = fecha).

## Pruebas
- Parser y validaciones con Node (sin dependencias, datos sintéticos): `node tests/parser.test.js`
- Sintaxis de la app: `node --check app.js`
- Prueba manual: publicar en GitHub Pages y probar en Chrome Android con una factura real.

## Pendientes conocidos
1. Verificar en el celular del usuario que la cámara en vivo detecte QR densos (versión 10 a 14).
2. Verificar que las URLs de los CDN (jsQR 1.4.0 y xlsx 0.18.5) respondan.
3. Opcional: guardado directo a Drive con OAuth (requiere Google Cloud y un client ID). Por ahora el usuario guarda en una carpeta del celular sincronizada con Drive.
4. Pendiente de otra etapa: cruce con Marangatu y completado de datos (no implementado aquí; solo respetar "Excluir de conciliación").
5. Probar en el celular la lectura con IA con una factura manual y una electrónica sin QR reales (Gemini con la API key del usuario).
6. Confirmar que el modelo de Gemini por defecto (`gemini-flash-latest`) responde; si no, cambiarlo en la app.

## Convenciones
- Sin frameworks ni build. JavaScript de navegador en ES2020, sin módulos ES.
- Textos de la interfaz y mensajes al usuario en español.
- Commits en español, en tiempo presente y cortos (ej.: "Agrega validación de período").
- Antes de cambiar la estructura de columnas del Excel o las reglas de período, preguntar al usuario.
