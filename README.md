# SUPERVISOR SCB V3 — 0.7.3

Reporte ejecutivo con cartera vigente por vendedor.

## Regla de negocio: trato vigente
Incluye: SEGUIMIENTO, MARCA PERSONAL, PARA COTIZAR, COTIZADO PARA ENVIAR, HORNO, PENDIENTE DE PAGO.
Excluye NO RESPONDE y todos los estados cerrados/ganados/perdidos/descartados.

## Cambios
- Tratos vigentes totales y por vendedor.
- Bloque compacto por vendedor: vigentes, esperando, vencidos, Hunter y actividad.
- Esperas Bandeja en buckets <15, 15-29, 30-59 y 60+ min.
- Formato de tiempo humano para mayor espera.
- Roster unificado CRM/Hunter, excluyendo cuentas técnicas configuradas.
- Migración única de los deal states ya persistidos en supervisor-scb. No vuelve a leer el CRM completo.

No requiere variables nuevas. Fuentes siguen READ ONLY.


## v0.7.7 — Communications & Report Testing UI

Variables adicionales:
- `EMAIL_SERVICE_URL`
- `EMAIL_SYSTEM_TOKEN` (secret)
- `EMAIL_ACCOUNT_KEY`
- `SUPERVISOR_REPORT_EMAIL_TO`
- `SUPERVISOR_BUCKET_NAME=bucket-supervisor-orchestador`

La UI permite validar conectividad de mrapi-email, enviar pruebas de Email/Telegram, validar existencia del bucket sin escribir en él y separar Generar / Ver / Enviar reporte. El servicio de email se reutiliza vía `POST /api/system/send-email`; Supervisor no implementa SMTP.


## v0.7.8 — Email Report UX

- Mantiene `report.text` para Telegram.
- Genera `report.html` específico para email.
- HTML compatible con Outlook usando tablas y estilos inline.
- Secciones visuales separadas, métricas destacadas y tablas para cartera/atención.
- No cambia cálculos ni reglas de negocio del reporte general.


## v0.8.4 — Daily Report Accuracy + Actionable Email

- Corrige el porcentaje por vendedor para usar conversaciones de cliente respondidas, nunca cantidad de mensajes humanos sobre cantidad de clientes.
- Separa conversaciones respondidas, actividad humana y cantidad de mensajes humanos.
- Rediseña el email diario con tarjetas, ranking, calidad IA, cartera/Hunter/eventos y casos priorizados.
- Cada caso relevante incluye botón **Ver conversación** con `https://hub.sentirecustomsbroker.com/?conversationId=<conversationId>`.
- `HUB_BASE_URL` puede configurarse por entorno; usa el HUB productivo como valor por defecto.
- Fuentes operativas permanecen READ ONLY.

## v0.8.5 — Calidad de Leads desde CRM

- Replica la semántica de **Mi Estado Comercial > Calidad de los leads ingresados**.
- Source of truth: `bscrmscb/deals.leadQuality` (READ ONLY).
- Valores oficiales: `DESCARTADO`, `NO_RESPONDE`, `REGULAR`, `BUENO`, `EXCELENTE`.
- Para el Daily se toman los deals cuyo `createdAt` cae dentro del día seleccionado en horario Buenos Aires y se usa la calidad actual del trato, igual que CRM.
- Agrega total, distribución por calidad, `% Bueno + Excelente` y desglose por vendedor al texto y email del Daily.
- Si la lectura CRM falla, el reporte muestra **dato no disponible**; nunca infiere ni inventa calidad con IA.
- No agrega escrituras en CRM ni cambia reglas del pipeline.


## v0.8.6 — Daily Gerencial Final
- Consolida atención, tiempos, IA comercial, ranking, cartera, Hunter y eventos.
- Cruza `leadQuality=EXCELENTE` (dato duro CRM) con la gestión diaria del Supervisor.
- Agrega `Leads Excelentes mal aprovechados` y `Leads Excelentes bien trabajados`, ambos con link directo al HUB.
- El cruce no modifica CRM/Bandeja/Hunter; todas las fuentes siguen en modo solo lectura.

## v0.9.0 — Supervisor Remoto + ciclo de corrección

