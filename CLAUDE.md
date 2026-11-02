# Contexto del proyecto: Lector QR de facturas SET

## Qué es
Página web estática (sin build ni backend) para leer en tiempo real el QR de facturas electrónicas de Paraguay (e-Kuatia / SIFEN) con la cámara del celular. Arma una lista por período mensual y genera un Excel para compartir a Google Drive.

Es la primera etapa de un flujo mayor:
1. **Este lector (celular):** lee QR y genera el Excel del período.
2. **Cruce con Marangatu:** confirmar en el Libro IVA Compras (por CDC) cuáles coinciden, y completar en el detalle de cada factura los datos que faltan (timbrado, desglose IVA 5 %/10 %/exentas, razón social).
3. **Carga en ContAdis:** script de teclado que lee el Excel final. Usar IA en cada factura gasta muchos tokens, por eso no se hace así.

Por ahora solo se trabaja con **compras**. No tocar ventas.

## Reglas de negocio
- **Período mensual:** la app solo acepta facturas del mes elegido (campo `periodo`, formato AAAA-MM, tomado de `dFeEmiDE`). Las de otros meses se rechazan y no entran en la lista ni en el Excel.
- **Identificador único:** el CDC de 44 dígitos. Se usa para evitar duplicados y para cruzar con Marangatu.
- **Montos paraguayos:** el enlace trae `139.900,0000` (punto = miles, coma = decimales) o `1090.909091` (punto decimal). `parseMonto` acepta ambos. No cambiar esta regla.
- **Todos los parámetros del enlace** se guardan (columna "Enlace QR" y JSON interno), para no tener que releer el QR.
- **Estado inicial:** cada fila sale como "Pendiente Marangatu".

## Privacidad (importante)
- El repositorio **solo contiene código**. Nunca subir facturas, Excel, CSV, capturas ni datos de clientes (RUC, nombres, teléfonos, correos).
- `.gitignore` bloquea `*.xlsx`, `*.csv` y `*.zip`. No quitar esas reglas.
- Los datos viven en `localStorage` del navegador del celular y en el Excel que genera el usuario.
- Los ejemplos de código y los comentarios deben usar datos genéricos o sintéticos, no facturas reales.

## Arquitectura
- `index.html`: interfaz. Carga jsQR y SheetJS desde CDN, y luego `parser.js` y `app.js`.
- `parser.js`: funciones puras (sin DOM): `parseMonto`, `hexToStr`, `parsearEnlace`, `aFilaExcel`. Exporta con `module.exports` si existe `module`, para probar con Node.
- `app.js`: cámara, detección, lista por período, Excel y compartir. Todo el estado está en la variable `lista` y en `localStorage` (claves `lectorQR_lista`, `lectorQR_periodo`, `lectorQR_sonido` y `lectorQR_camara`).
- `manifest.webmanifest`, `sw.js` e `icons/`: app instalable (PWA) que funciona sin internet.

### Interfaz
- Tres pestañas con navegación inferior: **Escanear** (cámara a pantalla completa con visor y línea de barrido), **Lista** (tarjetas con búsqueda y borrado individual) y **Exportar** (resumen del período y botón de compartir).
- El período se elige desde la etiqueta del encabezado (input `month` invisible encima).
- Respuesta de cada lectura: aviso de color (verde registrada, ámbar duplicada, rojo error u otro mes), destello del visor, vibración y pitido (Web Audio, se puede silenciar).
- Linterna y zoom solo aparecen si la cámara los soporta (`getCapabilities`).
- Leer QR desde una foto de la galería (misma detección que la cámara).
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

### Excel y Drive
- SheetJS genera el `.xlsx` en memoria. Se entrega con `navigator.share({ files })`, y el usuario elige Google Drive.
- No hay descarga directa (`<a download>`) a propósito: el usuario pidió no descargar.
- Si el navegador no soporta compartir archivos, se muestra un mensaje; no se hace fallback a descarga.

## Columnas del Excel (orden fijo, no cambiar sin avisar)
CDC · Número · Fecha emisión · Período · Tipo doc · Establecimiento · Punto · RUC emisor · DV emisor · RUC receptor · Total (Gs) · IVA (Gs) · Ítems · Versión XML · Fecha de lectura · Estado · Enlace QR

## Estructura del enlace QR (e-Kuatia)
`https://ekuatia.set.gov.py/consultas/qr?nVersion=…&Id=<CDC>&dFeEmiDE=<fecha en hex>&dRucRec=…&dTotGralOpe=…&dTotIVA=…&cItems=…&DigestValue=…&IdCSC=0001&cHashQR=…`

CDC (44 dígitos): tipo doc (1-2), RUC emisor (3-10), DV (11), establecimiento (12-14), punto (15-17), número (18-24), tipo contribuyente (25), fecha AAAAMMDD (26-33), tipo emisión (34), código de seguridad (35-43), DV (44).

Atención: en JavaScript los índices son 0-based. `parser.js` ya usa `slice` con esa convención (ej.: `cdc.slice(25, 33)` = fecha).

## Pruebas
- Parser con Node (sin dependencias): `node tests/parser.test.js`
- Sintaxis de la app: `node --check app.js`
- Prueba manual: publicar en GitHub Pages y probar en Chrome Android con una factura real.

## Pendientes conocidos
1. Verificar en el celular del usuario que la cámara en vivo detecte QR densos (versión 10 a 14).
2. Verificar que las URLs de los CDN (jsQR 1.4.0 y xlsx 0.18.5) respondan.
3. Opcional: guardado directo a Drive con OAuth (requiere Google Cloud y un client ID).
4. Pendiente de otra etapa: cruce con Marangatu y completado de datos (no implementado aquí).

## Convenciones
- Sin frameworks ni build. JavaScript de navegador en ES2020, sin módulos ES.
- Textos de la interfaz y mensajes al usuario en español.
- Commits en español, en tiempo presente y cortos (ej.: "Agrega validación de período").
- Antes de cambiar la estructura de columnas del Excel o las reglas de período, preguntar al usuario.
