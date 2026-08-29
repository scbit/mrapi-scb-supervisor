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
