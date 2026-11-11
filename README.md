# Lector QR de facturas DNIT

Lee en tiempo real el QR de las facturas electrónicas (e-Kuatia / SIFEN) con la cámara del celular, arma una lista del período y genera un Excel que se guarda en el celular (por ejemplo, en una carpeta sincronizada con Google Drive).

## Privacidad
- Este repositorio contiene **solo código**. No guarda facturas ni datos de clientes.
- Los datos se quedan en el navegador del celular (localStorage) y en el Excel que generas.
- No hay servidor: la app corre completa en el navegador.

## Uso
1. Abre la página desde GitHub Pages (HTTPS, necesario para la cámara).
2. Elige el período con la etiqueta del mes (arriba a la derecha). Las facturas de otros meses se rechazan.
3. En **Escanear**, toca el botón de la cámara y acerca el QR hasta que ocupe casi todo el recuadro. También puedes leer desde una **Foto** o pegar el **Enlace**. Si el celular lo permite, aparecen la linterna y el zoom.
4. En **Lista** revisa, busca o borra facturas sueltas.
5. En **Exportar**, pulsa **Guardar Excel**. Si el celular lo permite se abre *Guardar como* para elegir la carpeta; si no, queda en **Descargas**. Para elegir la carpeta cada vez: Chrome ⋮ → Configuración → Descargas → *Preguntar dónde guardar los archivos*.

En el visor, el botón de cámara con flechas cambia entre la cámara trasera y la frontal.

## Varios clientes
- Toca el **cliente** en el encabezado para elegirlo, agregar uno (nombre y RUC con DV), editarlo o borrarlo. La primera vez la app pide crear el primero.
- La lista, los totales y el Excel son del cliente y el período elegidos. El Excel se llama `Compras_<Nombre>_<Apellido>_<AAAA-MM>.xlsx` (o `Ventas_…`).
- Si una factura tiene otro RUC receptor (es de otro cliente) se rechaza. Si ese RUC es de otro cliente registrado, el aviso dice cuál.
- Las facturas guardadas antes de esta versión se asignan solas al crear el cliente con su RUC receptor.

## Cuenta, descripción y timbrado
- Son obligatorios en todas las facturas. Al leer un QR, la cámara se pausa y aparece **Completar**: eliges la cuenta de ContAdis, escribes la descripción y el timbrado del proveedor.
- La app recuerda lo último usado con cada proveedor y lo sugiere: con un proveedor conocido basta tocar **Guardar**.
- Con IA, la cuenta y la descripción las propone la IA según el detalle y las **actividades del cliente** (se cargan en el perfil del cliente).
- El Excel no se genera hasta que todas las facturas del período tengan esos datos; las que faltan aparecen primero en la Lista, en ámbar, con el lápiz para completarlas.

## Ventas
- Elige **Ventas** en la barra bajo el encabezado. Se cargan con **Sin QR** (IA) o **A mano**; no se usa la cámara QR.
- En el perfil del cliente registra sus **timbrados de venta**: la app solo acepta ventas con uno de ellos.
- El emisor es siempre el cliente. Para consumidor final marca la casilla (RUC 44444401-7, SIN NOMBRE).
- Cuenta (conceptos de venta de ContAdis), descripción, condición y "Excluir de conciliación" funcionan igual que en compras.
- Los Excel se llaman `Compras_<Nombre>_<Apellido>_<AAAA-MM>.xlsx` y `Ventas_<Nombre>_<Apellido>_<AAAA-MM>.xlsx` (el nombre se puede cambiar en el perfil del cliente).

## Facturas sin QR (lectura con IA)
1. En **Exportar → Lectura con IA**, elige el proveedor (Gemini, Claude o copiar y pegar) y pega tu API key. Se guarda solo en el celular.
2. En **Escanear**, toca **Sin QR** y saca una foto de la factura (o elígela de la galería).
3. Revisa el formulario: los campos en ámbar son dudosos y los errores salen en rojo (sumas, IVA, RUC, número, fecha del período). Nada se guarda hasta que tocas **Confirmar**.
4. **A mano** abre el mismo formulario vacío para cargar una factura sin IA.

Cada factura tiene la casilla **Excluir de conciliación** (por defecto marcada solo en las manuales). El Excel tiene 28 columnas: primero fecha, número, timbrado, proveedor, cuenta, descripción, condición, montos e IVA; el CDC va al final.

## Pruebas
```
node tests/parser.test.js
```

## Instalar como app
- **Android (Chrome):** toca el botón de descarga del encabezado o **Exportar → Instalar app**. Si no aparece, menú ⋮ → *Instalar app*.
- **iPhone (Safari):** Compartir → *Agregar a inicio*.
- Una vez instalada abre sin barra del navegador y funciona sin internet, incluido guardar el Excel.
- Cuando se publica una versión nueva aparece el aviso **Nueva versión disponible → Actualizar**. Para que llegue, sube `VERSION` en `sw.js` en cada cambio.

## Publicar en GitHub Pages
1. Crea un repositorio en GitHub (privado o público; no importa para los datos, porque no hay).
2. Sube estos archivos: `git remote add origin <url>` y `git push -u origin main`.
3. En el repositorio: *Settings → Pages → Deploy from a branch → main / (root)*.
4. La dirección será `https://<usuario>.github.io/<repositorio>/`.

## Dependencias externas (CDN)
- `jsQR@1.4.0`: lector de QR de respaldo cuando el navegador no tiene `BarcodeDetector`.
- `xlsx@0.18.5` (SheetJS): generación del Excel.
Verifica las URLs en `index.html` antes de publicar.

## Archivos
- `index.html`: interfaz.
- `app.js`: cámara, lista y guardado del Excel.
- `parser.js`: lectura del enlace del QR (funciones puras, probables con Node).
- `manifest.webmanifest`, `sw.js`, `icons/`: instalación como app y uso sin conexión.
