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

## v0.13.9 — Avance comercial concreto
- BIEN TRABAJADO exige avance comercial verificable.
- Tipos válidos: QUOTE_SENT, QUOTE_READY, SUPPLIER_LINK_USED, GUIDED_SUPPLIER_SEARCH, MODE_RECOMMENDATION, BUSINESS_DISCOVERY, CALL_AGREED.
- Mantener el chat abierto, pedir un dato técnico aislado o mandar a Alibaba sin criterio ya no cuenta como avance.
- Caso Bety incorporado como regla de calibración: producto + intención + cantidad, pero sin proveedor; si se la manda sola a Alibaba sin guía ni retorno con links/MOQ/precio/peso/medidas, queda A CORREGIR.
- Si el propio análisis dice que no quedó próximo paso, no se transformó en oportunidad, no avanzó demasiado o faltó acompañamiento, no puede quedar BIEN TRABAJADO.
- Nueva caché `guide_v1_concrete_advance_v1`.

## v0.13.10 — Producto desde contexto completo
- No cambia la lógica comercial aprobada de v0.13.9.
- Corrige únicamente detección/presentación de producto.
- El producto puede tomarse de contexto explícito CLIENTE + BOT + HUMANO, no solo del último mensaje del cliente.
- Un `product_name` explícito ya no se descarta por inconsistencia de `product_defined=false`.
- El row conserva también textos BOT para fallback de contexto.
- Caso de calibración: Walid debe poder recuperar `cortadora circular de carpintero de mano`.
- Nueva caché `guide_v1_product_context_v1`.

## v0.13.11 — Supervisor en Vivo cada 45 minutos
- No cambia la lógica comercial aprobada de v0.13.10.
- Frecuencia efectiva por vendedor: 45 minutos.
- Migra automáticamente el valor legacy de 30 minutos a 45.
- El runtime usa Network Setup como source of truth de la frecuencia, aun si un supervisor viejo conservaba `frequencyMinutes: 30`.
- Mantiene L–V 09:00–17:00 y pausa 12:00–13:00.
- NO incorpora comparación entre cortes; se hará en una misión posterior.
- La automatización real requiere que Cloud Scheduler invoque `/api/supervisor/remote/tick`; el endpoint ya aplica gating de 45 minutos.

## v0.13.12 — Nombres reales de grupos Telegram
- El selector y la tabla muestran el nombre real del grupo de Telegram.
- Los Chat IDs quedan internos.
- Para grupos configurados que ya no aparecen en `getUpdates`, usa Telegram `getChat(chat_id)` para recuperar el título.
- Persiste `telegramChatTitle` junto al destino.

## v0.13.13 — Prueba masiva + destinos gerenciales separados
- Agrega botón `PROBAR TODOS LOS GRUPOS AHORA`.
- La prueba usa el mismo Supervisor en Vivo manual aprobado, vendedor por vendedor, con Fecha/Corte seleccionados.
- Envía un reporte real a cada vendedor activo con grupo Telegram configurado y muestra resultado ✅/❌ por grupo.
- La prueba manual no depende del gate automático de 45 minutos.
- SUPER SUPERVISOR tiene su propio grupo Telegram (`superSupervisorChatId`).
- Cierre Diario Gerencial tiene su propio grupo Telegram (`closingChatId`).
- Los botones manuales de SUPER y Cierre envían únicamente a sus destinos específicos.
- Se conservan nombres visibles de grupos y Chat IDs internos.

## v0.13.14 — SUPER SUPERVISOR automático 10:00 y 14:00
- Nuevo endpoint `POST /api/supervisor/scheduled/super`.
- Usa horario local `America/Argentina/Buenos_Aires`, solo L–V.
- Ventanas válidas 10:00–10:29 y 14:00–14:29.
- Cutoff automático 10 o 14.
- Envía al grupo específico de SUPER SUPERVISOR.
- Idempotencia por fecha + cutoff: un mismo reporte no se manda dos veces.
- Reutiliza análisis/cache existente y no fuerza IA de nuevo.
- Pensado para un Cloud Scheduler dedicado a las 10:00 y 14:00.

## v0.13.15 — Cierre Diario optimizado: CRM sin IA
- NO modifica SUPER SUPERVISOR.
- Mantiene intactos `🔥 OPORTUNIDADES DEL DÍA` y `📋 RESUMEN POR VENDEDOR`.
- El análisis comercial con IA queda limitado a las conversaciones del día.
- La cartera CRM NO usa IA: se calcula determinísticamente desde los deal states ya sincronizados en Supervisor.
- Etapas CRM controladas: Seguimiento, Marca personal, Esperando PI, Para cotizar, Cotizado para enviar y Horno.
- Nuevo bloque por vendedor: vencidos de más de 15 días.
- Nuevo bloque por vendedor: vigentes con dueDate entre hoy y +15 días.
- Para vigentes muestra hoy / próximos 7 / días 8–15, desglose por etapa y hasta 3 tratos concretos para empujar cierre.
- Los miles de tratos históricos NO disparan análisis OpenAI.

## v0.13.16 — Ranking determinístico “A EMPUJAR HOY”
- NO modifica SUPER SUPERVISOR.
- NO modifica `🔥 OPORTUNIDADES DEL DÍA`.
- NO modifica `📋 RESUMEN POR VENDEDOR`.
- En vigentes 0–15 días, prioriza sin IA por etapa:
  1. HORNO
  2. COTIZADO PARA ENVIAR
  3. PARA COTIZAR
  4. ESPERANDO PI
  5. SEGUIMIENTO
  6. MARCA PERSONAL
