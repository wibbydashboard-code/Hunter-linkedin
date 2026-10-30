# Fuentes y evidencia de V1.1

Fuentes consultadas y ejecuciones reproducibles observadas el 26 de octubre de 2026.

## API REST del Gobierno de Guanajuato

El índice REST está publicado en [boletines.guanajuato.gob.mx/wp-json](https://boletines.guanajuato.gob.mx/wp-json/), que anuncia la ruta `wp/v2`. La búsqueda probada fue [WP REST search para Martinrea](https://boletines.guanajuato.gob.mx/wp-json/wp/v2/search?search=Martinrea&per_page=5), que devolvió resultados con URL de artículo y enlace REST del post. El [robots.txt del sitio](https://boletines.guanajuato.gob.mx/robots.txt) observado permite el acceso general y excluye `/wp-admin/`.

El artículo usado como fuente primaria es [Crece Martinrea en Guanajuato con inversión de 50 MDD](https://boletines.guanajuato.gob.mx/2026/09/30/crece-martinrea-en-guanajuato-con-inversion-de-50-mdd/), publicado el 30 de septiembre de 2026. El artículo describe varios cargos de operación y ejecutivos vinculados a la inversión y la ceremonia. Los nombres de las personas se omiten de esta copia pública. La prueba de extracción resumida registró tres candidatos a revisión; solo los cargos que mencionan explícitamente la planta reciben localidad Silao. Los cargos corporativos no se etiquetan con localidad personal a partir del lugar de un evento.

El 26-10-2026 el mismo módulo `runDiscoveryBatch` utilizado por la extensión consultó la API pública con `Martinrea Silao manufactura Guanajuato`, consumió dos de cuatro solicitudes permitidas y estructuró tres candidatos nuevos con la URL de evidencia. El archivo bruto con sus nombres se excluye de esta copia pública. La prueba dejó los candidatos en estado pendiente; no encontró email, teléfono ni perfil LinkedIn. La búsqueda de candidatos dio resultado, pero esto no equivale a verificar la relación laboral vigente.

La verificación dentro de Chromium mostró una limitación diferente: el [registro resumido del intento desde la UI](live-chromium-ui.json) registra HTTP 500 del sitio al enviar la consulta desde el panel con permiso opcional concedido. El motor paró después de una solicitud, dejó el lote reanudable y no repitió la solicitud. Hubo una llamada de prueba que sí devolvió resultados y una llamada de Chromium que recibió HTTP 500. Este comportamiento no es estable ni se debe sortear; por ese motivo el flujo extremo a extremo en Chrome no se declara validado.

## Brave y perfiles públicos indexados

La [documentación oficial de Brave Search API](https://api-dashboard.search.brave.com/documentation) describe Web Search como resultados indexados de títulos, URLs y snippets. Su [página de precios](https://api-dashboard.search.brave.com/documentation/pricing) indica US$5 por cada 1.000 solicitudes y US$5 en créditos gratuitos mensuales. V1.1 no contiene clave; Brave requiere que cada persona configure su propia credencial.

El adaptador LinkedIn añade `site:linkedin.com/in` a consultas Brave y convierte solo título/snippet de resultados indexados. No hace solicitudes a páginas de LinkedIn, no usa autenticación y no intenta extraer contenido protegido. No se presentó un resultado LinkedIn en esta prueba live.

## Páginas corporativas y directorios

El adaptador de páginas utiliza URLs encontradas por Brave únicamente si la persona proporciona el host HTTPS exacto, concede permiso opcional para ese host y confirma que los términos permiten consulta automatizada. Antes de cada página consulta `robots.txt`; no sigue redirecciones, limita el tamaño y procesa texto visible y JSON-LD `Person`. El parser y las reglas se probaron en fixtures, pero no hubo una prueba live con una empresa o directorio. Los bloqueos y las respuestas 403/429/500 se registran sin proxy ni evasión.
