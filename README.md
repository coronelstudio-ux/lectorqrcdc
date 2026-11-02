# Lector QR de facturas SET

Lee en tiempo real el QR de las facturas electrónicas (e-Kuatia / SIFEN) con la cámara del celular, arma una lista del período y genera un Excel para compartir a Google Drive.

## Privacidad
- Este repositorio contiene **solo código**. No guarda facturas ni datos de clientes.
- Los datos se quedan en el navegador del celular (localStorage) y en el Excel que generas.
- No hay servidor: la app corre completa en el navegador.

## Uso
1. Abre la página desde GitHub Pages (HTTPS, necesario para la cámara).
2. Elige el período con la etiqueta del mes (arriba a la derecha). Las facturas de otros meses se rechazan.
3. En **Escanear**, toca el botón de la cámara y acerca el QR hasta que ocupe casi todo el recuadro. También puedes leer desde una **Foto** o pegar el **Enlace**. Si el celular lo permite, aparecen la linterna y el zoom.
4. En **Lista** revisa, busca o borra facturas sueltas.
5. En **Exportar**, pulsa **Guardar Excel en Drive** y elige Google Drive en el menú de compartir.

En el visor, el botón de cámara con flechas cambia entre la cámara trasera y la frontal.

## Instalar como app
- **Android (Chrome):** toca el botón de descarga del encabezado o **Exportar → Instalar app**. Si no aparece, menú ⋮ → *Instalar app*.
- **iPhone (Safari):** Compartir → *Agregar a inicio*.
- Una vez instalada abre sin barra del navegador y funciona sin internet (compartir a Drive sí necesita conexión).
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
- `app.js`: cámara, lista, Excel y compartir.
- `parser.js`: lectura del enlace del QR (funciones puras, probables con Node).
- `manifest.webmanifest`, `sw.js`, `icons/`: instalación como app y uso sin conexión.