- Dentro de la misma prioridad, ordena por vencimiento más cercano.
- Muestra hasta 5 tratos concretos por vendedor bajo `🎯 A EMPUJAR HOY`.
- No muestra IDs técnicos como nombre de cliente/trato.
- Si el snapshot local todavía no tiene título, consulta solamente esos top picks contra CRM con `getDeal` (lectura puntual, sin OpenAI) para recuperar el nombre y conversationId.
- El engine ahora persiste `title` en snapshots CRM para futuras sincronizaciones, reduciendo esas lecturas puntuales.

## v0.13.17 — Reportes: sesión autenticada compartida
- Corrige `UNAUTHORIZED` en `/reports` sin tocar Cloud Scheduler ni GCP.
- Una llamada autenticada con `x-supervisor-token` crea una cookie de sesión HttpOnly de 12 horas.
- La cookie NO contiene el `SUPERVISOR_API_TOKEN`; contiene un HMAC derivado y solo sirve contra la misma aplicación.
- Las APIs protegidas aceptan el header existente o la cookie de sesión válida.
- La pantalla principal y `/reports` usan credenciales same-origin.
- `/reports` reutiliza automáticamente la sesión; el campo de token queda como respaldo manual.
- Si falta autenticación, la UI ya no lo presenta como caída del Scheduler: muestra explícitamente que falta sesión/token.

## v0.13.18 — Conectar Supervisor desde cualquier PC
- Agrega un bloque visible `🔐 Conectar Supervisor` en la pantalla principal.
- Si la PC no tiene token/sesión o una API devuelve 401, la UI muestra automáticamente el bloque de autenticación.
- Campo de token + botón `Guardar y conectar`.
- El token se valida contra `/api/supervisor/automation/health` antes de dar la PC por conectada.
- Si es válido, se guarda en `localStorage` de ese navegador y se crea/reutiliza la sesión HttpOnly de v0.13.17.
- Botón `Olvidar token de esta PC`.
- Un token incorrecto se elimina del almacenamiento local y se informa claramente.
- No modifica Cloud Scheduler, GCP, SUPER SUPERVISOR ni Cierre Diario.

## v0.13.19 — Tres automatizaciones independientes
- Nuevo panel `Control de automatización`.
- `Supervisor en Vivo`: ON/OFF independiente, L–V 09:00–17:00, pausa 12–13, frecuencia 45 min.
- `SUPER SUPERVISOR`: ON/OFF independiente, 10:00 y 14:00.
- `Cierre Diario Gerencial`: ON/OFF independiente, horario configurable 17:00 / 17:15 / 17:30.
- Los botones manuales SIEMPRE siguen disponibles aunque un automático esté OFF.
- El Scheduler existente de 15 min actúa como reloj general.
- En weekdays el tick antiguo ya no envía sus reportes seller/general por Telegram; sincroniza fuentes y luego ejecuta los tres productos aprobados.
- Supervisor en Vivo automático reutiliza UNA base Daily V3 global por corte y luego genera el mismo formato aprobado por vendedor, evitando análisis IA repetido por vendedor.
- SUPER usa idempotencia fecha+10/14; el Scheduler dedicado existente también respeta `superAutoEnabled` y comparte la misma idempotencia.
- Cierre usa idempotencia por fecha.
- Existe pausa/reanudación maestra adicional como safety; no afecta los botones manuales.

## v0.13.20 — Fix switches de automatización
- Corrige el checkbox que se destildaba inmediatamente al hacer click.
- La causa era que el evento `change` volvía a renderizar desde la configuración guardada (todavía OFF).
- Ahora el click solo actualiza el estado visual local.
- `Guardar automatización` persiste los tres valores y luego refresca desde backend.

## v0.13.21 — Telegram automático DRY_RUN / LIVE
- Control visible para habilitar o bloquear envíos automáticos reales.
- DRY_RUN no envía Telegram desde Scheduler; LIVE sí, únicamente para productos ON.
- Confirmación explícita antes de pasar a LIVE.
- Los envíos manuales siguen disponibles.
- El tick general y el Scheduler dedicado de SUPER respetan esta compuerta.

## v0.13.22 — No auto-pausar por backlog normal
- Corrige el motivo por el que el Supervisor podía volver a `PAUSED` después de un tick.
- Alcanzar exactamente los límites de lectura (250 conversaciones / 2000 deals / 5000 Hunter) ahora se interpreta como backlog paginado, no como falla.
- El motor guarda una advertencia y continúa incrementalmente en el próximo tick de 15 minutos.
- Solo un timeout real sigue siendo un safety stop que auto-pausa.
- La UI muestra claramente `pauseReason` o warnings de backlog.
- No cambia los 3 switches, Telegram LIVE, horarios ni los botones manuales.

## v0.13.23 — BOUNDED TICK
- Corrige el 504 observado en Cloud Run con latencia exacta de 300 segundos.
- El Scheduler de 15 minutos usa lotes acotados: 25 conversaciones, 300 deals y 750 eventos Hunter por tick.
- Los checkpoints conservan el avance; si queda backlog continúa en el siguiente tick.
- Las ejecuciones manuales/full mantienen los límites anteriores.
- En weekdays se elimina del tick automático la reconstrucción redundante del pipeline remoto legacy de seller/general reports.
- El flujo automático queda: sync incremental acotada -> evaluar los 3 productos aprobados.
- Un fallo aislado de Live / SUPER / Cierre se registra como incidente y no convierte automáticamente todo el tick en HTTP 500.
- Weekend conserva su flujo existente.
