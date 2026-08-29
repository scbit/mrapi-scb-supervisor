# M4 — Contratos de datos del Core V3

Los contratos ejecutables están centralizados en `src/contracts/sourceContracts.js`.

## Reglas

1. Adapters traducen esquemas fuente a objetos normalizados.
2. El Core no debe depender de nombres Firestore específicos.
3. Las colecciones fuente no son duplicadas completas en persistencia V3.
4. V3 persiste estado derivado, fingerprints, checkpoints, fallas y agregados.
5. Una modificación de esquema se resuelve en el adapter/normalizador correspondiente.
6. Recontacto requiere evidencia explícita de contacto; `updatedAt` o una nota interna genérica no bastan.

## Identidad de vendedor

Se admiten aliases configurados y aliases descubiertos de `CRM users` / `hunter_users`.
El mapping cross-source explícito sigue siendo configurable y tendrá que completarse con datos reales si nombres/emails/IDs no coinciden.