- Configuración desde UI de supervisor remoto, vendedores, horario, pausa 12:00–13:00 y frecuencia.
- Reporte filtrado por uno o varios vendedores.
- Estado persistido solo en `supervisor-scb`.
- `SupervisionAction` con tipos controlados y ciclo `WAITING_FOR_ACTION -> VERIFIED | FAILED`.
- Verificación determinística para RESPOND/FOLLOW_UP y semántica por AI Provider para acciones cualitativas.
- OpenAI implementa hoy el contrato `verifyCorrection`; la lógica de negocio no depende del proveedor y queda preparada para MRAPI AI Core / IA local en una fase posterior.
- Evita duplicar una corrección abierta para mismo vendedor/conversación/tipo.
- KPI de cumplimiento por vendedor y memoria de reincidencias por tipo.
- Endpoint `POST /api/supervisor/remote/tick` para que un scheduler externo ejecute la frecuencia configurada. La infraestructura/scheduler NO se crea automáticamente en esta versión.
- CRM (`bscrmscb`), Bandeja (`bsscb`) y Hunter (`scb-hunter-bd`) continúan estrictamente READ ONLY.


## v0.11.7 Automation Safety Layer
- `/api/supervisor/remote/tick` ahora pasa por lock anti-solapamiento y circuit breaker.
- Health: `GET /api/supervisor/automation/health`.
- Pausa manual: `POST /api/supervisor/automation/pause`.
- Reanudar: `POST /api/supervisor/automation/resume`.
- Límites por tick y estado se guardan solo en la BD propia `supervisor-scb`.
- Si alcanza un límite o timeout lógico, se pausa antes de enviar Telegram.


## v0.11.8 Safety budget fix
- El límite de Telegram ya no cuenta grupos configurados.
- Solo considera envíos reales del tick.
- DRY_RUN no puede pausarse por cantidad de grupos configurados.

## v0.11.9 — Operations UI + archive
- Oculta de la operación principal los bloques legacy de reportes manuales; el código sigue disponible internamente.
- `/reports` concentra histórico de reportes e incidentes críticos.
- Scheduler status se basa en heartbeat real: NOT_CONNECTED / ACTIVE / LATE.
- Un Cloud Scheduler real debe llamar `/api/supervisor/remote/tick` con `{"source":"scheduler",...}` para dejar heartbeat.
- Los reportes Daily Live ya persistían; ahora hay API de archivo para consultarlos.
- Incidentes críticos persistidos: circuit breaker, safety limits, Telegram budget y casos comerciales conservadores (sin respuesta humana o muy tardía + mala calidad).

## v0.11.10 — Reports auth fix
- `/reports` reutiliza el mismo `localStorage.supervisor_api_token` de la pantalla principal.
- Ya no usa una clave distinta (`supervisorToken`) que provocaba 401/UNAUTHORIZED.

## v0.12.0 — Daily V3 Live + comparación de mejora
- Daily V3 vuelve a ser la lógica madre visible del Supervisor en vivo.
- Prueba manual por vendedor y fecha: revisa todos los chats del día 09:00–17:00.
- Casos importantes incluyen link directo al HUB.
- Agrega seguimiento persistente de correcciones: PENDING / CORRECTED / NOT_CORRECTED.
- Permite comparar dos días del mismo vendedor y devuelve MEJORO / ESTABLE / EMPEORO.
- La comparación normaliza por cantidad de clientes usando tasas de: buena respuesta comercial, demora, falta de indagación y potencial no explorado.


## v0.13.0 — UI final + pruebas manuales
- Tres productos de supervisión visibles y separados: Supervisor en Vivo, SUPER SUPERVISOR y Cierre Diario Gerencial.
- IA alineada a Guía Comercial SCB v1.0.
- Producto definido / producto descubierto por vendedor.
- Perfil comercial y adecuación de respuesta.
- Fallos GRAVE / HIPER_GRAVE.
- Oportunidades con producto definido y link HUB.
- Cierre con cartera vencida y +7 días.
- Botones de prueba manual y envío Telegram; scheduler permanece sin automatizar.

## v0.13.1 — Telegram seller editor
- La configuración Telegram por vendedor sigue compacta.
- Cada vendedor tiene botón Editar.
- Al editar se muestra desplegable con los grupos/chats detectados por el bot.
- Permite conservar el Chat ID actual aunque no aparezca en la detección.
- Permite ingresar Chat ID manual como fallback.
- Guardar actualiza solo ese vendedor mediante el contrato existente de network/setup.

## v0.13.2 — Manual analysis timeout fix
- Los tres reportes manuales ya no intentan analizar todo el día + IA dentro de una sola request HTTP.
- La UI inicia un job Daily V3 y lo procesa en lotes pequeños de 2 conversaciones.
- Muestra progreso `procesadas/total`.
- Reutiliza análisis ya guardado del mismo día/corte/Guía SCB en vez de volver a llamar IA.
- La request final solo compone el reporte y, si corresponde, envía Telegram.
- No cambia Scheduler ni activa automatización.

