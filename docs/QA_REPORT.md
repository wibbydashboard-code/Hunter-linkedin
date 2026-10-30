# QA Report — Prospect Hunter B2B V1.1

Fecha de ejecución: 26 de octubre de 2026. Entorno: Node.js 22.23.4, npm 10.9.9 y Chromium 156 en sandbox.

## Resultados

| Prueba | Resultado | Evidencia |
|---|---|---|
| Manifest MV3 y bundle local | PASS | `npm run build`; manifest 1.1.0, sin permisos requeridos ni código remoto. Los hosts Brave y boletines Guanajuato son opcionales. |
| Regresión V1 | PASS | Ocho pruebas de dominio, IndexedDB, clasificación, deduplicación, scoring e importación/exportación. |
| Descubrimiento y extracción | PASS | Siete pruebas para texto profesional, JSON-LD Person, evidencia, robots.txt, dominios aprobados, fuentes independientes, límites, lotes reanudables y bloqueo HTTP 500. |
| Pruebas automatizadas | PASS | `npm test`: 15/15 pruebas pasan. |
| Auditoría de dependencias | PASS | `npm audit`: cero vulnerabilidades conocidas. |
| Fuente oficial REST — prueba real del motor | PASS | `npm run test:live`, consulta `Martinrea Silao manufactura Guanajuato`, límite 4. El motor V1.1 usó 2 solicitudes, terminó sin errores y extrajo 3 candidatos nuevos del artículo oficial de Martinrea. Los nombres se omitieron de la copia pública. |
| Panel MV3 en Chromium — consulta real | BLOCKED | Chromium concedió el permiso opcional y el panel envió una consulta real; el sitio/filtro contestó HTTP 500. La UI registró el error, pausó el lote y no mostró candidatos. Ver `live-chromium-ui.json`. No se reintentó ni se intentó eludir la respuesta. |
| Fuentes cruzadas independientes | NO DEMOSTRADO | El candidato live tiene una sola fuente primaria. Se conserva como descubierto/pendiente; no se etiqueta verificado. |
| Brave/LinkedIn indexado | NO PROBADO | No se proporcionó una clave Brave. El adaptador usa `site:linkedin.com/in` en el índice de Brave y no abre ni solicita páginas LinkedIn. |
| Extracción corporativa/directorios | PARCIAL | Parser Schema.org/JSON-LD y texto editorial probado en fixtures. La consulta está condicionada a URL de Brave, host HTTPS exacto aprobado, consentimiento y `robots.txt`; no hubo prueba live contra un sitio empresarial. |

## Descubrimiento real reproducible

Ejecuta `npm run test:live`. El script realiza una consulta al endpoint REST público con presupuesto explícito de cuatro solicitudes y solo devuelve código de éxito si encuentra candidatos. El resultado exitoso del 26-10-2026 estructuró tres candidatos con cargos y fuente; sus nombres se omitieron de la copia pública. Los tres llevan como evidencia el boletín gubernamental del 30-09-2026 y estado `pendiente`; no se infiere su perfil LinkedIn, correo o vigencia más allá de lo afirmado en la fuente.

La ejecución paralela desde la interfaz de extensión en Chromium no pasó: el servidor devolvió HTTP 500. La API también dio respuestas distintas durante las pruebas: una ejecución del motor devolvió tres candidatos, mientras que el navegador recibió 500. En este estado se demuestra que el motor extrae candidatos reales, pero no se declara validado el flujo extremo a extremo estable dentro de la extensión. El HTTP 500 se registra como límite del proveedor/filtro, no como autorización para seguir probando rutas, proxies o identidades alternativas.

## Reproducción local

```bash
npm ci
npm test
npm run build
npm audit
npm run test:live
```

La prueba live consulta un servicio externo. Por diseño no hay reintentos automáticos y el comando falla con código distinto de cero si la fuente no devuelve candidatos.

## Controles y límites

La extensión solo procesa el REST público oficial y resultados de índice. LinkedIn se restringe a títulos/snippets del proveedor de búsqueda; nunca inicia sesión ni abre perfiles. El parser HTML exige HTTPS, host exacto permitido, permiso opcional y aceptación de términos; comprueba `robots.txt`, limita el tamaño y rechaza redirecciones. Errores 403/429/500 se registran sin evasión. La clasificación es explicable y precede a la revisión. La deduplicación corre antes de guardar, los campos desconocidos permanecen vacíos y una fuente única no se presenta como verificación independiente.
