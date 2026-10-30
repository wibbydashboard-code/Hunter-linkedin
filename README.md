# Prospect Hunter B2B V1.1

Extensión Chrome Manifest V3 para descubrir y estructurar candidatos profesionales desde fuentes públicas, clasificarlos y administrarlos en un CRM local. La búsqueda y captura no acceden automáticamente a LinkedIn ni a páginas protegidas.

## Instalar en Chrome de escritorio

1. Clona el repositorio o descarga su ZIP desde GitHub.
2. Abre `chrome://extensions`, activa **Modo de desarrollador** y elige **Cargar descomprimida**.
3. Selecciona la carpeta `dist/` del repositorio.
4. Abre el panel y navega a **Búsqueda**.

Chrome para Android no admite esta instalación de extensiones de escritorio.

## Descubrir candidatos

El proveedor de prueba incluido consulta el endpoint REST público de boletines del Gobierno de Guanajuato. Completa o pega consultas por lote, deja el límite de solicitudes en un valor conservador y pulsa **Descubrir candidatos**. Si Chrome lo pide, concede el permiso opcional `boletines.guanajuato.gob.mx`. El motor consulta el índice y después los posts oficiales enlazados, extrae nombres/cargos mencionados y conserva URLs y fecha de publicación. Los campos sin evidencia permanecen vacíos.

Los candidatos aparecen primero como **descubiertos** y **pendientes**. Se clasifican por reglas locales y se deduplican antes de guardarse. Un candidato con una sola fuente no se presenta como verificado. Los lotes registran errores y un checkpoint; **Reanudar lote guardado** vuelve a iniciar la consulta pendiente solo cuando la persona lo solicita. No hay reintentos automáticos ante bloqueos.

Para búsqueda web general elige **Brave Search API**, configura tu clave personal y habilita el permiso opcional de `api.search.brave.com`. Brave publica un precio de US$5 por 1.000 solicitudes y US$5 en crédito mensual; revisa [sus precios actuales](https://api-dashboard.search.brave.com/documentation/pricing). La búsqueda **Índice Brave: perfiles públicos de LinkedIn** agrega `site:linkedin.com/in` y consume títulos/snippets indexados. No se abre LinkedIn, usa cookies, inicia sesión ni solicita páginas protegidas.

El adaptador **Brave + páginas corporativas/directorios aprobados** requiere la misma clave y URLs encontradas por Brave. Antes de usarlo, especifica hosts HTTPS exactos, confirma que sus términos permiten automatización y habilita solo esos hosts. El adaptador consulta `robots.txt`, limita respuestas HTML, no sigue redirecciones y extrae contenido público/JSON-LD; respeta bloqueos y errores. No es un bypass ni una determinación jurídica de que todo sitio permita crawling.

## Estado de la validación de V1.1

`npm run test:live` ejecutó el motor de descubrimiento contra la API pública y obtuvo tres candidatos de Martinrea en Silao con URLs de evidencia. Sin embargo, la misma búsqueda iniciada desde el panel de extensión en Chromium recibió HTTP 500 de un filtro del sitio. La extensión guardó el error y pausó el lote sin reintentar. Por ello, el motor real está probado, pero el flujo de UI en navegador no se declara estable extremo a extremo hasta que una consulta autorizada desde la extensión se complete sin ese bloqueo. El detalle está en [QA_REPORT.md](docs/QA_REPORT.md) y [live-chromium-ui.json](docs/live-chromium-ui.json); esta copia pública omite el archivo con nombres de candidatos. La evidencia resumida de la consulta está en [V1_1_SOURCE_EVIDENCE.md](docs/V1_1_SOURCE_EVIDENCE.md).

## CRM local y privacidad

Los candidatos solo se incorporan al CRM cuando eliges guardarlos. El contenido se almacena localmente en IndexedDB/localStorage; la clave Brave queda local y se envía a Brave en consultas. No hay servidor propio. No se recopilan datos sensibles, teléfonos privados ni correos personales. Revisa fuente, actualidad, finalidad, base legal y retención antes de contactar a cualquier persona.

## Desarrollo y pruebas reproducibles

Requiere Node.js 20+ y npm.

```bash
npm ci
npm test
npm run build
npm audit
npm run test:live
```

`npm test` ejecuta 15 pruebas automatizadas. `npm run test:live` hace una consulta externa única con presupuesto de 4 solicitudes; no reintenta y devuelve fallo si no obtiene candidatos. `npm run build` crea `dist/`, con código local y sin CDN ni scripts remotos. Consulta [la evidencia y limitaciones de las fuentes](docs/V1_1_SOURCE_EVIDENCE.md), [arquitectura](docs/ARQUITECTURA.md), [privacidad](docs/PRIVACIDAD.md) y [QA](docs/QA_REPORT.md).

El archivo [100 filas demo](demo/demo-prospects.csv) es exclusivamente sintético. Esta copia para GitHub público omite los archivos con prospectos reales del piloto y usa nombres ficticios en los tests.