## v0.13.3 — Supervisor en Vivo approved-format cleanup
- Supervisor en Vivo prefiltra conversaciones por owner/vendedor antes de leer mensajes o ejecutar IA.
- La prueba de Augusto ya no procesa el universo completo del día para luego filtrar.
- `Bien trabajados` usa la misma regla de corrección de la Guía SCB: un chat no puede estar a la vez bien trabajado y a corregir.
- Estados técnicos como SUPERSEDED no aparecen en el reporte humano: se muestran solo PENDIENTE / CORREGIDA / NO CORREGIDA.
- Producto se presenta como `Producto` + `Producto descubierto por`.
- Actualizar grupos del bot ahora muestra feedback, refresca setup y combina detección del bot con grupos ya configurados.

## v0.13.4 — Tiempos de respuesta + seguimiento
- Supervisor en Vivo conserva el producto pero elimina `Producto descubierto por`.
- Resumen muestra cantidad de respuestas tarde y máxima demora.
- Cada cliente a corregir muestra `Respuesta: A TIEMPO / TARDE / SIN RESPUESTA` con duración cuando existe.
- Se agrega `Seguimientos correctos` al resumen.
- Se agrega sección separada `SEGUIMIENTOS CORRECTOS` para no castigar seguimientos válidos a clientes que dejaron de responder.

## v0.13.5 — Seguimiento comercial con contexto BOT
- Un seguimiento ya no es correcto solo porque el vendedor volvió a escribir.
- Los chats de seguimiento también pasan por IA cuando hubo intervención humana.
- Si el bot ya descubrió producto/negocio/intención, el humano debe continuar desde ese contexto.
- Saludos genéricos o '¿seguís interesado?' sin avance se clasifican como seguimiento INSUFICIENTE.
- Seguimiento correcto exige avanzar: modalidad (courier/marítimo según cantidad), volumen/proveedor/origen, recomendación SCB o próximo paso concreto.
- Un seguimiento insuficiente entra en CLIENTES A CORREGIR y sale de SEGUIMIENTOS CORRECTOS.
- Nueva caché `guide_v1_followup_v2` para no reutilizar análisis anteriores.

## v0.13.6 — Meta Ad bootstrap + 3-touch activation
- El primer CTA automático de Meta Ads se ignora como respuesta real del cliente cuando dispara una respuesta BOT inmediata.
- Si no hubo respuesta real del cliente, el primer día de intervención humana es ACTIVACIÓN INICIAL.
- Regla de activación: mínimo 3 contactos útiles ese día.
- Menos de 3 intentos entra en CLIENTES A CORREGIR.
- Después de 3 intentos sin respuesta, el caso pasa a seguimiento pasivo cada 7-10 días.
- Supervisor debe mantener visible que la próxima fecha CRM no puede quedar vencida.
- En activaciones ya no se muestra `Respuesta: A TIEMPO · 0 min`; se muestra `ACTIVACIÓN INICIAL · x/3 mensajes`.
- Nueva caché `guide_v1_followup_v3`.

## v0.13.7 — Bien trabajado = avance comercial real
- AVANCE COMERCIAL REAL > CHECKLIST PERFECTO.
- Bien trabajado si cotizó/encaminó cotización, usó un link de proveedor para avanzar, orientó con criterio a quien no sabe qué importar, recomendó algo útil o dejó próximo paso concreto.
- La tardanza queda como métrica separada de calidad comercial.
- Producto reforzado leyendo todos los mensajes reales del cliente + fallback para frases explícitas de importar/traer/comprar.
- Nueva caché `guide_v1_advance_v1`.

## v0.13.8 — Mostrar TODOS los chats
- Supervisor en Vivo muestra todos los chats del vendedor con actividad en el corte.
- Cada chat aparece exactamente una vez en `TODOS LOS CHATS DEL DÍA`.
- Estados visibles: PENDIENTE/A CORREGIR, BIEN TRABAJADO, SEGUIMIENTO CORRECTO, REVISAR SEGUIMIENTO o REVISAR.
- El resumen agrega `Chats del día`; debe coincidir con los casos listados.
- Seguimientos sin inbound muestran `Seguimiento: ...`, nunca `A TIEMPO · 0 min`.
- Nueva caché `guide_v1_all_chats_v1`.
