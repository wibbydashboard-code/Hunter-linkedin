# Arquitectura V1.1

La extensión usa Manifest V3, HTML/CSS y JavaScript modular empaquetado localmente con esbuild. El popup abre el panel. No hay content scripts ni acceso al DOM de páginas visitadas.

`src/sources.js` tiene adaptadores para Brave Search API, consulta del índice público WordPress REST de boletines Guanajuato, perfiles públicos de LinkedIn encontrados por índice y páginas HTML públicas bajo dominios HTTPS exactos que el usuario aprueba. El adaptador Guanajuato obtiene resultados de `/wp-json/wp/v2/search`, valida host/HTTPS del `self` y lee posts REST asociados. El extractor identifica patrones de nombre/cargo en artículos y Schema.org `Person` en HTML aprobado. LinkedIn se restringe a títulos y snippets del buscador; nunca se hace fetch al perfil.

El adaptador HTML requiere URL resultado de Brave, clave configurada, host exacto en la lista autorizada, permiso opcional y confirmación de que los términos permiten automatización. Antes de leer una página pide `robots.txt`, respeta `Allow`/`Disallow`, no sigue redirecciones, rechaza host no aprobado o respuestas no HTML y limita el tamaño. Ningún error de proveedor activa retries automáticos.

`src/app.js` orquesta búsquedas y lotes de hasta 10 consultas, presupuestos de solicitudes y pausas entre peticiones. Persiste query, referencias, candidatos, errores y `nextIndex` en `searchRuns`. Los lotes parciales se reanudan solo por acción explícita. Candidatos se clasifican por reglas locales y pasan por deduplicación antes de guardar. Campos desconocidos permanecen vacíos.

`crossValidateCandidates` agrupa nombres normalizados, conserva varias evidencias y solo etiqueta “verificado por fuentes cruzadas” si hay coincidencia de cargo/empresa en al menos dos hosts distintos. La localidad solo se asigna a mención editorial cuando el cargo ubica expresamente la planta; la ubicación del evento no se atribuye como domicilio de cada persona.

`src/db.js` gestiona IndexedDB v2 con almacenes para prospectos, búsquedas, categorías, tareas, listas y metadatos. `src/domain.js` cubre scoring, deduplicación y clasificación. `src/exporters.js` ofrece CSV/XLSX/JSON con defensa contra fórmulas. `build.mjs` genera código local autocontenido.

## Permisos

No se declaran permisos requeridos. Los hosts opcionales son `https://api.search.brave.com/*` y `https://boletines.guanajuato.gob.mx/*`. La función de páginas corporativas solicita únicamente los hosts exactos seleccionados en el formulario. No se piden cookies, historial, tabs, scripting ni permisos para LinkedIn.

## Dependencias

`exceljs` (MIT) para XLSX; `esbuild`, `vitest` y `fake-indexeddb` para build y pruebas. Ejecutar `npm audit` al actualizar.
