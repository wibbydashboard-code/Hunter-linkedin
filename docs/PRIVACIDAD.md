# Privacidad V1.1

## Datos locales

Prospectos, evidencias, categorías, estados, notas, búsquedas/lotes, errores, checkpoints, preferencias y clave Brave se guardan en IndexedDB/localStorage del perfil Chrome. No hay backend, telemetría ni sincronización propia. Exporta backup antes de limpiar el perfil.

## Solicitudes a terceros

Cuando se inicia una consulta, el texto y presupuesto de búsqueda se envían al proveedor seleccionado. La búsqueda pública Guanajuato consulta su API REST y lee posts oficiales que la respuesta enlaza. Brave recibe texto de consulta y la credencial `X-Subscription-Token`; el CRM no se envía. En el modo Brave + páginas aprobadas, tras la búsqueda se consultan `robots.txt` y contenido de cada host exacto confirmado por la persona. Se omiten cookies y credenciales; no se siguen redirecciones. El proveedor y el sitio pueden registrar direcciones de red conforme a sus propios términos.

## LinkedIn y contenido protegido

Las consultas LinkedIn usan solo índice público de buscador (título/snippet). La extensión nunca hace fetch a LinkedIn, no usa autenticación ni cookies y no accede a páginas protegidas. CAPTCHA, autenticación, bloqueos, 403/429/500 y fallos de red no se eluden. Los errores se registran y requieren decisión manual antes de reanudar.

## Minimización y retención

El motor mantiene fuente, fecha y procedencia por campo. Email y teléfono no se infieren. La ubicación del evento no se asigna como ubicación personal. Una sola fuente queda como pendiente; fuentes cruzadas requieren dos hosts independientes alineados. Antes de guardar o contactar, revisa exactitud, vigencia, propósito y permisos de uso. No almacenes datos sensibles ni información privada de contacto. Esta guía no sustituye asesoría jurídica.
