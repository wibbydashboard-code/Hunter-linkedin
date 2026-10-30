# Fuentes y limitaciones V1.1

La fuente de prueba integrada es la API REST pública de boletines del Gobierno de Guanajuato. Para el endpoint estándar se solicita el permiso de host opcional. La prueba de motor en vivo obtuvo candidatos de Martinrea, pero la misma consulta desde Chromium recibió HTTP 500; el acceso desde la UI no se considera estable hasta que el sitio permita la petición. Lee [fuentes y evidencia detalladas](V1_1_SOURCE_EVIDENCE.md) y el [intento en Chromium](live-chromium-ui.json). El resultado bruto con nombres se omite de esta copia pública.

Brave Search API es el proveedor intercambiable de búsqueda web y requiere cuenta/clave personal, host opcional y presupuesto. Brave publica US$5 por 1.000 búsquedas y US$5 de créditos mensuales; confirma términos y precios vigentes antes de uso. El perfil LinkedIn se busca solo con `site:linkedin.com/in` y solo se extraen título/snippet indexados, nunca una página del propio LinkedIn.

Páginas corporativas/directorios: la persona proporciona dominios HTTPS exactos, permite los términos y autoriza el host. Brave debe devolver la URL. El parser consulta `robots.txt`, limita tamaño, rechaza redirecciones y extrae HTML público y JSON-LD `Person`. La extracción está probada en fixtures, no en una empresa externa durante QA.

Los candidatos se clasifican como descubiertos o pendientes. Un mismo dominio no constituye cruce independiente. Verificado por fuentes cruzadas requiere al menos dos hosts diferentes con nombre, cargo y empresa alineados. Estado, vigencia laboral, autoridad de compra y ubicación personal no se inferieren de un evento o de la localización de la empresa. Los campos no sustentados se dejan en blanco.

Los lotes admiten hasta diez consultas y presupuestos configurables con checkpoints. Los errores se conservan. HTTP 403, 429, 500 y errores de red se muestran; el motor se detiene y no usa proxy, CAPTCHA, autenticación, cabeceras de suplantación o rutas alternativas para eludir la respuesta.

Los datasets nominales del piloto y el registro live con nombres se excluyen de este repositorio público. `demo/demo-prospects.csv` contiene datos sintéticos. Un resultado de búsqueda no equivale a verificar vigencia, autoridad de compra o intención comercial.

## Referencias

- [WP REST API público de boletines](https://boletines.guanajuato.gob.mx/wp-json/)
- [WP REST Search](https://boletines.guanajuato.gob.mx/wp-json/wp/v2/search?search=Martinrea&per_page=5)
- [robots.txt](https://boletines.guanajuato.gob.mx/robots.txt)
- [Artículo de Martinrea, 30 de septiembre de 2026](https://boletines.guanajuato.gob.mx/2026/09/30/crece-martinrea-en-guanajuato-con-inversion-de-50-mdd/)
- [Brave Search API](https://api-dashboard.search.brave.com/documentation)
- [Precios Brave](https://api-dashboard.search.brave.com/documentation/pricing)
